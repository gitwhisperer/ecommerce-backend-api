/**
 * Cart Model
 * Defines the schema for user shopping carts
 */

const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  }
}, {
  _id: false,
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  items: [cartItemSchema],
  
  totalAmount: {
    type: Number,
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },
  
  totalItems: {
    type: Number,
    default: 0,
    min: [0, 'Total items cannot be negative']
  },
  
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for performance
cartSchema.index({ user: 1 });
cartSchema.index({ lastModified: -1 });

// Virtual for cart summary
cartSchema.virtual('summary').get(function() {
  return {
    totalItems: this.totalItems,
    totalAmount: this.totalAmount,
    itemCount: this.items.length
  };
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  this.lastModified = new Date();
  next();
});

// Method to calculate totals
cartSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  this.totalAmount = Math.round(this.totalAmount * 100) / 100; // Round to 2 decimal places
};

// Method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity = 1, price) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );
  
  if (existingItemIndex >= 0) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = price; // Update price in case it changed
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      price
    });
  }
  
  this.calculateTotals();
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );
  
  if (itemIndex === -1) {
    throw new Error('Product not found in cart');
  }
  
  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
  }
  
  this.calculateTotals();
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(productId) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );
  
  if (itemIndex === -1) {
    throw new Error('Product not found in cart');
  }
  
  this.items.splice(itemIndex, 1);
  this.calculateTotals();
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.totalAmount = 0;
  this.totalItems = 0;
  return this.save();
};

// Method to validate cart items (check if products exist and have sufficient stock)
cartSchema.methods.validateItems = async function() {
  const Product = mongoose.model('Product');
  const validationErrors = [];
  
  for (let i = 0; i < this.items.length; i++) {
    const item = this.items[i];
    
    try {
      const product = await Product.findById(item.product);
      
      if (!product) {
        validationErrors.push({
          productId: item.product,
          error: 'Product not found'
        });
        continue;
      }
      
      if (!product.isActive) {
        validationErrors.push({
          productId: item.product,
          productName: product.name,
          error: 'Product is no longer available'
        });
        continue;
      }
      
      if (product.stock < item.quantity) {
        validationErrors.push({
          productId: item.product,
          productName: product.name,
          error: `Insufficient stock. Available: ${product.stock}, Requested: ${item.quantity}`
        });
        continue;
      }
      
      // Update price if it has changed
      if (item.price !== product.price) {
        this.items[i].price = product.price;
      }
      
    } catch (error) {
      validationErrors.push({
        productId: item.product,
        error: 'Error validating product'
      });
    }
  }
  
  if (validationErrors.length === 0) {
    this.calculateTotals();
    await this.save();
  }
  
  return validationErrors;
};

// Static method to find cart by user
cartSchema.statics.findByUser = function(userId) {
  return this.findOne({ user: userId, isActive: true })
    .populate('items.product', 'name price stock images isActive');
};

// Static method to create or get cart
cartSchema.statics.findOrCreateCart = async function(userId) {
  let cart = await this.findByUser(userId);
  
  if (!cart) {
    cart = new this({
      user: userId,
      items: []
    });
    await cart.save();
  }
  
  return cart;
};

// Method to get cart with populated product details
cartSchema.methods.getPopulatedCart = function() {
  return this.populate('items.product', 'name price stock images isActive category');
};

// Method to convert cart to order items format
cartSchema.methods.toOrderItems = function() {
  return this.items.map(item => ({
    product: item.product._id || item.product,
    quantity: item.quantity,
    price: item.price,
    total: item.price * item.quantity
  }));
};

module.exports = mongoose.model('Cart', cartSchema);
