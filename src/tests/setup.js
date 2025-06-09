/**
 * Test Setup Configuration
 * Global test configuration and utilities
 */

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup test database
const setupTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

// Cleanup test database
const cleanupTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
};

// Clear all collections
const clearCollections = async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

// Create test user
const createTestUser = async (userData = {}) => {
  const User = require('../models/User');
  
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'user',
    ...userData
  };
  
  const user = await User.create(defaultUser);
  return user;
};

// Create test admin
const createTestAdmin = async (userData = {}) => {
  return createTestUser({
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    ...userData
  });
};

// Create test product
const createTestProduct = async (productData = {}) => {
  const Product = require('../models/Product');
  const User = require('../models/User');
  
  // Create admin user if not provided
  let createdBy = productData.createdBy;
  if (!createdBy) {
    const admin = await createTestAdmin();
    createdBy = admin._id;
  }
  
  const defaultProduct = {
    name: 'Test Product',
    description: 'This is a test product description',
    price: 99.99,
    category: 'Electronics',
    stock: 10,
    images: ['https://example.com/image1.jpg'],
    createdBy,
    ...productData
  };
  
  const product = await Product.create(defaultProduct);
  return product;
};

// Generate JWT token for testing
const generateTestToken = (userId) => {
  const { generateToken } = require('../middleware/auth');
  return generateToken(userId);
};

// Common test data
const testData = {
  validUser: {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    phone: '+1234567890',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'Test Country'
    }
  },
  
  validProduct: {
    name: 'Sample Product',
    description: 'This is a sample product for testing',
    price: 49.99,
    originalPrice: 59.99,
    category: 'Electronics',
    subcategory: 'Smartphones',
    brand: 'TestBrand',
    stock: 100,
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg'
    ],
    tags: ['electronics', 'smartphone', 'mobile'],
    specifications: new Map([
      ['Color', 'Black'],
      ['Storage', '128GB'],
      ['RAM', '8GB']
    ])
  },
  
  validOrder: {
    items: [
      {
        product: null, // Will be set in tests
        quantity: 2
      }
    ],
    shippingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'Test Country'
    },
    paymentInfo: {
      method: 'stripe',
      currency: 'INR'
    }
  }
};

// API response helpers
const expectSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(true);
};

const expectError = (response, statusCode = 400) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
};

const expectValidationError = (response) => {
  expectError(response, 400);
  expect(response.body.error.name).toBe('ValidationError');
};

const expectUnauthorizedError = (response) => {
  expectError(response, 401);
};

const expectNotFoundError = (response) => {
  expectError(response, 404);
};

module.exports = {
  setupTestDB,
  cleanupTestDB,
  clearCollections,
  createTestUser,
  createTestAdmin,
  createTestProduct,
  generateTestToken,
  testData,
  expectSuccess,
  expectError,
  expectValidationError,
  expectUnauthorizedError,
  expectNotFoundError
};
