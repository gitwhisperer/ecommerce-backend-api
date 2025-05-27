/**
 * Authentication Controller Tests
 * Tests for user registration, login, and profile management
 */

const request = require('supertest');
const { app } = require('../../server');
const User = require('../models/User');
const {
  setupTestDB,
  cleanupTestDB,
  clearCollections,
  createTestUser,
  generateTestToken,
  testData,
  expectSuccess,
  expectError,
  expectValidationError,
  expectUnauthorizedError
} = require('./setup');

describe('Auth Controller', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testData.validUser);

      expectSuccess(response, 201);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testData.validUser.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not register user with existing email', async () => {
      await createTestUser({ email: testData.validUser.email });

      const response = await request(app)
        .post('/api/auth/register')
        .send(testData.validUser);

      expectValidationError(response);
      expect(response.body.error.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expectValidationError(response);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testData.validUser,
          email: 'invalid-email'
        });

      expectValidationError(response);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testData.validUser,
          password: '123'
        });

      expectValidationError(response);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await createTestUser(testData.validUser);
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.validUser.email,
          password: testData.validUser.password
        });

      expectSuccess(response);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testData.validUser.password
        });

      expectUnauthorizedError(response);
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.validUser.email,
          password: 'wrongpassword'
        });

      expectUnauthorizedError(response);
    });

    it('should not login inactive user', async () => {
      await User.findByIdAndUpdate(testUser._id, { isActive: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testData.validUser.email,
          password: testData.validUser.password
        });

      expectUnauthorizedError(response);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expectValidationError(response);
    });
  });

  describe('GET /api/auth/profile', () => {
    let testUser, authToken;

    beforeEach(async () => {
      testUser = await createTestUser(testData.validUser);
      authToken = generateTestToken(testUser._id);
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccess(response);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testData.validUser.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expectUnauthorizedError(response);
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expectUnauthorizedError(response);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let testUser, authToken;

    beforeEach(async () => {
      testUser = await createTestUser(testData.validUser);
      authToken = generateTestToken(testUser._id);
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '+9876543210',
        address: {
          street: '456 Updated St',
          city: 'Updated City'
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccess(response);
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.phone).toBe(updateData.phone);
    });

    it('should not update email through profile endpoint', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' });

      expectSuccess(response);
      // Email should not be updated
      expect(response.body.data.user.email).toBe(testData.validUser.email);
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: 'invalid-phone' });

      expectValidationError(response);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    let testUser, authToken;

    beforeEach(async () => {
      testUser = await createTestUser(testData.validUser);
      authToken = generateTestToken(testUser._id);
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testData.validUser.password,
          newPassword: 'newpassword123'
        });

      expectSuccess(response);
    });

    it('should not change password with wrong current password', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expectUnauthorizedError(response);
    });

    it('should validate new password strength', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testData.validUser.password,
          newPassword: '123'
        });

      expectValidationError(response);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await createTestUser(testData.validUser);
    });

    it('should send password reset email for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testData.validUser.email });

      expectSuccess(response);
      expect(response.body.message).toContain('reset');
    });

    it('should return success even for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expectSuccess(response);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expectValidationError(response);
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser, authToken;

    beforeEach(async () => {
      testUser = await createTestUser(testData.validUser);
      authToken = generateTestToken(testUser._id);
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccess(response);
    });
  });
});
