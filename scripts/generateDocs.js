/**
 * API Documentation Generator
 * Generates API documentation from route comments
 */

const fs = require('fs');
const path = require('path');

// API endpoints documentation
const apiDocs = {
  info: {
    title: 'E-commerce API Documentation',
    version: '1.0.0',
    description: 'Complete E-commerce backend API with authentication, product management, cart, orders, and payments'
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development server'
    },
    {
      url: 'https://your-domain.com',
      description: 'Production server'
    }
  ],
  endpoints: {
    authentication: {
      path: '/api/auth',
      methods: [
        {
          method: 'POST',
          endpoint: '/register',
          description: 'Register a new user',
          body: {
            name: 'string (required)',
            email: 'string (required)',
            password: 'string (required, min 6 chars)'
          },
          response: {
            success: 'boolean',
            message: 'string',
            user: 'object',
            token: 'string'
          }
        },
        {
          method: 'POST',
          endpoint: '/login',
          description: 'Login user and get JWT token',
          body: {
            email: 'string (required)',
            password: 'string (required)'
          },
          response: {
            success: 'boolean',
            message: 'string',
            user: 'object',
            token: 'string'
          }
        },
        {
          method: 'GET',
          endpoint: '/profile',
          description: 'Get current user profile',
          headers: {
            Authorization: 'Bearer <token>'
          },
          response: {
            success: 'boolean',
            data: 'user object'
          }
        }
      ]
    },
    products: {
      path: '/api/products',
      methods: [
        {
          method: 'GET',
          endpoint: '/',
          description: 'Get all products with pagination and filtering',
          query: {
            page: 'number (default: 1)',
            limit: 'number (default: 10)',
            category: 'string',
            search: 'string',
            minPrice: 'number',
            maxPrice: 'number',
            sort: 'string (price, name, createdAt)'
          },
          response: {
            success: 'boolean',
            data: 'array of products',
            pagination: 'object'
          }
        },
        {
          method: 'GET',
          endpoint: '/:id',
          description: 'Get single product by ID',
          response: {
            success: 'boolean',
            data: 'product object'
          }
        },
        {
          method: 'POST',
          endpoint: '/',
          description: 'Create new product (admin only)',
          headers: {
            Authorization: 'Bearer <admin_token>'
          },
          body: {
            name: 'string (required)',
            description: 'string (required)',
            price: 'number (required)',
            category: 'string (required)',
            brand: 'string',
            stock: 'number (required)',
            images: 'array of strings'
          },
          response: {
            success: 'boolean',
            data: 'created product object'
          }
        }
      ]
    },
    cart: {
      path: '/api/cart',
      methods: [
        {
          method: 'GET',
          endpoint: '/',
          description: 'Get user cart',
          headers: {
            Authorization: 'Bearer <token>'
          },
          response: {
            success: 'boolean',
            data: 'cart object with items'
          }
        },
        {
          method: 'POST',
          endpoint: '/add',
          description: 'Add item to cart',
          headers: {
            Authorization: 'Bearer <token>'
          },
          body: {
            productId: 'string (required)',
            quantity: 'number (required)'
          },
          response: {
            success: 'boolean',
            data: 'updated cart object'
          }
        }
      ]
    },
    orders: {
      path: '/api/orders',
      methods: [
        {
          method: 'GET',
          endpoint: '/',
          description: 'Get user orders',
          headers: {
            Authorization: 'Bearer <token>'
          },
          response: {
            success: 'boolean',
            data: 'array of orders'
          }
        },
        {
          method: 'POST',
          endpoint: '/',
          description: 'Create new order',
          headers: {
            Authorization: 'Bearer <token>'
          },
          body: {
            shippingAddress: 'object (required)',
            paymentMethod: 'string (required)'
          },
          response: {
            success: 'boolean',
            data: 'created order object'
          }
        }
      ]
    },
    payments: {
      path: '/api/payments',
      methods: [
        {
          method: 'POST',
          endpoint: '/create-intent',
          description: 'Create payment intent (Stripe)',
          headers: {
            Authorization: 'Bearer <token>'
          },
          body: {
            orderId: 'string (required)'
          },
          response: {
            success: 'boolean',
            clientSecret: 'string'
          }
        },
        {
          method: 'POST',
          endpoint: '/webhook',
          description: 'Payment webhook endpoint',
          response: {
            received: 'boolean'
          }
        }
      ]
    }
  },
  models: {
    User: {
      name: 'string (required)',
      email: 'string (required, unique)',
      password: 'string (required, hashed)',
      role: 'string (default: user)',
      isActive: 'boolean (default: true)',
      profile: {
        firstName: 'string',
        lastName: 'string',
        phone: 'string',
        address: 'object'
      },
      createdAt: 'Date',
      updatedAt: 'Date'
    },
    Product: {
      name: 'string (required)',
      description: 'string (required)',
      price: 'number (required)',
      category: 'string (required)',
      brand: 'string',
      stock: 'number (required)',
      images: 'array of strings',
      ratings: {
        average: 'number',
        count: 'number'
      },
      isActive: 'boolean (default: true)',
      createdAt: 'Date',
      updatedAt: 'Date'
    },
    Order: {
      user: 'ObjectId (required)',
      items: 'array of order items',
      total: 'number (required)',
      status: 'string (enum: pending, confirmed, shipped, delivered, cancelled)',
      shippingAddress: 'object (required)',
      paymentMethod: 'string (required)',
      paymentStatus: 'string (enum: pending, completed, failed)',
      createdAt: 'Date',
      updatedAt: 'Date'
    }
  }
};

