/**
 * Main server file for E-commerce API
 * Initializes Express app, connects to MongoDB, and starts the server
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const cartRoutes = require('./src/routes/cart');
const orderRoutes = require('./src/routes/orders');
const paymentRoutes = require('./src/routes/payments');
const userRoutes = require('./src/routes/users');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses in production
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);

// Health and system routes
const healthRoutes = require('./src/routes/health');
app.use('/api', healthRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to E-commerce API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes for better performance
    await createIndexes();
    
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Create database indexes for performance optimization
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    
    // Products collection indexes
    await db.collection('products').createIndex({ name: 'text', description: 'text' });
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ price: 1 });
    await db.collection('products').createIndex({ createdAt: -1 });
    
    // Orders collection indexes
    await db.collection('orders').createIndex({ user: 1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    
    // Cart collection indexes
    await db.collection('carts').createIndex({ user: 1 }, { unique: true });
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    server.close(() => {
      console.log('Process terminated');
      mongoose.connection.close();
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received');
    server.close(() => {
      console.log('Process terminated');
      mongoose.connection.close();
    });
  });

  return server;
};

// Only start server if this file is run directly (not in tests)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
