const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');
const { 
  getProducts, 
  getProductById, 
  getProductByBarcode, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductStats
} = require('../controllers/productController');

// All authenticated users can view products
router.get('/', authenticate, getProducts);
router.get('/stats', authenticate, authorize('admin', 'staff'), getProductStats);
router.get('/barcode/:barcode', authenticate, getProductByBarcode);
router.get('/:id', authenticate, getProductById);

// Admin and Staff can manage products
router.post('/', authenticate, authorize('admin', 'staff'), validateProduct, createProduct);
router.put('/:id', authenticate, authorize('admin', 'staff'), updateProduct);
router.delete('/:id', authenticate, authorize('admin', 'staff'), deleteProduct);

module.exports = router;
