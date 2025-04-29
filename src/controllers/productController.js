/**
 * Product Controller
 * Handles product CRUD operations and search functionality
 */

const Product = require('../models/Product');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

// @desc    Get all products with pagination and filtering
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search,
    category,
    minPrice,
    maxPrice,
    minRating,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    featured
  } = req.query;

  const skip = (page - 1) * limit;
  
  // Build search options
  const searchOptions = {
    category,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    minRating: minRating ? parseFloat(minRating) : undefined,
    sortBy,
    sortOrder,
    limit: parseInt(limit),
    skip: parseInt(skip)
  };

  let products;
  let total;

  if (search) {
    // Use search functionality
    products = await Product.searchProducts(search, searchOptions);
    // For search results, we need to count separately
    const countQuery = { 
      isActive: true,
      $text: { $search: search }
    };
    if (category) countQuery.category = category;
    if (minPrice || maxPrice) {
      countQuery.price = {};
      if (minPrice) countQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) countQuery.price.$lte = parseFloat(maxPrice);
    }
    if (minRating) countQuery['ratings.average'] = { $gte: parseFloat(minRating) };
    
    total = await Product.countDocuments(countQuery);
  } else {
    // Regular query
    const query = { isActive: true };
    
    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (minRating) query['ratings.average'] = { $gte: parseFloat(minRating) };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    products = await Product.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-reviews');

    total = await Product.countDocuments(query);
  }

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProducts: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: parseInt(limit)
      },
      filters: {
        search,
        category,
        minPrice,
        maxPrice,
        minRating,
        sortBy,
        sortOrder
      }
    }
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('reviews.user', 'name')
    .populate('createdBy', 'name');

  if (!product) {
    throw new NotFoundError('Product');
  }

  if (!product.isActive) {
    throw new NotFoundError('Product');
  }

  res.json({
    success: true,
    data: {
      product
    }
  });
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin only)
const createProduct = asyncHandler(async (req, res) => {
  const productData = {
    ...req.body,
    createdBy: req.user._id
  };

  const product = await Product.create(productData);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: {
      product
    }
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin only)
const updateProduct = asyncHandler(async (req, res) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  // Add updatedBy field
  const updateData = {
    ...req.body,
    updatedBy: req.user._id
  };

  product = await Product.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: {
      product
    }
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  // Soft delete by setting isActive to false
  await Product.findByIdAndUpdate(req.params.id, { isActive: false });

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isActive: true });

  // Get product count per category
  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const count = await Product.countDocuments({ 
        category, 
        isActive: true 
      });
      return { name: category, count };
    })
  );

  res.json({
    success: true,
    data: {
      categories: categoriesWithCount
    }
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({ 
    isActive: true, 
    isFeatured: true 
  })
    .sort({ 'ratings.average': -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select('-reviews');

  res.json({
    success: true,
    data: {
      products
    }
  });
});

// @desc    Get related products
// @route   GET /api/products/:id/related
// @access  Public
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { limit = 4 } = req.query;

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new NotFoundError('Product');
  }

  const relatedProducts = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true
  })
    .sort({ 'ratings.average': -1 })
    .limit(parseInt(limit))
    .select('-reviews');

  res.json({
    success: true,
    data: {
      products: relatedProducts
    }
  });
});

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
const addProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    throw new ValidationError('Rating and comment are required');
  }

  if (rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be between 1 and 5');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (!product.isActive) {
    throw new ValidationError('Cannot review inactive product');
  }

  await product.addReview(req.user._id, rating, comment);

  res.status(201).json({
    success: true,
    message: 'Review added successfully'
  });
});

// @desc    Get product reviews
// @route   GET /api/products/:id/reviews
// @access  Public
const getProductReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const product = await Product.findById(req.params.id)
    .populate('reviews.user', 'name')
    .select('reviews ratings');

  if (!product) {
    throw new NotFoundError('Product');
  }

  // Sort reviews by creation date (newest first)
  const sortedReviews = product.reviews
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + parseInt(limit));

  const totalReviews = product.reviews.length;
  const totalPages = Math.ceil(totalReviews / limit);

  res.json({
    success: true,
    data: {
      reviews: sortedReviews,
      ratings: product.ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: parseInt(limit)
      }
    }
  });
});

// @desc    Update stock quantity
// @route   PATCH /api/products/:id/stock
// @access  Private (Admin only)
const updateStock = asyncHandler(async (req, res) => {
  const { quantity, operation = 'set' } = req.body;

  if (typeof quantity !== 'number' || quantity < 0) {
    throw new ValidationError('Quantity must be a non-negative number');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (operation === 'set') {
    product.stock = quantity;
  } else if (operation === 'increase') {
    product.stock += quantity;
  } else if (operation === 'decrease') {
    if (product.stock < quantity) {
      throw new ValidationError('Insufficient stock for decrease operation');
    }
    product.stock -= quantity;
  } else {
    throw new ValidationError('Invalid operation. Use set, increase, or decrease');
  }

  await product.save();

  res.json({
    success: true,
    message: 'Stock updated successfully',
    data: {
      product: {
        id: product._id,
        name: product.name,
        stock: product.stock
      }
    }
  });
});

// @desc    Search products (dedicated search endpoint)
// @route   GET /api/products/search
// @access  Public
const searchProducts = asyncHandler(async (req, res) => {
  const { q: query, ...filters } = req.query;

  if (!query) {
    throw new ValidationError('Search query is required');
  }

  const searchOptions = {
    category: filters.category,
    minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
    minRating: filters.minRating ? parseFloat(filters.minRating) : undefined,
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
    limit: parseInt(filters.limit) || 12,
    skip: ((parseInt(filters.page) || 1) - 1) * (parseInt(filters.limit) || 12)
  };

  const products = await Product.searchProducts(query, searchOptions);

  res.json({
    success: true,
    data: {
      products,
      query,
      filters: searchOptions
    }
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getFeaturedProducts,
  getRelatedProducts,
  addProductReview,
  getProductReviews,
  updateStock,
  searchProducts
};
