/**
 * Authentication Routes
 * Routes for user authentication and profile management
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  refreshToken
} = require('../controllers/authController');

// Import middleware
const { authenticate } = require('../middleware/auth');
const {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate
} = require('../middleware/validation');

// Public routes
router.post('/register', validateUserRegistration, registerUser);
router.post('/login', validateUserLogin, loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getCurrentUser);
router.put('/profile', validateUserUpdate, updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

module.exports = router;
