const { generateSlug, sanitizeQuery, isValidEmail, formatPrice } = require('../utils/helpers');
const emailService = require('../utils/emailService');

describe('Utils Tests', () => {
  describe('Helpers', () => {
    describe('generateSlug', () => {
      it('should generate a valid slug from a string', () => {
        const result = generateSlug('Hello World Test');
        expect(result).toBe('hello-world-test');
      });

      it('should handle special characters', () => {
        const result = generateSlug('Test & Product @ 2024');
        expect(result).toBe('test-product-2024');
      });

      it('should handle empty string', () => {
        const result = generateSlug('');
        expect(result).toBe('');
      });
    });

    describe('sanitizeQuery', () => {
      it('should sanitize query parameters', () => {
        const query = {
          name: 'Test Product',
          $ne: 'malicious',
          price: { $gt: 100 }
        };
        const result = sanitizeQuery(query);
        expect(result).toEqual({
          name: 'Test Product',
          price: { $gt: 100 }
        });
      });

      it('should handle empty query', () => {
        const result = sanitizeQuery({});
        expect(result).toEqual({});
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct email addresses', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(isValidEmail('invalid-email')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('@domain.com')).toBe(false);
      });
    });

    describe('formatPrice', () => {
      it('should format prices correctly', () => {
        expect(formatPrice(1234.56)).toBe('$1,234.56');
        expect(formatPrice(99.99)).toBe('$99.99');
        expect(formatPrice(1000)).toBe('$1,000.00');
      });

      it('should handle zero and negative prices', () => {
        expect(formatPrice(0)).toBe('$0.00');
        expect(formatPrice(-50)).toBe('-$50.00');
      });
    });
  });

  describe('Email Service', () => {
    beforeEach(() => {
      // Mock the email service for testing
      jest.clearAllMocks();
    });

    it('should send welcome email', async () => {
      const mockSend = jest.spyOn(emailService, 'sendWelcomeEmail')
        .mockResolvedValue(true);

      const result = await emailService.sendWelcomeEmail('test@example.com', 'John Doe');
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith('test@example.com', 'John Doe');
    });

    it('should send order confirmation email', async () => {
      const mockSend = jest.spyOn(emailService, 'sendOrderConfirmation')
        .mockResolvedValue(true);

      const orderData = {
        orderId: '12345',
        total: 99.99,
        items: []
      };

      const result = await emailService.sendOrderConfirmation('test@example.com', orderData);
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith('test@example.com', orderData);
    });

    it('should handle email sending errors gracefully', async () => {
      const mockSend = jest.spyOn(emailService, 'sendWelcomeEmail')
        .mockRejectedValue(new Error('Email service unavailable'));

      await expect(emailService.sendWelcomeEmail('test@example.com', 'John Doe'))
        .rejects.toThrow('Email service unavailable');
    });
  });
});
