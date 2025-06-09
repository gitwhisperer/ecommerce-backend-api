/**
 * Order Controller Tests
 * Comprehensive test suite for order functionality
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
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
  await Order.deleteMany({});
});

describe('Order Controller', () => {
  let user;
  let adminUser;
  let token;
  let adminToken;
  let product;
  let cart;

  beforeEach(async () => {
    // Create test users and products
    user = await createTestUser();
    adminUser = await createTestUser({ 
      email: 'admin@example.com', 
      role: 'admin' 
    });
    token = user.generateAuthToken();
    adminToken = adminUser.generateAuthToken();
    product = await createTestProduct();

    // Create cart with items
    cart = new Cart({
      user: user._id,
      items: [{
        product: product._id,
        quantity: 2,
        price: product.price
      }]
    });
    await cart.save();
  });

  describe('POST /api/orders', () => {
    const validOrderData = {
      shippingAddress: {
        street: '123 Main St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      paymentMethod: 'card'
    };

    it('should create order from cart', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrderData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.toString()).toBe(user._id.toString());
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].product.toString()).toBe(product._id.toString());
      expect(res.body.data.status).toBe('pending');
    });

    it('should calculate total amount correctly', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrderData)
        .expect(201);

      const expectedTotal = product.price * 2;
      expect(res.body.data.totalAmount).toBe(expectedTotal);
    });

    it('should clear cart after order creation', async () => {
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrderData);

      const updatedCart = await Cart.findOne({ user: user._id });
      expect(updatedCart.items).toHaveLength(0);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should require items in cart', async () => {
      // Clear cart first
      await Cart.findOneAndUpdate(
        { user: user._id },
        { items: [] }
      );

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrderData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('empty');
    });

    it('should check product stock availability', async () => {
      // Update product stock to less than cart quantity
      await Product.findByIdAndUpdate(product._id, { stock: 1 });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrderData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('stock');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/orders')
        .send(validOrderData)
        .expect(401);
    });
  });

  describe('GET /api/orders', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 2,
          price: product.price
        }],
        totalAmount: product.price * 2,
        shippingAddress: {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'card'
      });
      await order.save();
    });

    it('should get user orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].user.toString()).toBe(user._id.toString());
    });

    it('should support pagination', async () => {
      // Create multiple orders
      for (let i = 0; i < 5; i++) {
        const newOrder = new Order({
          user: user._id,
          items: [{
            product: product._id,
            quantity: 1,
            price: product.price
          }],
          totalAmount: product.price,
          shippingAddress: {
            street: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          },
          paymentMethod: 'card'
        });
        await newOrder.save();
      }

      const res = await request(app)
        .get('/api/orders?page=1&limit=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.totalPages).toBeGreaterThan(1);
    });

    it('should filter by status', async () => {
      // Create order with different status
      const completedOrder = new Order({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 1,
          price: product.price
        }],
        totalAmount: product.price,
        status: 'delivered',
        shippingAddress: {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'card'
      });
      await completedOrder.save();

      const res = await request(app)
        .get('/api/orders?status=delivered')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('delivered');
    });

    it('should only return user own orders', async () => {
      // Create order for another user
      const anotherUser = await createTestUser({ email: 'another@example.com' });
      const anotherOrder = new Order({
        user: anotherUser._id,
        items: [{
          product: product._id,
          quantity: 1,
          price: product.price
        }],
        totalAmount: product.price,
        shippingAddress: {
          street: '456 Other St',
          city: 'Other City',
          state: 'Other State',
          zipCode: '67890',
          country: 'Other Country'
        },
        paymentMethod: 'cash'
      });
      await anotherOrder.save();

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].user.toString()).toBe(user._id.toString());
    });
  });

  describe('GET /api/orders/:id', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 2,
          price: product.price
        }],
        totalAmount: product.price * 2,
        shippingAddress: {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'card'
      });
      await order.save();
    });

    it('should get specific order', async () => {
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(order._id.toString());
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should populate product details', async () => {
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.items[0].product.name).toBeDefined();
      expect(res.body.data.items[0].product.price).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should not allow access to other user orders', async () => {
      const anotherUser = await createTestUser({ email: 'another@example.com' });
      const anotherOrder = new Order({
        user: anotherUser._id,
        items: [{
          product: product._id,
          quantity: 1,
          price: product.price
        }],
        totalAmount: product.price,
        shippingAddress: {
          street: '456 Other St',
          city: 'Other City',
          state: 'Other State',
          zipCode: '67890',
          country: 'Other Country'
        },
        paymentMethod: 'cash'
      });
      await anotherOrder.save();

      await request(app)
        .get(`/api/orders/${anotherOrder._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 2,
          price: product.price
        }],
        totalAmount: product.price * 2,
        shippingAddress: {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'card'
      });
      await order.save();
    });

    it('should allow admin to update order status', async () => {
      const res = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('shipped');
    });

    it('should not allow regular user to update order status', async () => {
      await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' })
        .expect(403);
    });

    it('should validate status value', async () => {
      const res = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .put(`/api/orders/${fakeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(404);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: user._id,
        items: [{
          product: product._id,
          quantity: 2,
          price: product.price
        }],
        totalAmount: product.price * 2,
        shippingAddress: {
          street: '123 Main St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'card'
      });
      await order.save();
    });

    it('should allow user to cancel pending order', async () => {
      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('cancelled');
    });

    it('should not allow canceling shipped order', async () => {
      await Order.findByIdAndUpdate(order._id, { status: 'shipped' });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot be cancelled');
    });

    it('should restore product stock when canceling order', async () => {
      const originalStock = product.stock;
      
      await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.stock).toBe(originalStock + 2);
    });

    it('should not allow access to other user orders', async () => {
      const anotherUser = await createTestUser({ email: 'another@example.com' });
      const anotherOrder = new Order({
        user: anotherUser._id,
        items: [{
          product: product._id,
          quantity: 1,
          price: product.price
        }],
        totalAmount: product.price,
        shippingAddress: {
          street: '456 Other St',
          city: 'Other City',
          state: 'Other State',
          zipCode: '67890',
          country: 'Other Country'
        },
        paymentMethod: 'cash'
      });
      await anotherOrder.save();

      await request(app)
        .delete(`/api/orders/${anotherOrder._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
