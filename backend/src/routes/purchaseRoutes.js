const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validatePurchaseOrder } = require('../middleware/validation');
const { 
  getPurchaseOrders, 
  getPurchaseOrderById, 
  createPurchaseOrder, 
  updatePurchaseOrderStatus,
  deletePurchaseOrder
} = require('../controllers/purchaseController');

// All authenticated users can view purchase orders
router.get('/', authenticate, getPurchaseOrders);
router.get('/:id', authenticate, getPurchaseOrderById);

// Staff and Admin can manage purchase orders
router.post('/', authenticate, authorize('staff', 'admin'), validatePurchaseOrder, createPurchaseOrder);
router.put('/:id/status', authenticate, authorize('staff', 'admin'), updatePurchaseOrderStatus);
router.delete('/:id', authenticate, authorize('staff', 'admin'), deletePurchaseOrder);

module.exports = router;
