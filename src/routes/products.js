/**
 * Product Routes
 * Routes for product management and search
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getFeaturedProducts,
  getRelatedProducts,
  addProductReview,
  getProductReviews,
  updateStock,
  searchProducts
} = require('../controllers/productController');

// Import middleware
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const {
  validateProductCreation,
  validateProductUpdate,
  validateObjectId,
  validateProductSearch
} = require('../middleware/validation');

// Public routes
router.get('/', validateProductSearch, getProducts);
router.get('/search', validateProductSearch, searchProducts);
router.get('/categories', getCategories);
router.get('/featured', getFeaturedProducts);
router.get('/:id', validateObjectId, getProductById);
router.get('/:id/related', validateObjectId, getRelatedProducts);
router.get('/:id/reviews', validateObjectId, getProductReviews);

// Protected routes - require authentication
router.use(authenticate);

// User routes (authenticated users)
router.post('/:id/reviews', validateObjectId, addProductReview);

// Admin routes - require admin privileges
router.post('/', requireAdmin, validateProductCreation, createProduct);
router.put('/:id', requireAdmin, validateObjectId, validateProductUpdate, updateProduct);
router.delete('/:id', requireAdmin, validateObjectId, deleteProduct);
router.patch('/:id/stock', requireAdmin, validateObjectId, updateStock);

module.exports = router;
