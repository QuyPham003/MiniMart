const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateInvoicePDF, exportExcelReport } = require('../utils/pdfGenerator');
const { logActivity, ACTIVITY_TYPES } = require('../utils/activityLogger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Print invoice
const printInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const pdf = await generateInvoicePDF(id);

    // Log activity
    await logActivity(userId, ACTIVITY_TYPES.SALE_PRINT, `In hóa đơn: ${id}`, 'sale', id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Print invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF'
    });
  }
};

// Export report
const exportReport = async (req, res) => {
  try {
    const { type } = req.params;
    const params = req.query;
    const userId = req.user.user_id;

    const buffer = await exportExcelReport(type, params);

    // Log activity
    await logActivity(userId, ACTIVITY_TYPES.REPORT_EXPORT, `Xuất báo cáo: ${type}`, 'report');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report'
    });
  }
};

// Get activity logs
const getActivityLogs = async (req, res) => {
  try {
    const { getActivityLogs } = require('../utils/activityLogger');
    const result = await getActivityLogs(req.query);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting activity logs'
    });
  }
};

module.exports = {
  upload,
  printInvoice,
  exportReport,
  getActivityLogs
};
