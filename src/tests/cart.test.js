/**
 * Cart Controller Tests
 * Comprehensive test suite for cart functionality
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { setupTestDB, cleanupTestDB, createTestUser, createTestProduct } = require('./setup');

// Setup and teardown
beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Product.deleteMany({});
  await Cart.deleteMany({});
});

describe('Cart Controller', () => {
  let user;
  let token;
  let product;

  beforeEach(async () => {
    // Create test user and product
    user = await createTestUser();
    token = user.generateAuthToken();
    product = await createTestProduct();
  });

  describe('GET /api/cart', () => {
    it('should get user cart', async () => {
      // Create a cart for the user
      const cart = new Cart({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 2,
          price: product.price
        }]
      });
      await cart.save();

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].product._id.toString()).toBe(product._id.toString());
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it('should return empty cart if no cart exists', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.totalAmount).toBe(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/cart')
        .expect(401);
    });
  });

  describe('POST /api/cart/add', () => {
    it('should add item to cart', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 3
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('should update quantity if item already exists in cart', async () => {
      // First add item
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 2
        });

      // Add same item again
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 3
        })
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should check product availability', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: product.stock + 10
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('stock');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/cart/add')
        .send({
          productId: product._id,
          quantity: 1
        })
        .expect(401);
    });
  });

  describe('PUT /api/cart/update/:productId', () => {
    beforeEach(async () => {
      // Add item to cart first
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 2
        });
    });

    it('should update item quantity', async () => {
      const res = await request(app)
        .put(`/api/cart/update/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('should remove item if quantity is 0', async () => {
      const res = await request(app)
        .put(`/api/cart/update/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 0 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('should return 404 if product not in cart', async () => {
      const anotherProduct = await createTestProduct({ name: 'Another Product' });
      
      await request(app)
        .put(`/api/cart/update/${anotherProduct._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 3 })
        .expect(404);
    });
  });

  describe('DELETE /api/cart/remove/:productId', () => {
    beforeEach(async () => {
      // Add item to cart first
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 2
        });
    });

    it('should remove item from cart', async () => {
      const res = await request(app)
        .delete(`/api/cart/remove/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('should return 404 if product not in cart', async () => {
      const anotherProduct = await createTestProduct({ name: 'Another Product' });
      
      await request(app)
        .delete(`/api/cart/remove/${anotherProduct._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('DELETE /api/cart/clear', () => {
    beforeEach(async () => {
      // Add items to cart first
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id,
          quantity: 2
        });
    });

    it('should clear entire cart', async () => {
      const res = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.totalAmount).toBe(0);
    });

    it('should work even if cart is already empty', async () => {
      // Clear cart first
      await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${token}`);

      // Try to clear again
      const res = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
