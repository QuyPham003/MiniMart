const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { printInvoice, exportReport, getActivityLogs, upload } = require('../controllers/utilityController');

// Print invoice
router.get('/print/:id', authenticate, printInvoice);

// Export reports
router.get('/export/:type', authenticate, exportReport);

// Get activity logs (Admin only)
router.get('/activity-logs', authenticate, authorize(['admin']), getActivityLogs);

// File upload endpoint
router.post('/upload', authenticate, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        path: req.file.path,
        url: `/uploads/products/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed'
    });
  }
});

module.exports = router;
