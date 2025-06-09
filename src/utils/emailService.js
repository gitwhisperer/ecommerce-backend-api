/**
 * Email Utility
 * Functions for sending various types of emails
 */

const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send welcome email
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Our E-commerce Store!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Our Store, ${name}!</h2>
          <p>Thank you for creating an account with us. We're excited to have you as part of our community.</p>
          <p>You can now:</p>
          <ul>
            <li>Browse our extensive product catalog</li>
            <li>Add items to your cart and wishlist</li>
            <li>Track your orders</li>
            <li>Manage your profile and preferences</li>
          </ul>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Happy shopping!</p>
          <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully to:', email);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (order, userEmail) => {
  try {
    const transporter = createTransporter();
    
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.total}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Order Confirmation</h2>
          <p>Thank you for your order! Here are the details:</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0;">Order #${order.orderNumber}</h3>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${order.status}</p>
            <p style="margin: 5px 0;"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDelivery).toLocaleDateString()}</p>
          </div>

          <h3>Items Ordered:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="border-top: 2px solid #ddd; padding-top: 15px; margin-top: 20px;">
            <div style="text-align: right;">
              <p><strong>Subtotal: ₹${order.subtotal}</strong></p>
              <p><strong>Tax: ₹${order.tax}</strong></p>
              <p><strong>Shipping: ₹${order.shippingCost}</strong></p>
              <p style="font-size: 18px; color: #333;"><strong>Total: ₹${order.totalAmount}</strong></p>
            </div>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0;">Shipping Address:</h3>
            <p style="margin: 0;">${order.shippingAddress.firstName} ${order.shippingAddress.lastName}</p>
            <p style="margin: 0;">${order.shippingAddress.street}</p>
            <p style="margin: 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
            <p style="margin: 0;">${order.shippingAddress.country}</p>
          </div>

          <p>We'll send you another email when your order ships. If you have any questions, please contact our support team.</p>
          <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested a password reset for your account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link will expire in 10 minutes.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

// Send order status update email
const sendOrderStatusEmail = async (order, userEmail) => {
  try {
    const transporter = createTransporter();
    
    const statusMessages = {
      'confirmed': 'Your order has been confirmed and is being prepared.',
      'processing': 'Your order is currently being processed.',
      'shipped': 'Great news! Your order has been shipped.',
      'delivered': 'Your order has been delivered successfully.',
      'cancelled': 'Your order has been cancelled.'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `Order Update - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Order Status Update</h2>
          <p>Your order status has been updated:</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0;">Order #${order.orderNumber}</h3>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #007bff; text-transform: uppercase;">${order.status}</span></p>
            <p style="margin: 5px 0;">${statusMessages[order.status] || 'Your order status has been updated.'}</p>
            ${order.trackingNumber ? `<p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
          </div>

          ${order.status === 'shipped' ? `
            <p>Your order is on its way! You can track your package using the tracking number provided above.</p>
            <p><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDelivery).toLocaleDateString()}</p>
          ` : ''}

          <p>Thank you for shopping with us!</p>
          <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Order status email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Error sending order status email:', error);
  }
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
  sendOrderStatusEmail
};
