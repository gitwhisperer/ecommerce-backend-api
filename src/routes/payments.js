/**
 * Payment Routes
 * Routes for payment processing
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createStripePaymentIntent,
  confirmStripePayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentWebhook,
  getPaymentMethods
} = require('../controllers/paymentController');

// Import middleware
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/methods', getPaymentMethods);

// Webhook route (must be before authentication middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), handlePaymentWebhook);

// Protected routes - require authentication
router.use(authenticate);

// Stripe routes
router.post('/stripe/create-payment-intent', createStripePaymentIntent);
router.post('/stripe/confirm', confirmStripePayment);

// Razorpay routes
router.post('/razorpay/create-order', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);

module.exports = router;