// Generate HTML documentation
function generateHTMLDocs() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${apiDocs.info.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h2 { color: #007bff; margin-top: 30px; }
        h3 { color: #555; }
        .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; margin-right: 10px; }
        .GET { background-color: #28a745; }
        .POST { background-color: #007bff; }
        .PUT { background-color: #ffc107; color: #000; }
        .DELETE { background-color: #dc3545; }
        .code { background: #f4f4f4; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; }
        .model { background: #e9ecef; padding: 15px; margin: 10px 0; border-radius: 5px; }
        pre { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${apiDocs.info.title}</h1>
        <p><strong>Version:</strong> ${apiDocs.info.version}</p>
        <p>${apiDocs.info.description}</p>
        
        <h2>Base URLs</h2>
        ${apiDocs.servers.map(server => `
            <div class="code">
                <strong>${server.description}:</strong> ${server.url}
            </div>
        `).join('')}
        
        <h2>Authentication</h2>
        <p>Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:</p>
        <pre>Authorization: Bearer &lt;your_jwt_token&gt;</pre>
        
        <h2>API Endpoints</h2>
        
        ${Object.entries(apiDocs.endpoints).map(([section, data]) => `
            <h3>${section.charAt(0).toUpperCase() + section.slice(1)}</h3>
            ${data.methods.map(method => `
                <div class="endpoint">
                    <div>
                        <span class="method ${method.method}">${method.method}</span>
                        <strong>${data.path}${method.endpoint}</strong>
                    </div>
                    <p>${method.description}</p>
                    ${method.query ? `
                        <div><strong>Query Parameters:</strong></div>
                        <div class="code">${Object.entries(method.query).map(([key, value]) => `${key}: ${value}`).join('<br>')}</div>
                    ` : ''}
                    ${method.headers ? `
                        <div><strong>Headers:</strong></div>
                        <div class="code">${Object.entries(method.headers).map(([key, value]) => `${key}: ${value}`).join('<br>')}</div>
                    ` : ''}
                    ${method.body ? `
                        <div><strong>Request Body:</strong></div>
                        <div class="code">${Object.entries(method.body).map(([key, value]) => `${key}: ${value}`).join('<br>')}</div>
                    ` : ''}
                    <div><strong>Response:</strong></div>
                    <div class="code">${Object.entries(method.response).map(([key, value]) => `${key}: ${value}`).join('<br>')}</div>
                </div>
            `).join('')}
        `).join('')}
        
        <h2>Data Models</h2>
        ${Object.entries(apiDocs.models).map(([model, fields]) => `
            <div class="model">
                <h3>${model}</h3>
                <div class="code">
                    ${Object.entries(fields).map(([field, type]) => `${field}: ${type}`).join('<br>')}
                </div>
            </div>
        `).join('')}
        
        <h2>Error Responses</h2>
        <div class="model">
            <p>All endpoints return errors in the following format:</p>
            <pre>{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}</pre>
            <p><strong>Common HTTP Status Codes:</strong></p>
            <ul>
                <li><strong>400:</strong> Bad Request - Invalid input data</li>
                <li><strong>401:</strong> Unauthorized - Missing or invalid token</li>
                <li><strong>403:</strong> Forbidden - Insufficient permissions</li>
                <li><strong>404:</strong> Not Found - Resource not found</li>
                <li><strong>429:</strong> Too Many Requests - Rate limit exceeded</li>
                <li><strong>500:</strong> Internal Server Error - Server error</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

  const docsPath = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }

  fs.writeFileSync(path.join(docsPath, 'api-docs.html'), html);
  console.log('API documentation generated: docs/api-docs.html');
}

// Generate JSON documentation
function generateJSONDocs() {
  const docsPath = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }

  fs.writeFileSync(path.join(docsPath, 'api-docs.json'), JSON.stringify(apiDocs, null, 2));
  console.log('API documentation generated: docs/api-docs.json');
}

// Main execution
if (require.main === module) {
  generateHTMLDocs();
  generateJSONDocs();
}

module.exports = { generateHTMLDocs, generateJSONDocs, apiDocs };
