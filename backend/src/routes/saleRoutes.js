const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateSale } = require('../middleware/validation');
const { 
  getSales, 
  getSaleById, 
  createSale, 
  getProductByBarcodeForPOS,
  getSalesStats
} = require('../controllers/saleController');

// All authenticated users can view sales
router.get('/', authenticate, getSales);
router.get('/stats', authenticate, authorize('cashier', 'admin'), getSalesStats);
router.get('/barcode/:barcode', authenticate, getProductByBarcodeForPOS);
router.get('/:id', authenticate, getSaleById);

// Cashier and Admin can manage sales
router.post('/', authenticate, authorize('cashier', 'admin'), validateSale, createSale);

module.exports = router;
