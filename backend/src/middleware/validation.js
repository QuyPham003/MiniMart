const { body, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUser = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('full_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .isMobilePhone('vi-VN')
    .withMessage('Please provide a valid Vietnamese phone number'),
  
  body('role')
    .isIn(['admin', 'staff', 'cashier'])
    .withMessage('Role must be admin, staff, or cashier'),
  
  handleValidationErrors
];

// Product validation rules
const validateProduct = [
  body('product_name')
    .isLength({ min: 2, max: 200 })
    .withMessage('Product name must be between 2 and 200 characters'),
  
  body('barcode')
    .optional()
    .isLength({ min: 8, max: 50 })
    .withMessage('Barcode must be between 8 and 50 characters'),
  
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('purchase_price')
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be a positive number'),
  
  body('sale_price')
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number'),
  
  body('unit')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Unit must be maximum 20 characters'),
  
  body('current_stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Current stock must be a non-negative integer'),
  
  body('min_stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be a non-negative integer'),
  
  handleValidationErrors
];

// Category validation rules
const validateCategory = [
  body('category_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be maximum 500 characters'),
  
  handleValidationErrors
];

// Supplier validation rules
const validateSupplier = [
  body('supplier_name')
    .isLength({ min: 2, max: 200 })
    .withMessage('Supplier name must be between 2 and 200 characters'),
  
  body('contact_person')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Contact person name must be maximum 100 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('vi-VN')
    .withMessage('Please provide a valid Vietnamese phone number'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

// Purchase Order validation rules
const validatePurchaseOrder = [
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('Supplier ID must be a positive integer'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product_id')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  
  handleValidationErrors
];

// Sale validation rules
const validateSale = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product_id')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  
  body('cash_received')
    .isFloat({ min: 0 })
    .withMessage('Cash received must be a non-negative number'),
  
  body('payment_method')
    .optional()
    .isIn(['cash', 'card', 'transfer'])
    .withMessage('Payment method must be cash, card, or transfer'),
  
  handleValidationErrors
];

// Discount validation rules
const validateDiscount = [
  body('discount_name')
    .isLength({ min: 2, max: 200 })
    .withMessage('Discount name must be between 2 and 200 characters'),
  
  body('discount_type')
    .isIn(['percentage', 'amount'])
    .withMessage('Discount type must be percentage or amount'),
  
  body('discount_value')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a non-negative number'),
  
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('end_date')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUser,
  validateProduct,
  validateCategory,
  validateSupplier,
  validatePurchaseOrder,
  validateSale,
  validateDiscount
};
