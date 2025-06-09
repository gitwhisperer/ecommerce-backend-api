/**
 * Order Routes
 * Routes for order management and tracking
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  getOrderStats,
  addTrackingNumber,
  trackOrder
} = require('../controllers/orderController');

// Import middleware
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  validateOrderCreation,
  validateObjectId,
  validatePagination
} = require('../middleware/validation');

// Public routes
router.get('/track/:trackingNumber', trackOrder);

// Protected routes - require authentication
router.use(authenticate);

// User routes
router.post('/', validateOrderCreation, createOrder);
router.get('/', validatePagination, getUserOrders);
router.get('/:id', validateObjectId, getOrderById);
router.put('/:id/cancel', validateObjectId, cancelOrder);

// Admin routes - require admin privileges
router.get('/admin/all', requireAdmin, validatePagination, getAllOrders);
router.get('/admin/stats', requireAdmin, getOrderStats);
router.put('/:id/status', requireAdmin, validateObjectId, updateOrderStatus);
router.put('/:id/tracking', requireAdmin, validateObjectId, addTrackingNumber);

module.exports = router;
