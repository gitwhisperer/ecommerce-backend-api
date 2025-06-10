# 🛒 E-commerce Backend API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?&logo=express&logoColor=%2361DAFB)](https://expressjs.com/)
[![Jest](https://img.shields.io/badge/-jest-%23C21325?&logo=jest&logoColor=white)](https://jestjs.io/)

A **complete, production-ready E-commerce backend API** that you can integrate into any project. Built with modern Node.js stack and following industry best practices.

> 🎯 **Perfect for:** Startups, MVPs, Learning Projects, Portfolio Projects, Production Applications

## ✨ Why Choose This API?

- 🚀 **Ready to Deploy** - Docker support, environment configs included
- 🔒 **Security First** - JWT auth, input validation, rate limiting, CORS
- 💳 **Payment Ready** - Stripe & Razorpay integration out of the box
- 📊 **Production Grade** - Error handling, logging, monitoring, caching support
- 🧪 **Well Tested** - Comprehensive test suite with 80%+ coverage
- 📚 **Documented** - Complete API docs, Postman collection, setup guides
- 🎨 **Clean Code** - Professional structure, detailed comments, easy to extend

## 🚀 Core Features

| Feature | Description | Status |
|---------|-------------|---------|
| 👤 **User Management** | Registration, authentication, profile management | ✅ Complete |
| 🛍️ **Product Catalog** | CRUD operations, search, filtering, categories | ✅ Complete |
| 🛒 **Shopping Cart** | Add, remove, update cart items | ✅ Complete |
| 📦 **Order Processing** | Complete order lifecycle management | ✅ Complete |
| 💳 **Payment Integration** | Stripe & Razorpay gateways | ✅ Complete |
| 🔐 **Security** | JWT auth, input validation, rate limiting | ✅ Complete |
| 📊 **Admin Panel** | User management, order tracking, analytics | ✅ Complete |
| 🚀 **Performance** | Database indexing, pagination, caching | ✅ Complete |

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js |
| **Database** | MongoDB + Mongoose ODM |
| **Authentication** | JWT + Bcrypt |
| **Payments** | Stripe, Razorpay |
| **Testing** | Jest + Supertest |
| **Security** | Helmet, CORS, Rate Limiting |
| **Validation** | Express-validator |
| **Deployment** | Docker, Docker Compose |

## 📦 Quick Start

### Option 1: NPM Package (Recommended)
```bash
npm install ecommerce-backend-api
# Follow integration guide below
```

### Option 2: Clone & Customize
```bash
git clone https://github.com/gitwhisperer/ecommerce-backend-api.git
cd ecommerce-backend-api
npm install
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
- MongoDB connection string
- JWT secret
- Payment gateway credentials
- Email service credentials

5. Start the development server:
```bash
npm run dev
```

## 🔧 Integration Guide

### Integrate into Existing Project

1. **Install as dependency:**
```bash
npm install ecommerce-backend-api
```

2. **Basic Integration:**
```javascript
const express = require('express');
const { createEcommerceApp } = require('ecommerce-backend-api');

const app = express();

// Mount e-commerce API at /api
app.use('/api', createEcommerceApp({
  mongodb: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  stripeKey: process.env.STRIPE_SECRET_KEY
}));

// Your existing routes
app.use('/custom', yourCustomRoutes);

app.listen(3000);
```

3. **Advanced Configuration:**
```javascript
const ecommerceConfig = {
  database: {
    uri: process.env.MONGODB_URI,
    options: { useNewUrlParser: true }
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    expiresIn: '7d'
  },
  payments: {
    stripe: { secretKey: process.env.STRIPE_SECRET_KEY },
    razorpay: { keyId: process.env.RAZORPAY_KEY_ID }
  },
  features: {
    enableCart: true,
    enablePayments: true,
    enableAdmin: true
  }
};

app.use('/ecommerce', createEcommerceApp(ecommerceConfig));
```

## ⚙️ Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Razorpay Configuration
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - Get all products (with pagination)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update cart item quantity
- `DELETE /api/cart/remove/:productId` - Remove item from cart
- `DELETE /api/cart/clear` - Clear entire cart

### Orders
- `GET /api/orders` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/status` - Update order status (admin only)

### Payments
- `POST /api/payments/stripe/create-payment-intent` - Create Stripe payment intent
- `POST /api/payments/razorpay/create-order` - Create Razorpay order
- `POST /api/payments/webhook` - Payment webhook handler

## Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/admin),
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Product
```javascript
{
  name: String,
  description: String,
  price: Number,
  category: String,
  stock: Number,
  images: [String],
  ratings: {
    average: Number,
    count: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Order
```javascript
{
  user: ObjectId,
  items: [{
    product: ObjectId,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: String,
  paymentInfo: {
    method: String,
    transactionId: String,
    status: String
  },
  shippingAddress: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Cart
```javascript
{
  user: ObjectId,
  items: [{
    product: ObjectId,
    quantity: Number
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Watch mode:
```bash
npm run test:watch
```

## Performance Optimizations

- Database indexing on frequently queried fields
- Pagination for product listings
- Redis caching for frequently accessed data
- Image optimization and CDN integration
- API response compression

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- CORS configuration
- Input validation and sanitization
- Helmet for security headers

## Deployment

The API can be deployed to various platforms:

### Heroku
1. Create a Heroku app
2. Set environment variables
3. Deploy using Git

### Docker
```bash
docker build -t ecommerce-api .
docker run -p 5000:5000 ecommerce-api
```

## 👥 Contributing

We welcome contributions! This project follows the [Contributor Covenant](https://www.contributor-covenant.org/).

### Development Workflow

1. **Fork & Clone**: Fork the repository and clone it locally
2. **Branch**: Create a feature branch (`git checkout -b feature/amazing-feature`)
3. **Implement**: Make your changes with tests
4. **Test**: Ensure all tests pass (`npm test`)
5. **Commit**: Use conventional commits format (`feat: add amazing feature`)
6. **Push & PR**: Push your branch and create a Pull Request

### Project Roadmap

- 📊 **Analytics Dashboard**: Add advanced analytics for store owners
- 🌐 **Internationalization**: Multi-language and currency support
- 📱 **Mobile Support**: Enhanced mobile-specific endpoints
- 🔄 **Webhook System**: Advanced webhook integration options
- 🏭 **Multi-vendor Support**: Enable marketplace functionality

## 🚀 Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Scale API service (if needed)
docker-compose up -d --scale api=3
```

### Manual Deployment

```bash
# Install PM2 globally
npm install pm2 -g

# Start production server
pm2 start npm --name "ecommerce-api" -- start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [API Documentation](https://github.com/yourusername/ecommerce-backend-api/wiki)
- **Issue Tracking**: [GitHub Issues](https://github.com/yourusername/ecommerce-backend-api/issues)
- **Community**: [Discord Server](https://discord.gg/ecommerceapi)
- **Email**: support@yourdomain.com

---

Made with ❤️ by [Your Name](https://github.com/yourusername)
