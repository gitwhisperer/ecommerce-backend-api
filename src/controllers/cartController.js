/**
 * Cart Controller
 * Handles shopping cart operations
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { asyncHandler, ValidationError, NotFoundError, InsufficientStockError } = require('../middleware/errorHandler');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findByUser(req.user._id);

  if (!cart) {
    // Return empty cart if none exists
    return res.json({
      success: true,
      data: {
        cart: {
          items: [],
          totalAmount: 0,
          totalItems: 0
        }
      }
    });
  }

  // Validate cart items before returning
  const validationErrors = await cart.validateItems();
  
  if (validationErrors.length > 0) {
    // Remove invalid items and return updated cart
    cart.items = cart.items.filter(item => 
      !validationErrors.some(error => 
        error.productId.toString() === item.product.toString()
      )
    );
    await cart.save();
    
    return res.json({
      success: true,
      data: {
        cart: await cart.getPopulatedCart(),
        warnings: validationErrors
      }
    });
  }

  res.json({
    success: true,
    data: {
      cart: await cart.getPopulatedCart()
    }
  });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  // Validate product exists and is active
  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (!product.isActive) {
    throw new ValidationError('Product is not available');
  }

  // Check stock availability
  if (product.stock < quantity) {
    throw new InsufficientStockError(product.name, product.stock, quantity);
  }

  // Find or create cart
  let cart = await Cart.findOrCreateCart(req.user._id);

  // Check if adding this quantity would exceed stock
  const existingItem = cart.items.find(item => 
    item.product.toString() === productId.toString()
  );
  
  const totalRequestedQuantity = existingItem 
    ? existingItem.quantity + quantity 
    : quantity;

  if (product.stock < totalRequestedQuantity) {
    throw new InsufficientStockError(
      product.name, 
      product.stock, 
      totalRequestedQuantity
    );
  }

  // Add item to cart
  await cart.addItem(productId, quantity, product.price);

  // Get updated cart with populated product details
  const populatedCart = await cart.getPopulatedCart();

  res.status(201).json({
    success: true,
    message: 'Item added to cart successfully',
    data: {
      cart: populatedCart
    }
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/update
// @access  Private
const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  if (quantity < 0) {
    throw new ValidationError('Quantity cannot be negative');
  }

  const cart = await Cart.findByUser(req.user._id);
  if (!cart) {
    throw new NotFoundError('Cart');
  }

  // If quantity is 0, remove the item
  if (quantity === 0) {
    await cart.removeItem(productId);
  } else {
    // Validate product and stock
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError('Product');
    }

    if (!product.isActive) {
      throw new ValidationError('Product is not available');
    }

    if (product.stock < quantity) {
      throw new InsufficientStockError(product.name, product.stock, quantity);
    }

    await cart.updateItemQuantity(productId, quantity);
  }

  // Get updated cart with populated product details
  const populatedCart = await cart.getPopulatedCart();

  res.json({
    success: true,
    message: 'Cart updated successfully',
    data: {
      cart: populatedCart
    }
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Private
const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await Cart.findByUser(req.user._id);
  if (!cart) {
    throw new NotFoundError('Cart');
  }

  await cart.removeItem(productId);

  // Get updated cart with populated product details
  const populatedCart = await cart.getPopulatedCart();

  res.json({
    success: true,
    message: 'Item removed from cart successfully',
    data: {
      cart: populatedCart
    }
  });
});

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findByUser(req.user._id);
  if (!cart) {
    throw new NotFoundError('Cart');
  }

  await cart.clearCart();

  res.json({
    success: true,
    message: 'Cart cleared successfully',
    data: {
      cart: {
        items: [],
        totalAmount: 0,
        totalItems: 0
      }
    }
  });
});

// @desc    Get cart summary
// @route   GET /api/cart/summary
// @access  Private
const getCartSummary = asyncHandler(async (req, res) => {
  const cart = await Cart.findByUser(req.user._id);

  if (!cart) {
    return res.json({
      success: true,
      data: {
        summary: {
          totalItems: 0,
          totalAmount: 0,
          itemCount: 0
        }
      }
    });
  }

  res.json({
    success: true,
    data: {
      summary: cart.summary
    }
  });
});

// @desc    Validate cart items
// @route   POST /api/cart/validate
// @access  Private
const validateCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findByUser(req.user._id);
  
  if (!cart) {
    return res.json({
      success: true,
      data: {
        isValid: true,
        errors: []
      }
    });
  }

  const validationErrors = await cart.validateItems();
  
  res.json({
    success: true,
    data: {
      isValid: validationErrors.length === 0,
      errors: validationErrors,
      cart: await cart.getPopulatedCart()
    }
  });
});

// @desc    Move item to wishlist (placeholder)
// @route   POST /api/cart/move-to-wishlist
// @access  Private
const moveToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  const cart = await Cart.findByUser(req.user._id);
  if (!cart) {
    throw new NotFoundError('Cart');
  }

  // Find the item in cart
  const item = cart.items.find(item => 
    item.product.toString() === productId.toString()
  );

  if (!item) {
    throw new NotFoundError('Item not found in cart');
  }

  // Remove from cart
  await cart.removeItem(productId);

  // In a real application, you would add to wishlist here
  // For now, we'll just return success

  res.json({
    success: true,
    message: 'Item moved to wishlist successfully',
    data: {
      cart: await cart.getPopulatedCart()
    }
  });
});

// @desc    Apply coupon code (placeholder)
// @route   POST /api/cart/apply-coupon
// @access  Private
const applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;

  if (!couponCode) {
    throw new ValidationError('Coupon code is required');
  }

  const cart = await Cart.findByUser(req.user._id);
  if (!cart) {
    throw new NotFoundError('Cart');
  }

  // In a real application, you would validate the coupon here
  // For now, we'll return a placeholder response

  res.json({
    success: false,
    message: 'Coupon functionality not implemented yet'
  });
});

// @desc    Get cart item count
// @route   GET /api/cart/count
// @access  Private
const getCartCount = asyncHandler(async (req, res) => {
  const cart = await Cart.findByUser(req.user._id);

  const count = cart ? cart.totalItems : 0;

  res.json({
    success: true,
    data: {
      count
    }
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
  validateCart,
  moveToWishlist,
  applyCoupon,
  getCartCount
};
