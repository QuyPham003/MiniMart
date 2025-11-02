const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { 
  getInventoryLogs, 
  adjustInventory, 
  getInventoryStats,
  getInventoryReport
} = require('../controllers/inventoryController');

// All authenticated users can view inventory logs
router.get('/', authenticate, getInventoryLogs);

// Staff and Admin can manage inventory
router.post('/adjust', authenticate, authorize('staff', 'admin'), adjustInventory);
router.get('/stats', authenticate, authorize('staff', 'admin'), getInventoryStats);
router.get('/report', authenticate, authorize('staff', 'admin'), getInventoryReport);

module.exports = router;
