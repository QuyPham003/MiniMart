const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateCategory } = require('../middleware/validation');
const { 
  getCategories, 
  getCategoryById, 
  createCategory, 
  updateCategory, 
  deleteCategory,
  getProductsByCategory
} = require('../controllers/categoryController');

// All authenticated users can view categories
router.get('/', authenticate, getCategories);
router.get('/:id', authenticate, getCategoryById);
router.get('/:id/products', authenticate, getProductsByCategory);

// Admin only routes
router.post('/', authenticate, authorize('admin'), validateCategory, createCategory);
router.put('/:id', authenticate, authorize('admin'), updateCategory);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

module.exports = router;
