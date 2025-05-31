/**
 * Payment Controller Tests
 * Comprehensive test suite for payment functionality
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { setupTestDB, cleanupTestDB, createTestUser, createTestProduct } = require('./setup');

// Mock Stripe and Razorpay
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123456789',
        client_secret: 'pi_test_123456789_secret_test',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123456789',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd'
      })
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123456789',
            metadata: {
              orderId: '507f1f77bcf86cd799439011'
            }
          }
        }
      })
    }
  }));
});

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test_123456789',
        entity: 'order',
        amount: 200000,
        currency: 'INR',
        receipt: 'order_rcptid_11',
        status: 'created'
      })
    },
    payments: {
      fetch: jest.fn().mockResolvedValue({
        id: 'pay_test_123456789',
        entity: 'payment',
        amount: 200000,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_test_123456789'
      })
    },
    utility: {
      verifyPaymentSignature: jest.fn().mockReturnValue(true)
    }
  }));
});

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
  await Order.deleteMany({});
  jest.clearAllMocks();
});

describe('Payment Controller', () => {
  let user;
  let token;
  let product;
  let order;

  beforeEach(async () => {
    // Create test user and product
    user = await createTestUser();
    token = user.generateAuthToken();
    product = await createTestProduct();

    // Create test order
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

  describe('POST /api/payments/stripe/create-payment-intent', () => {
    it('should create stripe payment intent', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: order._id,
          currency: 'usd'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.clientSecret).toBeDefined();
      expect(res.body.data.paymentIntentId).toBeDefined();
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: fakeId,
          currency: 'usd'
        })
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
        paymentMethod: 'card'
      });
      await anotherOrder.save();

      await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: anotherOrder._id,
          currency: 'usd'
        })
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/payments/stripe/create-payment-intent')
        .send({
          orderId: order._id,
          currency: 'usd'
        })
        .expect(401);
    });
  });

  describe('POST /api/payments/stripe/confirm-payment', () => {
    it('should confirm stripe payment', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentIntentId: 'pi_test_123456789',
          orderId: order._id
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('succeeded');
    });

    it('should update order payment status', async () => {
      await request(app)
        .post('/api/payments/stripe/confirm-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentIntentId: 'pi_test_123456789',
          orderId: order._id
        });

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('paid');
      expect(updatedOrder.paymentIntentId).toBe('pi_test_123456789');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('POST /api/payments/razorpay/create-order', () => {
    it('should create razorpay order', async () => {
      const res = await request(app)
        .post('/api/payments/razorpay/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: order._id,
          currency: 'INR'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.amount).toBeDefined();
      expect(res.body.data.currency).toBe('INR');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/razorpay/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .post('/api/payments/razorpay/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: fakeId,
          currency: 'INR'
        })
        .expect(404);
    });
  });

  describe('POST /api/payments/razorpay/verify-payment', () => {
    it('should verify razorpay payment', async () => {
      const res = await request(app)
        .post('/api/payments/razorpay/verify-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: order._id,
          paymentId: 'pay_test_123456789',
          razorpayOrderId: 'order_test_123456789',
          signature: 'test_signature'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verified');
    });

    it('should update order payment status on verification', async () => {
      await request(app)
        .post('/api/payments/razorpay/verify-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: order._id,
          paymentId: 'pay_test_123456789',
          razorpayOrderId: 'order_test_123456789',
          signature: 'test_signature'
        });

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('paid');
      expect(updatedOrder.razorpayPaymentId).toBe('pay_test_123456789');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/razorpay/verify-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('POST /api/payments/stripe/webhook', () => {
    it('should handle stripe webhook', async () => {
      const webhookPayload = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123456789',
            metadata: {
              orderId: order._id.toString()
            }
          }
        }
      });

      const res = await request(app)
        .post('/api/payments/stripe/webhook')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it('should update order on successful payment webhook', async () => {
      const webhookPayload = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123456789',
            metadata: {
              orderId: order._id.toString()
            }
          }
        }
      });

      await request(app)
        .post('/api/payments/stripe/webhook')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload);

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('paid');
    });
  });

  describe('GET /api/payments/order/:orderId', () => {
    beforeEach(async () => {
      // Update order with payment info
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        paymentIntentId: 'pi_test_123456789'
      });
    });

    it('should get payment status for order', async () => {
      const res = await request(app)
        .get(`/api/payments/order/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.paymentIntentId).toBe('pi_test_123456789');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/payments/order/${fakeId}`)
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
        paymentMethod: 'card'
      });
      await anotherOrder.save();

      await request(app)
        .get(`/api/payments/order/${anotherOrder._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/payments/order/${order._id}`)
        .expect(401);
    });
  });
});
