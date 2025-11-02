const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: './config.env' });

const { testConnection } = require('./config/database');
const { authenticate } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes');
const discountRoutes = require('./routes/discountRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const utilityRoutes = require('./routes/utilityRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - Increased for comprehensive testing
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // limit each IP to 10000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    const { executeQuery } = require('./config/database');
    const result = await executeQuery('SELECT COUNT(*) as count FROM products');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test products endpoint without auth
app.get('/api/test-products', async (req, res) => {
  try {
    const { executeQuery } = require('./config/database');
    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
      LIMIT 5
    `);
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Test products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test products endpoint with auth
app.get('/api/test-products-auth', authenticate, async (req, res) => {
  try {
    const { executeQuery } = require('./config/database');
    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
      LIMIT 5
    `);
    res.json({
      success: true,
      data: products,
      user: req.user
    });
  } catch (error) {
    console.error('Test products auth error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Simple test endpoint
app.get('/api/test-simple', authenticate, async (req, res) => {
  try {
    const { executeQuery } = require('./config/database');
    const products = await executeQuery('SELECT * FROM products LIMIT 5');
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Simple test error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
app.get('/api/test-products-controller', authenticate, async (req, res) => {
  try {
    const { executeQuery } = require('./config/database');
    const { page = 1, limit = 10, search = '', category_id = '', min_price = '', max_price = '', low_stock = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.product_name LIKE ? OR p.barcode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      query += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (min_price) {
      query += ` AND p.sale_price >= ?`;
      params.push(min_price);
    }

    if (max_price) {
      query += ` AND p.sale_price <= ?`;
      params.push(max_price);
    }

    if (low_stock === 'true') {
      query += ` AND p.current_stock <= p.min_stock`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    console.log('Query:', query);
    console.log('Params:', params);
    const products = await executeQuery(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
    `;
    const countParams = [];

    if (search) {
      countQuery += ` AND (p.product_name LIKE ? OR p.barcode LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      countQuery += ` AND p.category_id = ?`;
      countParams.push(category_id);
    }

    if (min_price) {
      countQuery += ` AND p.sale_price >= ?`;
      countParams.push(min_price);
    }

    if (max_price) {
      countQuery += ` AND p.sale_price <= ?`;
      countParams.push(max_price);
    }

    if (low_stock === 'true') {
      countQuery += ` AND p.current_stock <= p.min_stock`;
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        data: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Test products controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/utility', utilityRoutes);

// Serve static files
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
