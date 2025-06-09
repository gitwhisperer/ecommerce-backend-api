/**
 * Cart Routes
 * Routes for shopping cart management
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
  validateCart,
  moveToWishlist,
  applyCoupon,
  getCartCount
} = require('../controllers/cartController');

// Import middleware
const { authenticate } = require('../middleware/auth');
const {
  validateAddToCart,
  validateUpdateCartItem,
  validateObjectId
} = require('../middleware/validation');

// All cart routes require authentication
router.use(authenticate);

// Cart management routes
router.get('/', getCart);
router.get('/summary', getCartSummary);
router.get('/count', getCartCount);
router.post('/add', validateAddToCart, addToCart);
router.put('/update', validateUpdateCartItem, updateCartItem);
router.delete('/remove/:productId', validateObjectId, removeFromCart);
router.delete('/clear', clearCart);

// Cart utility routes
router.post('/validate', validateCart);
router.post('/move-to-wishlist', moveToWishlist);
router.post('/apply-coupon', applyCoupon);

module.exports = router;
