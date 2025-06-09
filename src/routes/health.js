/**
 * Health and System Routes
 * Handles health checks, API info, and system statistics
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const {
  getHealthStatus,
  getApiInfo,
  getApiStats
} = require('../controllers/healthController');

/**
 * @route   GET /api/health
 * @desc    Get system health status
 * @access  Public
 */
router.get('/health', getHealthStatus);

/**
 * @route   GET /api/info
 * @desc    Get API information and features
 * @access  Public
 */
router.get('/info', getApiInfo);

/**
 * @route   GET /api/stats
 * @desc    Get API statistics (admin only)
 * @access  Private/Admin
 */
router.get('/stats', authenticate, isAdmin, getApiStats);

module.exports = router;
