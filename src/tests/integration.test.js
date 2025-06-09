/**
 * Integration Tests
 * End-to-end testing of complete user flows
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { setupTestDB, cleanupTestDB } = require('./setup');

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

describe('Integration Tests', () => {
  describe('Complete E-commerce Flow', () => {
    let userToken;
    let adminToken;
    let productId;
    let orderId;

    it('should complete full e-commerce user journey', async () => {
      // Step 1: User Registration
      const registrationRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Integration Test User',
          email: 'integration@example.com',
          password: 'password123',
          phone: '+1234567890'
        })
        .expect(201);

      expect(registrationRes.body.success).toBe(true);
      expect(registrationRes.body.token).toBeDefined();
      userToken = registrationRes.body.token;

      // Step 2: Admin Registration
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin User',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin'
        })
        .expect(201);
      adminToken = adminRes.body.token;

      // Step 3: Admin creates a product
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Integration Test Product',
          description: 'A product for integration testing',
          price: 99.99,
          category: 'Electronics',
          stock: 50,
          images: ['https://example.com/image.jpg']
        })
        .expect(201);

      expect(productRes.body.success).toBe(true);
      productId = productRes.body.data._id;

      // Step 4: User browses products
      const browseRes = await request(app)
        .get('/api/products')
        .expect(200);

      expect(browseRes.body.success).toBe(true);
      expect(browseRes.body.data).toHaveLength(1);
      expect(browseRes.body.data[0]._id).toBe(productId);

      // Step 5: User gets product details
      const detailRes = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(detailRes.body.success).toBe(true);
      expect(detailRes.body.data.name).toBe('Integration Test Product');

      // Step 6: User adds product to cart
      const cartAddRes = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 2
        })
        .expect(200);

      expect(cartAddRes.body.success).toBe(true);
      expect(cartAddRes.body.data.items).toHaveLength(1);
      expect(cartAddRes.body.data.items[0].quantity).toBe(2);

      // Step 7: User views cart
      const cartViewRes = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cartViewRes.body.success).toBe(true);
      expect(cartViewRes.body.data.items).toHaveLength(1);
      expect(cartViewRes.body.data.totalAmount).toBe(99.99 * 2);

      // Step 8: User updates cart quantity
      const cartUpdateRes = await request(app)
        .put(`/api/cart/update/${productId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(cartUpdateRes.body.data.items[0].quantity).toBe(3);

      // Step 9: User updates profile with shipping address
      await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'home',
          street: '123 Integration St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        })
        .expect(201);

      // Step 10: User creates order
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          shippingAddress: {
            street: '123 Integration St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          },
          paymentMethod: 'card'
        })
        .expect(201);

      expect(orderRes.body.success).toBe(true);
      expect(orderRes.body.data.items).toHaveLength(1);
      expect(orderRes.body.data.items[0].quantity).toBe(3);
      expect(orderRes.body.data.totalAmount).toBe(99.99 * 3);
      orderId = orderRes.body.data._id;

      // Step 11: Verify cart is cleared after order
      const emptyCartRes = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(emptyCartRes.body.data.items).toHaveLength(0);

      // Step 12: User views order
      const orderViewRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(orderViewRes.body.success).toBe(true);
      expect(orderViewRes.body.data._id).toBe(orderId);

      // Step 13: User creates payment intent
      const paymentRes = await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: orderId,
          currency: 'usd'
        })
        .expect(200);

      expect(paymentRes.body.success).toBe(true);
      expect(paymentRes.body.data.clientSecret).toBeDefined();

      // Step 14: Admin updates order status
      const statusUpdateRes = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(200);

      expect(statusUpdateRes.body.success).toBe(true);
      expect(statusUpdateRes.body.data.status).toBe('shipped');

      // Step 15: User views order history
      const historyRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(historyRes.body.success).toBe(true);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].status).toBe('shipped');

      // Step 16: Check product stock is updated
      const stockCheckRes = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(stockCheckRes.body.data.stock).toBe(47); // 50 - 3
    });
  });

  describe('Multiple User Interaction', () => {
    let user1Token, user2Token, adminToken;
    let productId;

    beforeEach(async () => {
      // Create users
      const user1Res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User One',
          email: 'user1@example.com',
          password: 'password123'
        });
      user1Token = user1Res.body.token;

      const user2Res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User Two',
          email: 'user2@example.com',
          password: 'password123'
        });
      user2Token = user2Res.body.token;

      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin'
        });
      adminToken = adminRes.body.token;

      // Create product
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Shared Product',
          description: 'Product for multiple users',
          price: 50.00,
          category: 'Electronics',
          stock: 10
        });
      productId = productRes.body.data._id;
    });

    it('should handle concurrent cart operations', async () => {
      // Both users add same product to cart
      const user1CartRes = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          productId: productId,
          quantity: 3
        })
        .expect(200);

      const user2CartRes = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          productId: productId,
          quantity: 4
        })
        .expect(200);

      expect(user1CartRes.body.data.items[0].quantity).toBe(3);
      expect(user2CartRes.body.data.items[0].quantity).toBe(4);

      // Verify carts are separate
      const user1CartView = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const user2CartView = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user1CartView.body.data.items[0].quantity).toBe(3);
      expect(user2CartView.body.data.items[0].quantity).toBe(4);
    });

    it('should handle stock conflicts during ordering', async () => {
      // User 1 adds 6 items to cart
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          productId: productId,
          quantity: 6
        });

      // User 2 adds 7 items to cart (total would exceed stock)
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          productId: productId,
          quantity: 7
        });

      // User 1 creates order first
      const user1OrderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          shippingAddress: {
            street: '123 User1 St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          },
          paymentMethod: 'card'
        })
        .expect(201);

      expect(user1OrderRes.body.success).toBe(true);

      // User 2 tries to create order but should fail due to insufficient stock
      const user2OrderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          shippingAddress: {
            street: '456 User2 Ave',
            city: 'Test City',
            state: 'Test State',
            zipCode: '67890',
            country: 'Test Country'
          },
          paymentMethod: 'card'
        })
        .expect(400);

      expect(user2OrderRes.body.success).toBe(false);
      expect(user2OrderRes.body.message).toContain('stock');
    });

    it('should maintain data isolation between users', async () => {
      // Users create different data
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          productId: productId,
          quantity: 1
        });

      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          productId: productId,
          quantity: 2
        });

      // User 1 creates order
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          shippingAddress: {
            street: '123 User1 St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          },
          paymentMethod: 'card'
        });

      // Check that users can only see their own data
      const user1Orders = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const user2Orders = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user1Orders.body.data).toHaveLength(1);
      expect(user2Orders.body.data).toHaveLength(0);

      const user1Cart = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const user2Cart = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user1Cart.body.data.items).toHaveLength(0); // Cleared after order
      expect(user2Cart.body.data.items).toHaveLength(1);
      expect(user2Cart.body.data.items[0].quantity).toBe(2);
    });
  });

  describe('Admin Management Flow', () => {
    let adminToken;
    let userToken;
    let productId;

    beforeEach(async () => {
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin'
        });
      adminToken = adminRes.body.token;

      const userRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Regular User',
          email: 'user@example.com',
          password: 'password123'
        });
      userToken = userRes.body.token;
    });

    it('should handle complete product management lifecycle', async () => {
      // Admin creates product
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Product',
          description: 'Product created by admin',
          price: 75.50,
          category: 'Books',
          stock: 25
        })
        .expect(201);

      productId = createRes.body.data._id;

      // Admin updates product
      const updateRes = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Admin Product',
          price: 80.00,
          stock: 30
        })
        .expect(200);

      expect(updateRes.body.data.name).toBe('Updated Admin Product');
      expect(updateRes.body.data.price).toBe(80.00);

      // User tries to update product (should fail)
      await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Updated Product'
        })
        .expect(403);

      // Admin views all users
      const usersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(usersRes.body.success).toBe(true);
      expect(usersRes.body.data.length).toBeGreaterThanOrEqual(2);

      // User tries to view all users (should fail)
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Admin deletes product
      const deleteRes = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);

      // Verify product is deleted
      await request(app)
        .get(`/api/products/${productId}`)
        .expect(404);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let userToken;
    let productId;

    beforeEach(async () => {
      const userRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });
      userToken = userRes.body.token;

      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin'
        });

      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({
          name: 'Test Product',
          description: 'Product for testing',
          price: 25.00,
          category: 'Test',
          stock: 5
        });
      productId = productRes.body.data._id;
    });

    it('should handle invalid IDs gracefully', async () => {
      const invalidId = 'invalid-id-format';

      await request(app)
        .get(`/api/products/${invalidId}`)
        .expect(400);

      await request(app)
        .get(`/api/orders/${invalidId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });

    it('should handle non-existent resources', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404);

      await request(app)
        .get(`/api/orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should handle out-of-stock scenarios', async () => {
      // Try to add more items than available stock
      const cartRes = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 10 // More than stock (5)
        })
        .expect(400);

      expect(cartRes.body.success).toBe(false);
      expect(cartRes.body.message).toContain('stock');
    });

    it('should handle malformed request data', async () => {
      // Invalid JSON structure
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 'not-a-number'
        })
        .expect(400);

      // Missing required fields
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });
});
