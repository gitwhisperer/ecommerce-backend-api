/**
 * User Controller Tests
 * Comprehensive test suite for user management functionality
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
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

describe('User Controller', () => {
  let user;
  let adminUser;
  let token;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser();
    adminUser = await createTestUser({ 
      email: 'admin@example.com', 
      role: 'admin' 
    });
    token = user.generateAuthToken();
    adminToken = adminUser.generateAuthToken();
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(user.email);
      expect(res.body.data.name).toBe(user.name);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '+1234567890'
      };

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updateData.name);
      expect(res.body.data.phone).toBe(updateData.phone);
    });

    it('should not update email', async () => {
      const originalEmail = user.email;
      const updateData = {
        email: 'newemail@example.com',
        name: 'Updated Name'
      };

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.email).toBe(originalEmail);
      expect(res.body.data.name).toBe(updateData.name);
    });

    it('should validate input data', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '', // Empty name should fail validation
          phone: 'invalid-phone'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/users/profile')
        .send({ name: 'Updated Name' })
        .expect(401);
    });
  });

  describe('PUT /api/users/change-password', () => {
    it('should change user password', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123'
      };

      const res = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('changed');
    });

    it('should verify current password', async () => {
      const passwordData = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123'
      };

      const res = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('current password');
    });

    it('should validate password confirmation', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newPassword123',
        confirmPassword: 'differentPassword'
      };

      const res = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should validate password strength', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: '123', // Too weak
        confirmPassword: '123'
      };

      const res = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/users/change-password')
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123'
        })
        .expect(401);
    });
  });

  describe('DELETE /api/users/account', () => {
    it('should deactivate user account', async () => {
      const res = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'password123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deactivated');

      // Verify user is deactivated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isActive).toBe(false);
    });

    it('should verify password before deactivation', async () => {
      const res = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrongPassword' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('password');
    });

    it('should require password', async () => {
      const res = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/users/account')
        .send({ password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /api/users/addresses', () => {
    beforeEach(async () => {
      // Add addresses to user
      user.addresses = [
        {
          type: 'home',
          street: '123 Home St',
          city: 'Home City',
          state: 'Home State',
          zipCode: '12345',
          country: 'Home Country'
        },
        {
          type: 'work',
          street: '456 Work Ave',
          city: 'Work City',
          state: 'Work State',
          zipCode: '67890',
          country: 'Work Country'
        }
      ];
      await user.save();
    });

    it('should get user addresses', async () => {
      const res = await request(app)
        .get('/api/users/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].type).toBe('home');
      expect(res.body.data[1].type).toBe('work');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/users/addresses')
        .expect(401);
    });
  });

  describe('POST /api/users/addresses', () => {
    const validAddress = {
      type: 'home',
      street: '789 New St',
      city: 'New City',
      state: 'New State',
      zipCode: '13579',
      country: 'New Country'
    };

    it('should add new address', async () => {
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.addresses).toHaveLength(1);
      expect(res.body.data.addresses[0].type).toBe(validAddress.type);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should validate address type', async () => {
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validAddress,
          type: 'invalid_type'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/users/addresses')
        .send(validAddress)
        .expect(401);
    });
  });

  describe('PUT /api/users/addresses/:addressId', () => {
    let addressId;

    beforeEach(async () => {
      user.addresses = [{
        type: 'home',
        street: '123 Old St',
        city: 'Old City',
        state: 'Old State',
        zipCode: '12345',
        country: 'Old Country'
      }];
      await user.save();
      addressId = user.addresses[0]._id;
    });

    it('should update address', async () => {
      const updateData = {
        street: '123 Updated St',
        city: 'Updated City'
      };

      const res = await request(app)
        .put(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.success).toBe(true);
      const updatedAddress = res.body.data.addresses.find(addr => addr._id.toString() === addressId.toString());
      expect(updatedAddress.street).toBe(updateData.street);
      expect(updatedAddress.city).toBe(updateData.city);
    });

    it('should return 404 for non-existent address', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .put(`/api/users/addresses/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ street: 'Updated St' })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/users/addresses/${addressId}`)
        .send({ street: 'Updated St' })
        .expect(401);
    });
  });

  describe('DELETE /api/users/addresses/:addressId', () => {
    let addressId;

    beforeEach(async () => {
      user.addresses = [
        {
          type: 'home',
          street: '123 Home St',
          city: 'Home City',
          state: 'Home State',
          zipCode: '12345',
          country: 'Home Country'
        },
        {
          type: 'work',
          street: '456 Work Ave',
          city: 'Work City',
          state: 'Work State',
          zipCode: '67890',
          country: 'Work Country'
        }
      ];
      await user.save();
      addressId = user.addresses[0]._id;
    });

    it('should delete address', async () => {
      const res = await request(app)
        .delete(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.addresses).toHaveLength(1);
      expect(res.body.data.addresses[0].type).toBe('work');
    });

    it('should return 404 for non-existent address', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .delete(`/api/users/addresses/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/users/addresses/${addressId}`)
        .expect(401);
    });
  });

  // Admin-only routes
  describe('Admin Routes', () => {
    describe('GET /api/users', () => {
      beforeEach(async () => {
        // Create additional users
        await createTestUser({ email: 'user2@example.com' });
        await createTestUser({ email: 'user3@example.com' });
      });

      it('should allow admin to get all users', async () => {
        const res = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(2);
      });

      it('should support pagination', async () => {
        const res = await request(app)
          .get('/api/users?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data).toHaveLength(2);
        expect(res.body.pagination).toBeDefined();
      });

      it('should not allow regular user access', async () => {
        await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/users')
          .expect(401);
      });
    });

    describe('GET /api/users/:id', () => {
      it('should allow admin to get specific user', async () => {
        const res = await request(app)
          .get(`/api/users/${user._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data._id.toString()).toBe(user._id.toString());
        expect(res.body.data.password).toBeUndefined();
      });

      it('should return 404 for non-existent user', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        await request(app)
          .get(`/api/users/${fakeId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should not allow regular user access', async () => {
        await request(app)
          .get(`/api/users/${user._id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      });
    });

    describe('PUT /api/users/:id/role', () => {
      it('should allow admin to update user role', async () => {
        const res = await request(app)
          .put(`/api/users/${user._id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'admin' })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.role).toBe('admin');
      });

      it('should validate role value', async () => {
        const res = await request(app)
          .put(`/api/users/${user._id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'invalid_role' })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.errors).toBeDefined();
      });

      it('should not allow regular user access', async () => {
        await request(app)
          .put(`/api/users/${user._id}/role`)
          .set('Authorization', `Bearer ${token}`)
          .send({ role: 'admin' })
          .expect(403);
      });
    });

    describe('PUT /api/users/:id/status', () => {
      it('should allow admin to activate/deactivate user', async () => {
        const res = await request(app)
          .put(`/api/users/${user._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: false })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.isActive).toBe(false);
      });

      it('should validate status value', async () => {
        const res = await request(app)
          .put(`/api/users/${user._id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: 'invalid' })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.errors).toBeDefined();
      });

      it('should not allow regular user access', async () => {
        await request(app)
          .put(`/api/users/${user._id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ isActive: false })
          .expect(403);
      });
    });
  });
});
