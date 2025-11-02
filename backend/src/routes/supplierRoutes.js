const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validateSupplier } = require('../middleware/validation');
const { 
  getSuppliers, 
  getSupplierById, 
  createSupplier, 
  updateSupplier, 
  deleteSupplier,
  getPurchaseOrdersBySupplier
} = require('../controllers/supplierController');

// All authenticated users can view suppliers
router.get('/', authenticate, getSuppliers);
router.get('/:id', authenticate, getSupplierById);
router.get('/:id/purchase-orders', authenticate, getPurchaseOrdersBySupplier);

// Admin and Staff can manage suppliers
router.post('/', authenticate, authorize('admin', 'staff'), validateSupplier, createSupplier);
router.put('/:id', authenticate, authorize('admin', 'staff'), updateSupplier);
router.delete('/:id', authenticate, authorize('admin', 'staff'), deleteSupplier);

module.exports = router;
