/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error Stack:', err.stack);
  console.error('Error Details:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID format';
    error = {
      name: 'ValidationError',
      message,
      statusCode: 400
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyValue)[0];
    const message = `${duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1)} already exists`;
    error = {
      name: 'DuplicateError',  
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = {
      name: 'ValidationError',
      message: messages.join('. '),
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      name: 'AuthenticationError',
      message: 'Invalid token. Please login again.',
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      name: 'AuthenticationError',
      message: 'Token expired. Please login again.',
      statusCode: 401
    };
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      name: 'FileUploadError',
      message: 'File size too large. Maximum size allowed is 5MB.',
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = {
      name: 'FileUploadError',
      message: 'Too many files. Maximum 5 files allowed.',
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      name: 'FileUploadError',
      message: 'Unexpected file field.',
      statusCode: 400
    };
  }

  // Payment gateway errors
  if (err.type === 'StripeCardError') {
    error = {
      name: 'PaymentError',
      message: err.message || 'Payment failed. Please check your card details.',
      statusCode: 400
    };
  }

  if (err.type === 'StripeInvalidRequestError') {
    error = {
      name: 'PaymentError',
      message: 'Invalid payment request.',
      statusCode: 400
    };
  }

  // Custom application errors
  if (err.name === 'InsufficientStockError') {
    error = {
      name: 'StockError',
      message: err.message || 'Insufficient stock for requested quantity.',
      statusCode: 400
    };
  }

  if (err.name === 'OrderNotFoundError') {
    error = {
      name: 'NotFoundError',
      message: err.message || 'Order not found.',
      statusCode: 404
    };
  }

  if (err.name === 'ProductNotFoundError') {
    error = {
      name: 'NotFoundError',
      message: err.message || 'Product not found.',
      statusCode: 404
    };
  }

  // Default server error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      name: error.name || 'ServerError',
      message: message
    }
  };

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = {
      originalError: err.name,
      statusCode: statusCode
    };
  }

  // Add validation errors if available
  if (err.name === 'ValidationError' && err.errors) {
    errorResponse.error.validationErrors = Object.keys(err.errors).map(field => ({
      field,
      message: err.errors[field].message,
      value: err.errors[field].value
    }));
  }

  // Rate limiting error
  if (statusCode === 429) {
    errorResponse.error.retryAfter = err.retryAfter || 900; // 15 minutes default
  }

  res.status(statusCode).json(errorResponse);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create custom error class
class AppError extends Error {
  constructor(message, statusCode = 500, name = 'AppError') {
    super(message);
    this.statusCode = statusCode;
    this.name = name;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'ValidationError');
    this.field = field;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NotFoundError');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 401, 'UnauthorizedError');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'ForbiddenError');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'ConflictError');
  }
}

class InsufficientStockError extends AppError {
  constructor(productName, available, requested) {
    const message = `Insufficient stock for ${productName}. Available: ${available}, Requested: ${requested}`;
    super(message, 400, 'InsufficientStockError');
    this.available = available;
    this.requested = requested;
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 400, 'PaymentError');
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InsufficientStockError,
  PaymentError
};
