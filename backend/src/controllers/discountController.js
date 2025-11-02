const { executeQuery } = require('../config/database');

// Get all discounts - simplified version
const getDiscounts = async (req, res) => {
  try {
    const discounts = await executeQuery(`
      SELECT *,
        CASE
          WHEN start_date <= NOW() AND end_date >= NOW() THEN 'active'
          WHEN end_date < NOW() THEN 'expired'
          ELSE 'upcoming'
        END as status_text
      FROM discounts
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: discounts,
        pagination: {
          page: 1,
          limit: 10,
          total: discounts.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get discount by ID
const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    const discounts = await executeQuery(
      'SELECT * FROM discounts WHERE discount_id = ?',
      [id]
    );

    if (discounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    res.json({
      success: true,
      data: discounts[0]
    });
  } catch (error) {
    console.error('Get discount by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create discount
const createDiscount = async (req, res) => {
  try {
    const { discount_name, discount_type, discount_value, start_date, end_date, is_active = true } = req.body;

    // Validate dates
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if discount name already exists
    const existingDiscount = await executeQuery(
      'SELECT discount_id FROM discounts WHERE discount_name = ?',
      [discount_name]
    );

    if (existingDiscount.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount name already exists'
      });
    }

    // Insert new discount
    const result = await executeQuery(
      'INSERT INTO discounts (discount_name, discount_type, discount_value, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [discount_name, discount_type, discount_value, start_date, end_date, is_active]
    );

    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      data: {
        discount_id: result.insertId,
        discount_name,
        discount_type,
        discount_value,
        start_date,
        end_date,
        is_active
      }
    });
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update discount
const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { discount_name, discount_type, discount_value, start_date, end_date, is_active } = req.body;

    // Check if discount exists
    const existingDiscount = await executeQuery(
      'SELECT discount_id FROM discounts WHERE discount_id = ?',
      [id]
    );

    if (existingDiscount.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Validate dates
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if discount name already exists (excluding current discount)
    const nameCheck = await executeQuery(
      'SELECT discount_id FROM discounts WHERE discount_name = ? AND discount_id != ?',
      [discount_name, id]
    );

    if (nameCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount name already exists'
      });
    }

    // Update discount
    await executeQuery(
      'UPDATE discounts SET discount_name = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, is_active = ? WHERE discount_id = ?',
      [discount_name, discount_type, discount_value, start_date, end_date, is_active, id]
    );

    res.json({
      success: true,
      message: 'Discount updated successfully'
    });
  } catch (error) {
    console.error('Update discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete discount
const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if discount exists
    const existingDiscount = await executeQuery(
      'SELECT discount_id FROM discounts WHERE discount_id = ?',
      [id]
    );

    if (existingDiscount.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Delete discount
    await executeQuery('DELETE FROM discounts WHERE discount_id = ?', [id]);

    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active discounts
const getActiveDiscounts = async (req, res) => {
  try {
    const discounts = await executeQuery(`
      SELECT * FROM discounts 
      WHERE is_active = 1 AND CURDATE() BETWEEN start_date AND end_date
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: discounts
    });
  } catch (error) {
    console.error('Get active discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Calculate discount amount
const calculateDiscountAmount = async (req, res) => {
  try {
    const { discount_id, total_amount } = req.body;

    // Get discount details
    const discounts = await executeQuery(
      'SELECT * FROM discounts WHERE discount_id = ? AND is_active = 1 AND CURDATE() BETWEEN start_date AND end_date',
      [discount_id]
    );

    if (discounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active discount not found'
      });
    }

    const discount = discounts[0];
    let discountAmount = 0;

    if (discount.discount_type === 'percentage') {
      discountAmount = (total_amount * discount.discount_value) / 100;
    } else if (discount.discount_type === 'amount') {
      discountAmount = Math.min(discount.discount_value, total_amount);
    }

    res.json({
      success: true,
      data: {
        discount_amount: Math.round(discountAmount),
        discount_name: discount.discount_name,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value
      }
    });
  } catch (error) {
    console.error('Calculate discount amount error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getActiveDiscounts,
  calculateDiscountAmount
};
