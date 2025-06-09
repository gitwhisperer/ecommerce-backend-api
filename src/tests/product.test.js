/**
 * Product Controller Tests
 * Tests for product CRUD operations and search functionality
 */

const request = require('supertest');
const { app } = require('../../server');
const Product = require('../models/Product');
const {
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
} = require('./setup');

describe('Product Controller', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // Create multiple products for testing
      await createTestProduct({ name: 'Product 1', category: 'Electronics', price: 100 });
      await createTestProduct({ name: 'Product 2', category: 'Clothing', price: 50 });
      await createTestProduct({ name: 'Product 3', category: 'Electronics', price: 200 });
    });

    it('should get all products with pagination', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ page: 1, limit: 2 });

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.totalProducts).toBe(3);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ category: 'Electronics' });

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(2);
    });

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ minPrice: 75, maxPrice: 150 });

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].price).toBe(100);
    });

    it('should sort products by price', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ sortBy: 'price', sortOrder: 'asc' });

      expectSuccess(response);
      expect(response.body.data.products[0].price).toBe(50);
      expect(response.body.data.products[2].price).toBe(200);
    });
  });

  describe('GET /api/products/:id', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await createTestProduct();
    });

    it('should get single product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct._id}`);

      expectSuccess(response);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product._id).toBe(testProduct._id.toString());
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/products/${nonExistentId}`);

      expectNotFoundError(response);
    });

    it('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id');

      expectValidationError(response);
    });
  });

  describe('POST /api/products', () => {
    let adminUser, adminToken;

    beforeEach(async () => {
      adminUser = await createTestAdmin();
      adminToken = generateTestToken(adminUser._id);
    });

    it('should create product as admin', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testData.validProduct);

      expectSuccess(response, 201);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product.name).toBe(testData.validProduct.name);
    });

    it('should not create product as regular user', async () => {
      const regularUser = await createTestUser();
      const userToken = generateTestToken(regularUser._id);

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testData.validProduct);

      expectError(response, 403);
    });

    it('should not create product without authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send(testData.validProduct);

      expectUnauthorizedError(response);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expectValidationError(response);
    });

    it('should validate price is positive', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testData.validProduct,
          price: -10
        });

      expectValidationError(response);
    });

    it('should validate category', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testData.validProduct,
          category: 'InvalidCategory'
        });

      expectValidationError(response);
    });
  });

  describe('PUT /api/products/:id', () => {
    let testProduct, adminUser, adminToken;

    beforeEach(async () => {
      adminUser = await createTestAdmin();
      adminToken = generateTestToken(adminUser._id);
      testProduct = await createTestProduct({ createdBy: adminUser._id });
    });

    it('should update product as admin', async () => {
      const updateData = {
        name: 'Updated Product Name',
        price: 199.99
      };

      const response = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expectSuccess(response);
      expect(response.body.data.product.name).toBe(updateData.name);
      expect(response.body.data.product.price).toBe(updateData.price);
    });

    it('should not update product as regular user', async () => {
      const regularUser = await createTestUser();
      const userToken = generateTestToken(regularUser._id);

      const response = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked Name' });

      expectError(response, 403);
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expectNotFoundError(response);
    });
  });

  describe('DELETE /api/products/:id', () => {
    let testProduct, adminUser, adminToken;

    beforeEach(async () => {
      adminUser = await createTestAdmin();
      adminToken = generateTestToken(adminUser._id);
      testProduct = await createTestProduct({ createdBy: adminUser._id });
    });

    it('should delete product as admin (soft delete)', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expectSuccess(response);

      // Verify product is soft deleted
      const deletedProduct = await Product.findById(testProduct._id);
      expect(deletedProduct.isActive).toBe(false);
    });

    it('should not delete product as regular user', async () => {
      const regularUser = await createTestUser();
      const userToken = generateTestToken(regularUser._id);

      const response = await request(app)
        .delete(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expectError(response, 403);
    });
  });

  describe('GET /api/products/categories', () => {
    beforeEach(async () => {
      await createTestProduct({ category: 'Electronics' });
      await createTestProduct({ category: 'Clothing' });
      await createTestProduct({ category: 'Electronics' });
    });

    it('should get product categories with count', async () => {
      const response = await request(app)
        .get('/api/products/categories');

      expectSuccess(response);
      expect(response.body.data.categories).toHaveLength(2);
      
      const electronicsCategory = response.body.data.categories.find(cat => cat.name === 'Electronics');
      expect(electronicsCategory.count).toBe(2);
    });
  });

  describe('GET /api/products/featured', () => {
    beforeEach(async () => {
      await createTestProduct({ isFeatured: true, name: 'Featured 1' });
      await createTestProduct({ isFeatured: false, name: 'Not Featured' });
      await createTestProduct({ isFeatured: true, name: 'Featured 2' });
    });

    it('should get featured products only', async () => {
      const response = await request(app)
        .get('/api/products/featured');

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.products.every(p => p.isFeatured)).toBe(true);
    });

    it('should limit featured products', async () => {
      const response = await request(app)
        .get('/api/products/featured')
        .query({ limit: 1 });

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(1);
    });
  });

  describe('POST /api/products/:id/reviews', () => {
    let testProduct, testUser, userToken;

    beforeEach(async () => {
      testProduct = await createTestProduct();
      testUser = await createTestUser();
      userToken = generateTestToken(testUser._id);
    });

    it('should add product review', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great product!'
      };

      const response = await request(app)
        .post(`/api/products/${testProduct._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData);

      expectSuccess(response, 201);

      // Verify review was added
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.reviews).toHaveLength(1);
      expect(updatedProduct.reviews[0].rating).toBe(5);
    });

    it('should not add review without authentication', async () => {
      const response = await request(app)
        .post(`/api/products/${testProduct._id}/reviews`)
        .send({ rating: 5, comment: 'Test' });

      expectUnauthorizedError(response);
    });

    it('should validate rating range', async () => {
      const response = await request(app)
        .post(`/api/products/${testProduct._id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 6, comment: 'Test' });

      expectValidationError(response);
    });
  });

  describe('GET /api/products/search', () => {
    beforeEach(async () => {
      await createTestProduct({ name: 'iPhone 13', category: 'Electronics' });
      await createTestProduct({ name: 'Samsung Galaxy', category: 'Electronics' });
      await createTestProduct({ name: 'Nike Shoes', category: 'Clothing' });
    });

    it('should search products by query', async () => {
      const response = await request(app)
        .get('/api/products/search')
        .query({ q: 'iPhone' });

      expectSuccess(response);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].name).toContain('iPhone');
    });

    it('should return validation error without query', async () => {
      const response = await request(app)
        .get('/api/products/search');

      expectValidationError(response);
    });
  });
});
