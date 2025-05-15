/**
 * Order Controller
 * Handles order creation, management, and tracking
 */

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError, InsufficientStockError } = require('../middleware/errorHandler');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { 
    items, 
    shippingAddress, 
    billingAddress, 
    paymentInfo, 
    notes 
  } = req.body;

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }

  // Validate and calculate order totals
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      throw new NotFoundError(`Product with ID ${item.product}`);
    }

    if (!product.isActive) {
      throw new ValidationError(`Product ${product.name} is not available`);
    }

    if (product.stock < item.quantity) {
      throw new InsufficientStockError(product.name, product.stock, item.quantity);
    }

    const itemTotal = product.price * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      price: product.price,
      total: itemTotal
    });
  }

  // Calculate additional costs
  const tax = subtotal * 0.1; // 10% tax (you can make this configurable)
  const shippingCost = subtotal > 500 ? 0 : 50; // Free shipping over ₹500
  const discount = 0; // Placeholder for future discount logic
  const totalAmount = subtotal + tax + shippingCost - discount;

  // Create order
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    subtotal,
    tax,
    shippingCost,
    discount,
    totalAmount,
    shippingAddress,
    billingAddress: billingAddress || shippingAddress,
    paymentInfo: {
      method: paymentInfo.method,
      status: paymentInfo.method === 'cod' ? 'pending' : 'pending',
      amount: totalAmount,
      currency: paymentInfo.currency || 'INR'
    },
    notes
  });

  // Update product stock
  for (const item of items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: -item.quantity } }
    );
  }

  // Clear user's cart if order was created from cart
  const cart = await Cart.findByUser(req.user._id);
  if (cart) {
    await cart.clearCart();
  }

  // Populate order details
  const populatedOrder = await Order.findById(order._id)
    .populate('items.product', 'name images')
    .populate('user', 'name email');

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: {
      order: populatedOrder
    }
  });
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
const getUserOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const options = {
    status,
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
    sortBy,
    sortOrder
  };

  const orders = await Order.findByUser(req.user._id, options);
  const totalOrders = await Order.countDocuments({ user: req.user._id });
  const totalPages = Math.ceil(totalOrders / limit);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: parseInt(limit)
      }
    }
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.product', 'name images category')
    .populate('user', 'name email');

  if (!order) {
    throw new NotFoundError('Order');
  }

  // Check if user owns this order or is admin
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ForbiddenError('Access denied. You can only view your own orders');
  }

  res.json({
    success: true,
    data: {
      order
    }
  });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin only)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const validStatuses = [
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  ];

  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Prevent invalid status transitions
  const invalidTransitions = {
    'delivered': ['pending', 'confirmed', 'processing'],
    'cancelled': ['delivered', 'shipped'],
    'refunded': ['pending', 'confirmed', 'processing']
  };

  if (invalidTransitions[order.status] && invalidTransitions[order.status].includes(status)) {
    throw new ValidationError(`Cannot change status from ${order.status} to ${status}`);
  }

  await order.updateStatus(status, note);

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: {
      order
    }
  });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Check if user owns this order or is admin
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ForbiddenError('Access denied. You can only cancel your own orders');
  }

  // Check if order can be cancelled
  const nonCancellableStatuses = ['delivered', 'cancelled', 'refunded', 'shipped'];
  if (nonCancellableStatuses.includes(order.status)) {
    throw new ValidationError(`Cannot cancel order with status: ${order.status}`);
  }

  await order.cancelOrder(reason);

  // Restore product stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: item.quantity } }
    );
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      order
    }
  });
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/admin/all
// @access  Private (Admin only)
const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Build query
  const query = {};
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
      { 'shippingAddress.lastName': { $regex: search, $options: 'i' } },
      { 'shippingAddress.email': { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const orders = await Order.find(query)
    .populate('user', 'name email')
    .populate('items.product', 'name')
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip(skip);

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: parseInt(limit)
      }
    }
  });
});

// @desc    Get order statistics
// @route   GET /api/orders/admin/stats
// @access  Private (Admin only)
const getOrderStats = asyncHandler(async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  // Build date filter
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchQuery = {};
  if (userId) matchQuery.user = mongoose.Types.ObjectId(userId);
  if (Object.keys(dateFilter).length > 0) matchQuery.createdAt = dateFilter;

  const stats = await Order.aggregate([
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
            count: 1
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalOrders: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        averageOrderValue: { $round: ['$averageOrderValue', 2] },
        statusBreakdown: 1
      }
    }
  ]);

  // Calculate status counts
  const statusCounts = {};
  if (stats[0]) {
    stats[0].statusBreakdown.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
  }

  const result = stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  };

  result.statusBreakdown = statusCounts;

  res.json({
    success: true,
    data: {
      stats: result
    }
  });
});

// @desc    Add tracking number
// @route   PUT /api/orders/:id/tracking
// @access  Private (Admin only)
const addTrackingNumber = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.body;

  if (!trackingNumber) {
    throw new ValidationError('Tracking number is required');
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    throw new NotFoundError('Order');
  }

  order.trackingNumber = trackingNumber;
  
  // Auto-update status to shipped if not already
  if (order.status === 'processing' || order.status === 'confirmed') {
    await order.updateStatus('shipped', 'Tracking number added');
  } else {
    await order.save();
  }

  res.json({
    success: true,
    message: 'Tracking number added successfully',
    data: {
      order
    }
  });
});

// @desc    Get order by tracking number
// @route   GET /api/orders/track/:trackingNumber
// @access  Public
const trackOrder = asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;

  const order = await Order.findOne({ trackingNumber })
    .populate('items.product', 'name images')
    .select('orderNumber status statusHistory estimatedDelivery deliveredAt shippingAddress');

  if (!order) {
    throw new NotFoundError('Order with this tracking number');
  }

  res.json({
    success: true,
    data: {
      order
    }
  });
});

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  getOrderStats,
  addTrackingNumber,
  trackOrder
};
