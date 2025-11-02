const { executeQuery } = require('../config/database');

// Get dashboard data
const getDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Get today's revenue
    const todayRevenue = await executeQuery(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM sales
      WHERE DATE(created_at) = ?
    `, [today]);

    // Get total products
    const totalProducts = await executeQuery(`
      SELECT COUNT(*) as count
      FROM products
      WHERE is_active = 1
    `);

    // Get low stock products
    const lowStockProducts = await executeQuery(`
      SELECT COUNT(*) as count
      FROM products
      WHERE is_active = 1 AND current_stock <= min_stock
    `);

    // Get today's sales count
    const todaySales = await executeQuery(`
      SELECT COUNT(*) as count
      FROM sales
      WHERE DATE(created_at) = ?
    `, [today]);

    // Get total users
    const totalUsers = await executeQuery(`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_active = 1
    `);

    // Get monthly revenue
    const monthlyRevenue = await executeQuery(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM sales
      WHERE DATE(created_at) >= ?
    `, [startOfMonth]);

    // Get recent sales
    const recentSales = await executeQuery(`
      SELECT s.invoice_number, s.total_amount, s.created_at, u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.user_id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    // Get top selling products
    const topProducts = await executeQuery(`
      SELECT p.product_name, SUM(si.quantity) as total_sold, SUM(si.total_price) as total_revenue
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.product_id
      LEFT JOIN sales s ON si.sale_id = s.sale_id
      WHERE DATE(s.created_at) >= ?
      GROUP BY p.product_id, p.product_name
      ORDER BY total_sold DESC
      LIMIT 5
    `, [startOfMonth]);

    // Get inventory alerts
    const inventoryAlerts = await executeQuery(`
      SELECT product_name, current_stock, min_stock
      FROM products
      WHERE is_active = 1 AND current_stock <= min_stock
      ORDER BY current_stock ASC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        todayRevenue: todayRevenue[0].revenue,
        totalProducts: totalProducts[0].count,
        lowStockProducts: lowStockProducts[0].count,
        todaySales: todaySales[0].count,
        totalUsers: totalUsers[0].count,
        monthlyRevenue: monthlyRevenue[0].revenue,
        recentSales,
        topProducts,
        inventoryAlerts
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get revenue report - simplified version
const getRevenueReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const revenueData = await executeQuery(`
      SELECT 
        DATE(created_at) as period,
        COUNT(*) as sales_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_sale_amount,
        SUM(discount_amount) as total_discounts
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY period ASC
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: revenueData
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get product report
const getProductReport = async (req, res) => {
  try {
    const { report_type = 'best_selling', start_date, end_date } = req.query;

    let query = '';
    let params = [];

    if (report_type === 'best_selling') {
      query = `
        SELECT 
          p.product_name,
          p.barcode,
          c.category_name,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          AVG(si.unit_price) as avg_price
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN sales s ON si.sale_id = s.sale_id
        WHERE 1=1
      `;

      if (start_date && end_date) {
        query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
        params.push(start_date, end_date);
      }

      query += `
        GROUP BY p.product_id, p.product_name, p.barcode, c.category_name
        ORDER BY total_sold DESC
        LIMIT 20
      `;
    } else if (report_type === 'low_stock') {
      query = `
        SELECT 
          p.product_name,
          p.barcode,
          c.category_name,
          p.current_stock,
          p.min_stock,
          p.sale_price,
          p.purchase_price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE p.is_active = 1 AND p.current_stock <= p.min_stock
        ORDER BY p.current_stock ASC
      `;
    }

    const productData = await executeQuery(query, params);

    res.json({
      success: true,
      data: productData
    });
  } catch (error) {
    console.error('Get product report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get purchase report
const getPurchaseReport = async (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;

    let query = `
      SELECT 
        po.order_number,
        po.total_amount,
        po.status,
        po.created_at,
        s.supplier_name,
        u.full_name as staff_name,
        COUNT(poi.item_id) as item_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      LEFT JOIN users u ON po.user_id = u.user_id
      LEFT JOIN purchase_order_items poi ON po.purchase_order_id = poi.purchase_order_id
      WHERE 1=1
    `;
    const params = [];

    if (start_date && end_date) {
      query += ` AND DATE(po.created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    if (supplier_id) {
      query += ` AND po.supplier_id = ?`;
      params.push(supplier_id);
    }

    query += `
      GROUP BY po.purchase_order_id, po.order_number, po.total_amount, 
               po.status, po.created_at, s.supplier_name, u.full_name
      ORDER BY po.created_at DESC
    `;

    const purchaseData = await executeQuery(query, params);

    res.json({
      success: true,
      data: purchaseData
    });
  } catch (error) {
    console.error('Get purchase report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getDashboard,
  getRevenueReport,
  getProductReport,
  getPurchaseReport
};
