const { executeQuery, executeTransaction } = require('../config/database');

// Get all purchase orders - simplified version
const getPurchaseOrders = async (req, res) => {
  try {
    const purchaseOrders = await executeQuery(`
      SELECT po.*, s.supplier_name, u.full_name as staff_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      LEFT JOIN users u ON po.user_id = u.user_id
      ORDER BY po.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: purchaseOrders,
        pagination: {
          page: 1,
          limit: 10,
          total: purchaseOrders.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get purchase order by ID with items
const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get purchase order info
    const purchaseOrders = await executeQuery(`
      SELECT po.*, s.supplier_name, u.full_name as staff_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      LEFT JOIN users u ON po.user_id = u.user_id
      WHERE po.purchase_order_id = ?
    `, [id]);

    if (purchaseOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Get purchase order items
    const items = await executeQuery(`
      SELECT poi.*, p.product_name, p.barcode, p.unit
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.product_id
      WHERE poi.purchase_order_id = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        ...purchaseOrders[0],
        items
      }
    });
  } catch (error) {
    console.error('Get purchase order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create purchase order
const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, items, notes = '' } = req.body;
    const userId = req.user.user_id;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Generate order number
    const orderNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    // Start transaction
    const queries = [];

    // Create purchase order record
    queries.push({
      query: `
        INSERT INTO purchase_orders (order_number, supplier_id, user_id, total_amount, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [orderNumber, supplier_id, userId, totalAmount, notes]
    });

    // Create purchase order items and update inventory
    for (const item of items) {
      // Check if product exists
      const product = await executeQuery(
        'SELECT product_id, current_stock FROM products WHERE product_id = ? AND is_active = 1',
        [item.product_id]
      );

      if (product.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`
        });
      }

      // Add purchase order item (will be executed in transaction)
      queries.push({
        query: `
          INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price, total_price)
          VALUES (LAST_INSERT_ID(), ?, ?, ?, ?)
        `,
        params: [item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
      });

      // Update product stock
      queries.push({
        query: `
          UPDATE products 
          SET current_stock = current_stock + ?
          WHERE product_id = ?
        `,
        params: [item.quantity, item.product_id]
      });

      // Create inventory log
      queries.push({
        query: `
          INSERT INTO inventory_logs (product_id, user_id, transaction_type, 
                                     quantity_change, previous_stock, new_stock, 
                                     reference_id, reference_type, notes)
          VALUES (?, ?, 'in', ?, ?, ?, LAST_INSERT_ID(), 'purchase', 'Nhập hàng')
        `,
        params: [item.product_id, userId, item.quantity, 
                 product[0].current_stock, product[0].current_stock + item.quantity]
      });
    }

    // Execute transaction
    await executeTransaction(queries);

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        order_number: orderNumber,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update purchase order status
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if purchase order exists
    const existingOrder = await executeQuery(
      'SELECT purchase_order_id, status FROM purchase_orders WHERE purchase_order_id = ?',
      [id]
    );

    if (existingOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Update status
    await executeQuery(
      'UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE purchase_order_id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: 'Purchase order status updated successfully'
    });
  } catch (error) {
    console.error('Update purchase order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete purchase order
const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if purchase order exists
    const existingOrder = await executeQuery(
      'SELECT purchase_order_id, status FROM purchase_orders WHERE purchase_order_id = ?',
      [id]
    );

    if (existingOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Only allow deletion of pending orders
    if (existingOrder[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending purchase orders can be deleted'
      });
    }

    // Get purchase order items to reverse inventory
    const items = await executeQuery(`
      SELECT poi.*, p.current_stock
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.product_id
      WHERE poi.purchase_order_id = ?
    `, [id]);

    // Start transaction to reverse inventory changes
    const queries = [];

    for (const item of items) {
      // Reverse inventory changes
      queries.push({
        query: `
          UPDATE products 
          SET current_stock = current_stock - ?
          WHERE product_id = ?
        `,
        params: [item.quantity, item.product_id]
      });

      // Create inventory log for reversal
      queries.push({
        query: `
          INSERT INTO inventory_logs (product_id, user_id, transaction_type, 
                                     quantity_change, previous_stock, new_stock, 
                                     reference_id, reference_type, notes)
          VALUES (?, ?, 'adjustment', ?, ?, ?, ?, 'purchase', 'Hủy phiếu nhập')
        `,
        params: [item.product_id, req.user.user_id, -item.quantity, 
                 item.current_stock, item.current_stock - item.quantity, id]
      });
    }

    // Delete purchase order (cascade will delete items)
    queries.push({
      query: 'DELETE FROM purchase_orders WHERE purchase_order_id = ?',
      params: [id]
    });

    // Execute transaction
    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  } catch (error) {
    console.error('Delete purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder
};
