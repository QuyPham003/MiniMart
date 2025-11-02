const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { 
  getDashboard, 
  getRevenueReport, 
  getProductReport, 
  getPurchaseReport 
} = require('../controllers/reportController');

// All authenticated users can access dashboard
router.get('/dashboard', authenticate, getDashboard);

// Admin and Staff can access reports
router.get('/revenue', authenticate, authorize('admin', 'staff'), getRevenueReport);
router.get('/products', authenticate, authorize('admin', 'staff'), getProductReport);
router.get('/purchases', authenticate, authorize('admin', 'staff'), getPurchaseReport);

module.exports = router;
