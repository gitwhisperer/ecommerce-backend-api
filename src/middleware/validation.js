/**
 * Validation Middleware
 * Input validation using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      error: {
        name: 'ValidationError',
        message: 'Validation failed',
        validationErrors: errorMessages
      }
    });
  }
  
  next();
};

// User validation rules
const validateUserRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
    
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
    
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

const validateUserUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
    
  body('email')
    .optional()
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
    
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
    
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
    
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
    
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
    
  body('address.zipCode')
    .optional()
    .trim()
    .isPostalCode('any')
    .withMessage('Please provide a valid postal code'),
    
  handleValidationErrors
];

// Product validation rules
const validateProductCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Product name must be between 2 and 200 characters'),
    
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required')
    .isLength({ max: 2000 })
    .withMessage('Product description cannot exceed 2000 characters'),
    
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .toFloat(),
    
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number')
    .toFloat(),
    
  body('category')
    .notEmpty()
    .withMessage('Product category is required')
    .isIn(['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Food & Beverages', 'Health', 'Other'])
    .withMessage('Invalid product category'),
    
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),
    
  body('images')
    .isArray({ min: 1 })
    .withMessage('At least one product image is required'),
    
  body('images.*')
    .isURL()
    .withMessage('Each image must be a valid URL'),
    
  body('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand name cannot exceed 100 characters'),
    
  handleValidationErrors
];

const validateProductUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Product name must be between 2 and 200 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Product description cannot exceed 2000 characters'),
    
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .toFloat(),
    
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number')
    .toFloat(),
    
  body('category')
    .optional()
    .isIn(['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Food & Beverages', 'Health', 'Other'])
    .withMessage('Invalid product category'),
    
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),
    
  body('images')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one product image is required'),
    
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL'),
    
  handleValidationErrors
];

// Cart validation rules
const validateAddToCart = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID format'),
    
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be between 1 and 99')
    .toInt(),
    
  handleValidationErrors
];

const validateUpdateCartItem = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID format'),
    
  body('quantity')
    .isInt({ min: 1, max: 99 })
    .withMessage('Quantity must be between 1 and 99')
    .toInt(),
    
  handleValidationErrors
];

// Order validation rules
const validateOrderCreation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
    
  body('items.*.product')
    .isMongoId()
    .withMessage('Invalid product ID format'),
    
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1')
    .toInt(),
    
  body('shippingAddress.firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
    
  body('shippingAddress.lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
    
  body('shippingAddress.email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Valid email is required'),
    
  body('shippingAddress.phone')
    .trim()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
    
  body('shippingAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Street address is required'),
    
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
    
  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
    
  body('shippingAddress.zipCode')
    .trim()
    .isPostalCode('any')
    .withMessage('Valid postal code is required'),
    
  body('paymentInfo.method')
    .isIn(['stripe', 'razorpay', 'cod'])
    .withMessage('Invalid payment method'),
    
  handleValidationErrors
];

// General validation rules
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
    
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'createdAt', 'rating'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
    
  handleValidationErrors
];

const validateProductSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
    
  query('category')
    .optional()
    .isIn(['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Food & Beverages', 'Health', 'Other'])
    .withMessage('Invalid category'),
    
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number')
    .toFloat(),
    
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number')
    .toFloat(),
    
  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5')
    .toFloat(),
    
  ...validatePagination
];

module.exports = {
  validate: handleValidationErrors, // Alias for backward compatibility
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateProductCreation,
  validateProductUpdate,
  validateAddToCart,
  validateUpdateCartItem,
  validateOrderCreation,
  validateObjectId,
  validatePagination,
  validateProductSearch
};
