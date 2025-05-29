/**
 * Middleware Tests
 * Comprehensive test suite for middleware functionality
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body } = require('express-validator');
const { setupTestDB, cleanupTestDB, createTestUser } = require('./setup');

// Setup and teardown
beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Authentication Middleware', () => {
  let user;
  let adminUser;
  let token;
  let adminToken;
  let app;

  beforeEach(async () => {
    user = await createTestUser();
    adminUser = await createTestUser({ 
      email: 'admin@example.com', 
      role: 'admin' 
    });
    token = user.generateAuthToken();
    adminToken = adminUser.generateAuthToken();

    // Create test app
    app = express();
    app.use(express.json());
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', async () => {
      app.get('/test', authenticate, (req, res) => {
        res.json({ userId: req.user.id });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.userId).toBe(user._id.toString());
    });

    it('should reject missing token', async () => {
      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('token');
    });

    it('should reject invalid token', async () => {
      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject malformed authorization header', async () => {
      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject token for non-existent user', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      const fakeToken = jwt.sign(
        { id: fakeUserId },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject token for inactive user', async () => {
      // Deactivate user
      await User.findByIdAndUpdate(user._id, { isActive: false });

      app.get('/test', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });
  });

  describe('isAdmin middleware', () => {
    it('should allow admin access', async () => {
      app.get('/admin-test', authenticate, isAdmin, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/admin-test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should deny regular user access', async () => {
      app.get('/admin-test', authenticate, isAdmin, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/admin-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('admin');
    });

    it('should require authentication first', async () => {
      app.get('/admin-test', authenticate, isAdmin, (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/admin-test')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});

describe('Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validate middleware', () => {
    it('should pass valid data', async () => {
      app.post('/test',
        body('email').isEmail(),
        body('name').notEmpty(),
        validate,
        (req, res) => {
          res.json({ success: true });
        }
      );

      const res = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          name: 'Test User'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject invalid data', async () => {
      app.post('/test',
        body('email').isEmail(),
        body('name').notEmpty(),
        validate,
        (req, res) => {
          res.json({ success: true });
        }
      );

      const res = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          name: ''
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('should provide detailed error messages', async () => {
      app.post('/test',
        body('email').isEmail().withMessage('Must be a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Must be at least 6 characters'),
        validate,
        (req, res) => {
          res.json({ success: true });
        }
      );

      const res = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: '123'
        })
        .expect(400);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Must be a valid email'
        })
      );
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'password',
          message: 'Must be at least 6 characters'
        })
      );
    });

    it('should handle nested validation', async () => {
      app.post('/test',
        body('user.email').isEmail(),
        body('user.profile.age').isInt({ min: 0 }),
        validate,
        (req, res) => {
          res.json({ success: true });
        }
      );

      const res = await request(app)
        .post('/test')
        .send({
          user: {
            email: 'invalid-email',
            profile: {
              age: -5
            }
          }
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle optional fields correctly', async () => {
      app.post('/test',
        body('required').notEmpty(),
        body('optional').optional().isEmail(),
        validate,
        (req, res) => {
          res.json({ success: true });
        }
      );

      // Should pass with only required field
      const res1 = await request(app)
        .post('/test')
        .send({ required: 'value' })
        .expect(200);

      expect(res1.body.success).toBe(true);

      // Should pass with both fields valid
      const res2 = await request(app)
        .post('/test')
        .send({
          required: 'value',
          optional: 'test@example.com'
        })
        .expect(200);

      expect(res2.body.success).toBe(true);

      // Should fail with invalid optional field
      const res3 = await request(app)
        .post('/test')
        .send({
          required: 'value',
          optional: 'invalid-email'
        })
        .expect(400);

      expect(res3.body.success).toBe(false);
    });
  });
});

describe('Error Handling Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Import error handling middleware
    const errorHandler = require('../middleware/errorHandler');
    const notFound = require('../middleware/notFound');
    
    // Test routes
    app.get('/error', (req, res, next) => {
      const error = new Error('Test error');
      error.statusCode = 500;
      next(error);
    });
    
    app.get('/validation-error', (req, res, next) => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = {
        email: { message: 'Email is required' }
      };
      next(error);
    });
    
    app.get('/cast-error', (req, res, next) => {
      const error = new Error('Cast failed');
      error.name = 'CastError';
      error.path = '_id';
      error.value = 'invalid-id';
      next(error);
    });
    
    app.get('/duplicate-error', (req, res, next) => {
      const error = new Error('Duplicate key');
      error.code = 11000;
      error.keyValue = { email: 'test@example.com' };
      next(error);
    });
    
    // Apply middleware
    app.use(notFound);
    app.use(errorHandler);
  });

  describe('errorHandler middleware', () => {
    it('should handle generic errors', async () => {
      const res = await request(app)
        .get('/error')
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Test error');
    });

    it('should handle validation errors', async () => {
      const res = await request(app)
        .get('/validation-error')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation');
      expect(res.body.errors).toBeDefined();
    });

    it('should handle cast errors', async () => {
      const res = await request(app)
        .get('/cast-error')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should handle duplicate key errors', async () => {
      const res = await request(app)
        .get('/duplicate-error')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should handle production vs development environments', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test development environment
      process.env.NODE_ENV = 'development';
      const devRes = await request(app)
        .get('/error')
        .expect(500);
      
      expect(devRes.body.stack).toBeDefined();
      
      // Test production environment
      process.env.NODE_ENV = 'production';
      const prodRes = await request(app)
        .get('/error')
        .expect(500);
      
      expect(prodRes.body.stack).toBeUndefined();
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFound middleware', () => {
    it('should handle 404 errors', async () => {
      const res = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });
});
