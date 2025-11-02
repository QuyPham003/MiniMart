const { executeQuery, executeTransaction } = require('../config/database');

// Get inventory logs - simplified version
const getInventoryLogs = async (req, res) => {
  try {
    const logs = await executeQuery(`
      SELECT il.*, p.product_name, p.barcode, u.full_name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.product_id
      LEFT JOIN users u ON il.user_id = u.user_id
      ORDER BY il.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: logs,
        pagination: {
          page: 1,
          limit: 10,
          total: logs.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get inventory logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Adjust inventory manually
const adjustInventory = async (req, res) => {
  try {
    const { product_id, quantity_change, notes = '' } = req.body;
    const userId = req.user.user_id;

    // Check if product exists
    const product = await executeQuery(
      'SELECT product_id, product_name, current_stock FROM products WHERE product_id = ? AND is_active = 1',
      [product_id]
    );

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const currentStock = product[0].current_stock;
    const newStock = currentStock + quantity_change;

    // Check if new stock would be negative
    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for adjustment'
      });
    }

    // Start transaction
    const queries = [];

    // Update product stock
    queries.push({
      query: 'UPDATE products SET current_stock = ? WHERE product_id = ?',
      params: [newStock, product_id]
    });

    // Create inventory log
    queries.push({
      query: `
        INSERT INTO inventory_logs (product_id, user_id, transaction_type, 
                                   quantity_change, previous_stock, new_stock, 
                                   reference_type, notes)
        VALUES (?, ?, 'adjustment', ?, ?, ?, 'manual', ?)
      `,
      params: [product_id, userId, quantity_change, currentStock, newStock, notes]
    });

    // Execute transaction
    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        product_name: product[0].product_name,
        previous_stock: currentStock,
        new_stock: newStock,
        quantity_change
      }
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get inventory statistics
const getInventoryStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    // Get overall inventory stats
    const overallStats = await executeQuery(`
      SELECT 
        COUNT(DISTINCT product_id) as total_products,
        SUM(CASE WHEN transaction_type = 'in' THEN quantity_change ELSE 0 END) as total_in,
        SUM(CASE WHEN transaction_type = 'out' THEN ABS(quantity_change) ELSE 0 END) as total_out,
        SUM(CASE WHEN transaction_type = 'adjustment' THEN quantity_change ELSE 0 END) as total_adjustments
      FROM inventory_logs
      ${dateFilter}
    `, params);

    // Get top products by movement
    const topProducts = await executeQuery(`
      SELECT 
        p.product_name,
        p.barcode,
        SUM(ABS(il.quantity_change)) as total_movement,
        SUM(CASE WHEN il.transaction_type = 'in' THEN il.quantity_change ELSE 0 END) as total_in,
        SUM(CASE WHEN il.transaction_type = 'out' THEN ABS(il.quantity_change) ELSE 0 END) as total_out
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.product_id
      ${dateFilter ? dateFilter.replace('created_at', 'il.created_at') : ''}
      GROUP BY p.product_id, p.product_name, p.barcode
      ORDER BY total_movement DESC
      LIMIT 10
    `, params);

    // Get low stock products
    const lowStockProducts = await executeQuery(`
      SELECT 
        product_name,
        barcode,
        current_stock,
        min_stock,
        (current_stock - min_stock) as stock_difference
      FROM products
      WHERE is_active = 1 AND current_stock <= min_stock
      ORDER BY stock_difference ASC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        top_products: topProducts,
        low_stock_products: lowStockProducts
      }
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get inventory report (in-out-stock) - simplified version
const getInventoryReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const report = await executeQuery(`
      SELECT 
        p.product_id,
        p.product_name,
        p.barcode,
        p.current_stock,
        COUNT(il.log_id) as total_transactions,
        SUM(CASE WHEN il.transaction_type = 'in' THEN il.quantity_change ELSE 0 END) as total_in,
        SUM(CASE WHEN il.transaction_type = 'out' THEN ABS(il.quantity_change) ELSE 0 END) as total_out
      FROM products p
      LEFT JOIN inventory_logs il ON p.product_id = il.product_id 
        AND DATE(il.created_at) BETWEEN ? AND ?
      WHERE p.is_active = 1
      GROUP BY p.product_id, p.product_name, p.barcode, p.current_stock
      ORDER BY p.product_name
      LIMIT 20
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get inventory report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getInventoryLogs,
  adjustInventory,
  getInventoryStats,
  getInventoryReport
};
