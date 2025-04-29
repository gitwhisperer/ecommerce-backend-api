/**
 * Product Model
 * Defines the schema for products in the e-commerce store
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxLength: [200, 'Product name cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxLength: [2000, 'Product description cannot exceed 2000 characters']
  },
  
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative'],
    set: v => v ? Math.round(v * 100) / 100 : v
  },
  
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: [
      'Electronics',
      'Clothing',
      'Books',
      'Home & Garden',
      'Sports',
      'Beauty',
      'Toys',
      'Automotive',
      'Food & Beverages',
      'Health',
      'Other'
    ]
  },
  
  subcategory: {
    type: String,
    trim: true
  },
  
  brand: {
    type: String,
    trim: true
  },
  
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  
  images: [{
    type: String,
    required: true
  }],
  
  specifications: {
    type: Map,
    of: String
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  ratings: {
    average: {
      type: Number,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
      default: 0,
      set: v => Math.round(v * 10) / 10 // Round to 1 decimal place
    },
    count: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative']
    }
  },
  
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5']
    },
    comment: {
      type: String,
      required: true,
      maxLength: [500, 'Review comment cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    weight: Number,
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb'],
      default: 'kg'
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  seoTitle: {
    type: String,
    maxLength: [60, 'SEO title cannot exceed 60 characters']
  },
  
  seoDescription: {
    type: String,
    maxLength: [160, 'SEO description cannot exceed 160 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ slug: 1 });

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (!this.originalPrice || this.originalPrice <= this.price) {
    return 0;
  }
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
});

// Virtual for availability status
productSchema.virtual('availability').get(function() {
  if (this.stock === 0) return 'out-of-stock';
  if (this.stock <= 5) return 'low-stock';
  return 'in-stock';
});

// Pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
  }
  next();
});

// Method to add review
productSchema.methods.addReview = function(userId, rating, comment) {
  // Check if user already reviewed this product
  const existingReview = this.reviews.find(review => 
    review.user.toString() === userId.toString()
  );
  
  if (existingReview) {
    // Update existing review
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.createdAt = new Date();
  } else {
    // Add new review
    this.reviews.push({
      user: userId,
      rating,
      comment,
      createdAt: new Date()
    });
  }
  
  // Recalculate average rating
  this.calculateAverageRating();
  
  return this.save();
};

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.ratings.average = 0;
    this.ratings.count = 0;
    return;
  }
  
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.ratings.average = totalRating / this.reviews.length;
  this.ratings.count = this.reviews.length;
};

// Static method to find products by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Static method to search products
productSchema.statics.searchProducts = function(query, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    minRating,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 10,
    skip = 0
  } = options;
  
  const searchQuery = { isActive: true };
  
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  if (category) {
    searchQuery.category = category;
  }
  
  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = minPrice;
    if (maxPrice) searchQuery.price.$lte = maxPrice;
  }
  
  if (minRating) {
    searchQuery['ratings.average'] = { $gte: minRating };
  }
  
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  return this.find(searchQuery)
    .sort(sortOptions)
    .limit(limit)
    .skip(skip)
    .select('-reviews');
};

// Method to update stock
productSchema.methods.updateStock = function(quantity, operation = 'decrease') {
  if (operation === 'decrease') {
    if (this.stock < quantity) {
      throw new Error('Insufficient stock');
    }
    this.stock -= quantity;
  } else if (operation === 'increase') {
    this.stock += quantity;
  }
  
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);
