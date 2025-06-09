/**
 * Not Found Middleware
 * Handles 404 errors for unmatched routes
 */

const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  
  res.status(404).json({
    success: false,
    error: {
      name: 'NotFoundError',
      message: message,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = notFound;
