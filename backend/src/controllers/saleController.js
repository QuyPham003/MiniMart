const { executeQuery, executeTransaction } = require('../config/database');
const { sendInvoiceEmail } = require('../services/emailService');

// Get all sales - simplified version
const getSales = async (req, res) => {
  try {
    const sales = await executeQuery(`
      SELECT s.*, u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.user_id
      ORDER BY s.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: sales,
        pagination: {
          page: 1,
          limit: 10,
          total: sales.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get sale by ID with items
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get sale info
    const sales = await executeQuery(`
      SELECT s.*, u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.sale_id = ?
    `, [id]);

    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Get sale items
    const items = await executeQuery(`
      SELECT si.*, p.product_name, p.barcode, p.unit
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.product_id
      WHERE si.sale_id = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        ...sales[0],
        items
      }
    });
  } catch (error) {
    console.error('Get sale by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create sale
// Create new sale
const createSale = async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, payment_method, items, discount_id, cash_received } = req.body;
    const user_id = req.user.user_id;

    console.log('Creating sale with data:', req.body);

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale must have at least one item'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      const product = await executeQuery(
        'SELECT sale_price, current_stock FROM products WHERE product_id = ? AND is_active = 1',
        [item.product_id]
      );

      if (product.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`
        });
      }

      if (product[0].current_stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for product ${item.product_id}. Available: ${product[0].current_stock}`
        });
      }

      subtotal += product[0].sale_price * item.quantity;
    }

    // Calculate discount
    let discount_amount = 0;
    if (discount_id) {
      const discount = await executeQuery(
        'SELECT discount_type, discount_value FROM discounts WHERE discount_id = ? AND is_active = 1',
        [discount_id]
      );
      if (discount.length > 0) {
        if (discount[0].discount_type === 'percentage') {
          discount_amount = subtotal * (discount[0].discount_value / 100);
        } else {
          discount_amount = discount[0].discount_value;
        }
      }
    }

    const totalAmount = subtotal - discount_amount;
    const changeAmount = cash_received - totalAmount;

    // Create sale record
    const saleResult = await executeQuery(`
      INSERT INTO sales (invoice_number, user_id, customer_name, customer_phone, customer_email,
                        subtotal, discount_amount, total_amount, cash_received, 
                        change_amount, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [invoiceNumber, user_id, customer_name || null, customer_phone || null, customer_email || null,
         subtotal, discount_amount, totalAmount, cash_received, 
         changeAmount, payment_method]);

    const saleId = saleResult.insertId;

    // Create sale items and update inventory
    for (const item of items) {
      const product = await executeQuery(
        'SELECT sale_price, current_stock FROM products WHERE product_id = ?',
        [item.product_id]
      );

      const unitPrice = product[0].sale_price;
      const itemTotal = unitPrice * item.quantity;
      const previousStock = product[0].current_stock;
      const newStock = previousStock - item.quantity;

      // Create sale item
      await executeQuery(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `, [saleId, item.product_id, item.quantity, unitPrice, itemTotal]);

      // Update product stock
      await executeQuery(
        'UPDATE products SET current_stock = current_stock - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );

      // Log inventory change
      await executeQuery(`
        INSERT INTO inventory_logs (product_id, user_id, transaction_type, quantity_change, previous_stock, new_stock, reference_id, reference_type, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item.product_id, user_id, 'out', -item.quantity, previousStock, newStock, saleId, 'sale', 'Bán hàng']);
    }

    console.log('Sale created successfully with ID:', saleId);

    // Send invoice email if customer_email is provided
    let emailResult = null;
    if (customer_email && customer_email.trim()) {
      try {
        // Get cashier name for email
        const cashierData = await executeQuery(
          'SELECT full_name FROM users WHERE user_id = ?',
          [user_id]
        );

        // Get full sale items with product names
        const saleItems = await executeQuery(`
          SELECT si.*, p.product_name
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.product_id
          WHERE si.sale_id = ?
        `, [saleId]);

        const invoiceData = {
          invoice_number: invoiceNumber,
          customer_name: customer_name || 'Khách lẻ',
          customer_phone: customer_phone || '',
          cashier_name: cashierData[0]?.full_name || 'N/A',
          items: saleItems,
          subtotal: subtotal,
          discount_amount: discount_amount,
          total_amount: totalAmount,
          cash_received: cash_received,
          change_amount: changeAmount,
          payment_method: payment_method,
          created_at: new Date()
        };

        emailResult = await sendInvoiceEmail(customer_email, invoiceData);
        console.log('Email send result:', emailResult);
      } catch (emailError) {
        console.error('Error sending email (non-blocking):', emailError);
        // Don't fail the sale if email fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: {
        sale_id: saleId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        change_amount: changeAmount,
        email_sent: emailResult?.success || false
      }
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get product by barcode for POS
const getProductByBarcodeForPOS = async (req, res) => {
  try {
    const { barcode } = req.params;

    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.barcode = ? AND p.is_active = 1
    `, [barcode]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[0];

    if (product.current_stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    res.json({
      success: true,
      data: {
        product_id: product.product_id,
        product_name: product.product_name,
        barcode: product.barcode,
        category_name: product.category_name,
        sale_price: product.sale_price,
        unit: product.unit,
        current_stock: product.current_stock,
        image_url: product.image_url
      }
    });
  } catch (error) {
    console.error('Get product by barcode for POS error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get sales statistics
const getSalesStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_sale_amount,
        SUM(discount_amount) as total_discounts,
        COUNT(DISTINCT user_id) as active_cashiers
      FROM sales
      ${dateFilter}
    `, params);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getSales,
  getSaleById,
  createSale,
  getProductByBarcodeForPOS,
  getSalesStats
};
