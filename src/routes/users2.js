/**
 * User Routes
 * Routes for user management functionality
 */

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deactivateAccount,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus
} = require('../controllers/userController');

// User profile routes
router.get('/profile', authenticate, getUserProfile);

router.put('/profile',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number')
  ],
  validate,
  updateUserProfile
);

router.put('/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      })
  ],
  validate,
  changePassword
);

router.delete('/account',
  authenticate,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required to deactivate account')
  ],
  validate,
  deactivateAccount
);

// Address management routes
router.get('/addresses', authenticate, getUserAddresses);

router.post('/addresses',
  authenticate,
  [
    body('type')
      .isIn(['home', 'work', 'other'])
      .withMessage('Address type must be home, work, or other'),
    body('street')
      .notEmpty()
      .withMessage('Street address is required'),
    body('city')
      .notEmpty()
      .withMessage('City is required'),
    body('state')
      .notEmpty()
      .withMessage('State is required'),
    body('zipCode')
      .notEmpty()
      .withMessage('ZIP code is required'),
    body('country')
      .notEmpty()
      .withMessage('Country is required')
  ],
  validate,
  addUserAddress
);

router.put('/addresses/:addressId',
  authenticate,
  [
    param('addressId')
      .isMongoId()
      .withMessage('Invalid address ID'),
    body('type')
      .optional()
      .isIn(['home', 'work', 'other'])
      .withMessage('Address type must be home, work, or other'),
    body('street')
      .optional()
      .notEmpty()
      .withMessage('Street address cannot be empty'),
    body('city')
      .optional()
      .notEmpty()
      .withMessage('City cannot be empty'),
    body('state')
      .optional()
      .notEmpty()
      .withMessage('State cannot be empty'),
    body('zipCode')
      .optional()
      .notEmpty()
      .withMessage('ZIP code cannot be empty'),
    body('country')
      .optional()
      .notEmpty()
      .withMessage('Country cannot be empty')
  ],
  validate,
  updateUserAddress
);

router.delete('/addresses/:addressId',
  authenticate,
  [
    param('addressId')
      .isMongoId()
      .withMessage('Invalid address ID')
  ],
  validate,
  deleteUserAddress
);

// Admin-only routes
router.get('/',
  authenticate,
  isAdmin,
  getAllUsers
);

router.get('/:id',
  authenticate,
  isAdmin,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid user ID')
  ],
  validate,
  getUserById
);

router.put('/:id/role',
  authenticate,
  isAdmin,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid user ID'),
    body('role')
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin')
  ],
  validate,
  updateUserRole
);

router.put('/:id/status',
  authenticate,
  isAdmin,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid user ID'),
    body('isActive')
      .isBoolean()
      .withMessage('Status must be a boolean value')
  ],
  validate,
  updateUserStatus
);

module.exports = router;
