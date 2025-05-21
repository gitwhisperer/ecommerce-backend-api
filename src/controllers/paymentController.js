/**
 * Payment Controller
 * Handles payment processing with Stripe and Razorpay
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const { asyncHandler, ValidationError, NotFoundError, PaymentError } = require('../middleware/errorHandler');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Stripe payment intent
// @route   POST /api/payments/stripe/create-payment-intent
// @access  Private
const createStripePaymentIntent = asyncHandler(async (req, res) => {
  const { orderId, amount, currency = 'inr' } = req.body;

  // Validate order
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Check if user owns this order
  if (order.user.toString() !== req.user._id.toString()) {
    throw new ValidationError('You can only pay for your own orders');
  }

  // Check if order is already paid
  if (order.paymentInfo.status === 'completed') {
    throw new ValidationError('Order is already paid');
  }

  // Validate amount matches order total
  if (amount !== order.totalAmount) {
    throw new ValidationError('Payment amount does not match order total');
  }

  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects amount in cents
      currency: currency.toLowerCase(),
      metadata: {
        orderId: orderId,
        userId: req.user._id.toString(),
        orderNumber: order.orderNumber
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update order with payment intent ID
    order.paymentInfo.paymentIntentId = paymentIntent.id;
    await order.save();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
      }
    });

  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    throw new PaymentError('Failed to create payment intent');
  }
});

// @desc    Confirm Stripe payment
// @route   POST /api/payments/stripe/confirm
// @access  Private
const confirmStripePayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    throw new ValidationError('Payment intent ID is required');
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new PaymentError('Payment has not succeeded');
    }

    // Find order by payment intent ID
    const order = await Order.findOne({ 
      'paymentInfo.paymentIntentId': paymentIntentId 
    });

    if (!order) {
      throw new NotFoundError('Order for this payment');
    }

    // Update payment status
    await order.updatePaymentStatus(
      'completed',
      paymentIntent.id,
      new Date(paymentIntent.created * 1000)
    );

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        order,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100
        }
      }
    });

  } catch (error) {
    console.error('Stripe payment confirmation error:', error);
    if (error.type === 'StripeInvalidRequestError') {
      throw new ValidationError('Invalid payment intent ID');
    }
    throw new PaymentError('Failed to confirm payment');
  }
});

// @desc    Create Razorpay order
// @route   POST /api/payments/razorpay/create-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId, amount, currency = 'INR' } = req.body;

  // Validate order
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Check if user owns this order
  if (order.user.toString() !== req.user._id.toString()) {
    throw new ValidationError('You can only pay for your own orders');
  }

  // Check if order is already paid
  if (order.paymentInfo.status === 'completed') {
    throw new ValidationError('Order is already paid');
  }

  // Validate amount matches order total
  if (amount !== order.totalAmount) {
    throw new ValidationError('Payment amount does not match order total');
  }

  try {
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: currency.toUpperCase(),
      receipt: order.orderNumber,
      notes: {
        orderId: orderId,
        userId: req.user._id.toString(),
        orderNumber: order.orderNumber
      }
    });

    // Update order with Razorpay order ID
    order.paymentInfo.transactionId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderDetails: {
          id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress.firstName + ' ' + order.shippingAddress.lastName,
          customerEmail: order.shippingAddress.email,
          customerPhone: order.shippingAddress.phone
        }
      }
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw new PaymentError('Failed to create Razorpay order');
  }
});

// @desc    Verify Razorpay payment
// @route   POST /api/payments/razorpay/verify
// @access  Private
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature 
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ValidationError('All Razorpay payment details are required');
  }

  try {
    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new PaymentError('Invalid payment signature');
    }

    // Find order by Razorpay order ID
    const order = await Order.findOne({ 
      'paymentInfo.transactionId': razorpay_order_id 
    });

    if (!order) {
      throw new NotFoundError('Order for this payment');
    }

    // Verify payment with Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured') {
      throw new PaymentError('Payment was not captured successfully');
    }

    // Update payment status
    await order.updatePaymentStatus(
      'completed',
      razorpay_payment_id,
      new Date(payment.created_at * 1000)
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        order,
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount / 100,
          method: payment.method
        }
      }
    });

  } catch (error) {
    console.error('Razorpay payment verification error:', error);
    throw new PaymentError('Failed to verify payment');
  }
});

// @desc    Handle payment webhooks
// @route   POST /api/payments/webhook
// @access  Public (but verified)
const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature (for Stripe)
    if (sig && endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Handle Razorpay webhook or other payment providers
      event = req.body;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailure(event.data.object);
        break;
      
      case 'payment.captured':
        // Razorpay payment captured
        await handleRazorpayPaymentSuccess(event.payload.payment.entity);
        break;
      
      case 'payment.failed':
        // Razorpay payment failed
        await handleRazorpayPaymentFailure(event.payload.payment.entity);
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Helper function to handle Stripe payment success
const handleStripePaymentSuccess = async (paymentIntent) => {
  try {
    const order = await Order.findOne({ 
      'paymentInfo.paymentIntentId': paymentIntent.id 
    });

    if (order && order.paymentInfo.status !== 'completed') {
      await order.updatePaymentStatus(
        'completed',
        paymentIntent.id,
        new Date(paymentIntent.created * 1000)
      );
      
      console.log(`Payment completed for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling Stripe payment success:', error);
  }
};

// Helper function to handle Stripe payment failure
const handleStripePaymentFailure = async (paymentIntent) => {
  try {
    const order = await Order.findOne({ 
      'paymentInfo.paymentIntentId': paymentIntent.id 
    });

    if (order) {
      await order.updatePaymentStatus('failed');
      console.log(`Payment failed for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling Stripe payment failure:', error);
  }
};

// Helper function to handle Razorpay payment success
const handleRazorpayPaymentSuccess = async (payment) => {
  try {
    const order = await Order.findOne({ 
      'paymentInfo.transactionId': payment.order_id 
    });

    if (order && order.paymentInfo.status !== 'completed') {
      await order.updatePaymentStatus(
        'completed',
        payment.id,
        new Date(payment.created_at * 1000)
      );
      
      console.log(`Payment completed for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling Razorpay payment success:', error);
  }
};

// Helper function to handle Razorpay payment failure
const handleRazorpayPaymentFailure = async (payment) => {
  try {
    const order = await Order.findOne({ 
      'paymentInfo.transactionId': payment.order_id 
    });

    if (order) {
      await order.updatePaymentStatus('failed');
      console.log(`Payment failed for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling Razorpay payment failure:', error);
  }
};

// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Public
const getPaymentMethods = asyncHandler(async (req, res) => {
  const methods = [
    {
      id: 'stripe',
      name: 'Credit/Debit Card',
      description: 'Pay securely with your credit or debit card',
      enabled: !!process.env.STRIPE_SECRET_KEY,
      currencies: ['inr', 'usd', 'eur']
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Pay with UPI, Net Banking, Wallet, or Card',
      enabled: !!process.env.RAZORPAY_KEY_ID,
      currencies: ['inr']
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      description: 'Pay when you receive your order',
      enabled: true,
      currencies: ['inr']
    }
  ];

  res.json({
    success: true,
    data: {
      methods: methods.filter(method => method.enabled)
    }
  });
});

module.exports = {
  createStripePaymentIntent,
  confirmStripePayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentWebhook,
  getPaymentMethods
};
