/**
 * Performance Monitor
 * Tracks API performance metrics and logs
 */

const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      endpoints: {}
    };
    
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Middleware to track request performance
   */
  trackRequest() {
    const self = this;
    return (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;

      res.send = function(data) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Update metrics
        self.metrics.requests++;
        self.metrics.responseTime.push(responseTime);

        // Track endpoint-specific metrics
        const endpoint = `${req.method} ${req.route?.path || req.path}`;
        if (!self.metrics.endpoints[endpoint]) {
          self.metrics.endpoints[endpoint] = {
            count: 0,
            avgResponseTime: 0,
            errors: 0
          };
        }
        self.metrics.endpoints[endpoint].count++;

        // Calculate average response time
        const endpointMetrics = self.metrics.endpoints[endpoint];
        endpointMetrics.avgResponseTime = 
          (endpointMetrics.avgResponseTime * (endpointMetrics.count - 1) + responseTime) / endpointMetrics.count;

        // Track errors
        if (res.statusCode >= 400) {
          self.metrics.errors++;
          endpointMetrics.errors++;
        }

        // Log slow requests (>2s)
        if (responseTime > 2000) {
          self.logSlowRequest(req, responseTime);
        }

        originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Log slow requests for analysis
   */
  logSlowRequest(req, responseTime) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      responseTime: responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    const logFile = path.join(this.logsDir, 'slow-requests.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    const responseTime = this.metrics.responseTime;
    const avgResponseTime = responseTime.length > 0 
      ? responseTime.reduce((a, b) => a + b, 0) / responseTime.length 
      : 0;

    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: Math.round(avgResponseTime) + 'ms',
      endpoints: this.metrics.endpoints,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      endpoints: {}
    };
  }

  /**
   * Export metrics to file
   */
  exportMetrics() {
    const metrics = this.getMetrics();
    const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(this.logsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
    return filepath;
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
