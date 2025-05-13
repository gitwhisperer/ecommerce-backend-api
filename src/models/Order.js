/**
 * Order Model
 * Defines the schema for customer orders
 */

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  }
}, {
  _id: false
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  street: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: 'India'
  }
}, {
  _id: false
});

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['stripe', 'razorpay', 'cod', 'bank_transfer']
  },
  transactionId: {
    type: String,
    sparse: true
  },
  paymentIntentId: {
    type: String,
    sparse: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative']
  },
  currency: {
    type: String,
    required: true,
    default: 'INR'
  },
  paidAt: {
    type: Date,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount cannot be negative']
  }
}, {
  _id: false
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  items: [orderItemSchema],
  
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Shipping cost cannot be negative']
  },
  
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  
  paymentInfo: paymentInfoSchema,
  
  shippingAddress: shippingAddressSchema,
  
  billingAddress: {
    type: shippingAddressSchema,
    default: null
  },
  
  notes: {
    type: String,
    maxLength: [500, 'Notes cannot exceed 500 characters']
  },
  
  trackingNumber: {
    type: String,
    sparse: true
  },
  
  estimatedDelivery: {
    type: Date,
    default: null
  },
  
  deliveredAt: {
    type: Date,
    default: null
  },
  
  cancelledAt: {
    type: Date,
    default: null
  },
  
  cancellationReason: {
    type: String,
    maxLength: [200, 'Cancellation reason cannot exceed 200 characters']
  },
  
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      maxLength: [200, 'Status note cannot exceed 200 characters']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
orderSchema.index({ user: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.transactionId': 1 });

// Virtual for full shipping address
orderSchema.virtual('fullShippingAddress').get(function() {
  if (!this.shippingAddress) return '';
  
  const addr = this.shippingAddress;
  return `${addr.firstName} ${addr.lastName}, ${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique order number
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD-${timestamp}-${random}`;
    
    // Add initial status to history
    this.statusHistory = [{
      status: this.status,
      timestamp: new Date(),
      note: 'Order created'
    }];
    
    // Set estimated delivery (7 days from now by default)
    this.estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus, note = '') {
  if (this.status === newStatus) {
    return this;
  }
  
  const previousStatus = this.status;
  this.status = newStatus;
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Status changed from ${previousStatus} to ${newStatus}`
  });
  
  // Update specific timestamps
  if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'cancelled') {
    this.cancelledAt = new Date();
  }
  
  return this.save();
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => total + item.total, 0);
  this.totalAmount = this.subtotal + this.tax + this.shippingCost - this.discount;
  this.totalAmount = Math.round(this.totalAmount * 100) / 100; // Round to 2 decimal places
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function(status, transactionId = null, paidAt = null) {
  this.paymentInfo.status = status;
  
  if (transactionId) {
    this.paymentInfo.transactionId = transactionId;
  }
  
  if (status === 'completed' && !this.paymentInfo.paidAt) {
    this.paymentInfo.paidAt = paidAt || new Date();
    
    // Auto-confirm order when payment is completed
    if (this.status === 'pending') {
      this.updateStatus('confirmed', 'Payment completed');
    }
  }
  
  return this.save();
};

// Method to cancel order
orderSchema.methods.cancelOrder = function(reason = '') {
  if (['delivered', 'cancelled', 'refunded'].includes(this.status)) {
    throw new Error(`Cannot cancel order with status: ${this.status}`);
  }
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  
  // Add to status history
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: reason || 'Order cancelled'
  });
  
  // Update payment status if needed
  if (this.paymentInfo.status === 'completed') {
    this.paymentInfo.status = 'refunded';
    this.paymentInfo.refundedAt = new Date();
    this.paymentInfo.refundAmount = this.paymentInfo.amount;
  }
  
  return this.save();
};

// Static method to find orders by user
orderSchema.statics.findByUser = function(userId, options = {}) {
  const {
    status,
    limit = 10,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;
  
  const query = { user: userId };
  
  if (status) {
    query.status = status;
  }
  
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  return this.find(query)
    .sort(sortOptions)
    .limit(limit)
    .skip(skip)
    .populate('items.product', 'name images')
    .populate('user', 'name email');
};

// Static method to get order statistics
orderSchema.statics.getOrderStats = async function(userId = null) {
  const matchQuery = userId ? { user: mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        statusBreakdown: {
          $push: {
            status: '$status',
            amount: '$totalAmount'
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    statusBreakdown: []
  };
};

// Method to get order summary for email
orderSchema.methods.getEmailSummary = function() {
  return {
    orderNumber: this.orderNumber,
    items: this.items.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    })),
    subtotal: this.subtotal,
    tax: this.tax,
    shippingCost: this.shippingCost,
    discount: this.discount,
    totalAmount: this.totalAmount,
    status: this.status,
    estimatedDelivery: this.estimatedDelivery,
    shippingAddress: this.fullShippingAddress
  };
};

module.exports = mongoose.model('Order', orderSchema);
