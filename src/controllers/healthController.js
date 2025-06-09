/**
 * Health Check Controller
 * Provides system health and status endpoints
 */

const mongoose = require('mongoose');
const redis = require('redis');

/**
 * Get system health status
 * @route GET /api/health
 * @access Public
 */
const getHealthStatus = async (req, res) => {
  try {
    const healthData = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // Check MongoDB connection
    try {
      if (mongoose.connection.readyState === 1) {
        healthData.services.mongodb = {
          status: 'UP',
          details: 'Connected to MongoDB'
        };
      } else {
        healthData.services.mongodb = {
          status: 'DOWN',
          details: 'MongoDB connection unavailable'
        };
        healthData.status = 'DEGRADED';
      }
    } catch (error) {
      healthData.services.mongodb = {
        status: 'DOWN',
        details: error.message
      };
      healthData.status = 'DEGRADED';
    }

    // Check Redis connection (if enabled)
    if (process.env.REDIS_URL) {
      try {
        const redisClient = redis.createClient({ url: process.env.REDIS_URL });
        await redisClient.ping();
        healthData.services.redis = {
          status: 'UP',
          details: 'Redis connection active'
        };
        await redisClient.quit();
      } catch (error) {
        healthData.services.redis = {
          status: 'DOWN',
          details: error.message
        };
        healthData.status = 'DEGRADED';
      }
    }

    // System metrics
    healthData.system = {
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      cpu: process.cpuUsage()
    };

    const statusCode = healthData.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (error) {
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * Get API version and basic info
 * @route GET /api/info
 * @access Public
 */
const getApiInfo = (req, res) => {
  res.json({
    name: 'E-commerce API',
    version: process.env.API_VERSION || '1.0.0',
    description: 'Complete E-commerce backend API with authentication, product management, cart, orders, and payments',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'User Authentication (JWT)',
      'Product Management (CRUD)',
      'Shopping Cart',
      'Order Processing',
      'Payment Integration (Stripe/Razorpay)',
      'User Profile Management',
      'Admin Panel',
      'Rate Limiting',
      'Input Validation',
      'Caching Support',
      'Comprehensive Testing'
    ],
    endpoints: {
      authentication: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      payments: '/api/payments',
      users: '/api/users',
      health: '/api/health'
    },
    documentation: '/api/docs'
  });
};

/**
 * Get API statistics (admin only)
 * @route GET /api/stats
 * @access Private/Admin
 */
const getApiStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const Product = require('../models/Product');
    const Order = require('../models/Order');

    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ isActive: true }),
        admin: await User.countDocuments({ role: 'admin' })
      },
      products: {
        total: await Product.countDocuments(),
        active: await Product.countDocuments({ isActive: true }),
        lowStock: await Product.countDocuments({ stock: { $lt: 10 } })
      },
      orders: {
        total: await Order.countDocuments(),
        pending: await Order.countDocuments({ status: 'pending' }),
        completed: await Order.countDocuments({ status: 'completed' }),
        cancelled: await Order.countDocuments({ status: 'cancelled' })
      }
    };

    // Calculate total revenue
    const revenueResult = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    stats.revenue = {
      total: revenueResult.length > 0 ? revenueResult[0].total : 0
    };

    res.json({
      success: true,
      data: stats,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching API statistics',
      error: error.message
    });
  }
};

module.exports = {
  getHealthStatus,
  getApiInfo,
  getApiStats
};
