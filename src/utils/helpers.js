/**
 * Response Helper Utility
 * Standardized response format for API endpoints
 */

// Success response helper
const successResponse = (message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return { response, statusCode };
};

// Error response helper
const errorResponse = (message, error = null, statusCode = 400) => {
  const response = {
    success: false,
    error: {
      message
    }
  };

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      response.error.details = error;
    }
  }

  return { response, statusCode };
};

// Pagination helper
const getPaginationData = (page, limit, totalItems) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null
  };
};

// Query helper for filtering and sorting
const buildQuery = (filters = {}) => {
  const query = {};
  
  // Common filters
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === 'true';
  }
  
  if (filters.createdAfter) {
    query.createdAt = { ...query.createdAt, $gte: new Date(filters.createdAfter) };
  }
  
  if (filters.createdBefore) {
    query.createdAt = { ...query.createdAt, $lte: new Date(filters.createdBefore) };
  }
  
  return query;
};

// Sort options helper
const buildSortOptions = (sortBy = 'createdAt', sortOrder = 'desc') => {
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  return sortOptions;
};

// Search query helper
const buildSearchQuery = (searchTerm, searchFields = []) => {
  if (!searchTerm) return {};
  
  const searchRegex = { $regex: searchTerm, $options: 'i' };
  
  if (searchFields.length === 0) {
    return {};
  }
  
  if (searchFields.length === 1) {
    return { [searchFields[0]]: searchRegex };
  }
  
  return {
    $or: searchFields.map(field => ({ [field]: searchRegex }))
  };
};

// Format price helper
const formatPrice = (price, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  
  return formatter.format(price);
};

// Generate unique identifier
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `${prefix}${timestamp}${randomStr}`.toUpperCase();
};

// Validate ObjectId
const isValidObjectId = (id) => {
  const mongoose = require('mongoose');
  return mongoose.Types.ObjectId.isValid(id);
};

// Calculate discount percentage
const calculateDiscountPercentage = (originalPrice, salePrice) => {
  if (!originalPrice || originalPrice <= salePrice) {
    return 0;
  }
  
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
};

// Generate slug from string
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, ''); // Remove potentially dangerous characters
};

// Calculate estimated delivery date
const calculateEstimatedDelivery = (orderDate = new Date(), deliveryDays = 7) => {
  const estimatedDate = new Date(orderDate);
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  return estimatedDate;
};

// Format date for display
const formatDate = (date, locale = 'en-IN', options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return new Intl.DateTimeFormat(locale, defaultOptions).format(new Date(date));
};

// Calculate age in days
const calculateAgeInDays = (date) => {
  const now = new Date();
  const diffTime = Math.abs(now - new Date(date));
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Remove undefined/null values from object
const cleanObject = (obj) => {
  const cleaned = {};
  
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        const nestedCleaned = cleanObject(obj[key]);
        if (Object.keys(nestedCleaned).length > 0) {
          cleaned[key] = nestedCleaned;
        }
      } else {
        cleaned[key] = obj[key];
      }
    }
  });
    return cleaned;
};

// Sanitize query parameters to prevent NoSQL injection
const sanitizeQuery = (query) => {
  const sanitized = {};
  
  Object.keys(query).forEach(key => {
    // Remove MongoDB operators that start with $
    if (!key.startsWith('$')) {
      sanitized[key] = query[key];
    }
  });
  
  return sanitized;
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  successResponse,
  errorResponse,
  getPaginationData,
  buildQuery,
  buildSortOptions,
  buildSearchQuery,
  formatPrice,
  generateUniqueId,
  isValidObjectId,
  calculateDiscountPercentage,
  generateSlug,
  sanitizeInput,
  calculateEstimatedDelivery,
  formatDate,
  calculateAgeInDays,
  deepClone,
  cleanObject,
  sanitizeQuery,
  isValidEmail
};
