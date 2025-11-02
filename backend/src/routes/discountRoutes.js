const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateDiscount } = require('../middleware/validation');
const { 
  getDiscounts, 
  getDiscountById, 
  createDiscount, 
  updateDiscount, 
  deleteDiscount,
  getActiveDiscounts,
  calculateDiscountAmount
} = require('../controllers/discountController');

// All authenticated users can view discounts
router.get('/', authenticate, getDiscounts);
router.get('/active', authenticate, getActiveDiscounts);
router.get('/:id', authenticate, getDiscountById);
router.post('/calculate', authenticate, calculateDiscountAmount);

// Admin only routes
router.post('/', authenticate, authorize('admin'), validateDiscount, createDiscount);
router.put('/:id', authenticate, authorize('admin'), updateDiscount);
router.delete('/:id', authenticate, authorize('admin'), deleteDiscount);

module.exports = router;
