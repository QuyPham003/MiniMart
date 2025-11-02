const { executeQuery, executeTransaction } = require('../config/database');

// Get all suppliers - simplified version
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await executeQuery(`
      SELECT *
      FROM suppliers
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: suppliers,
        pagination: {
          page: 1,
          limit: 10,
          total: suppliers.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get supplier by ID
const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const suppliers = await executeQuery(
      'SELECT * FROM suppliers WHERE supplier_id = ?',
      [id]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: suppliers[0]
    });
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create supplier
const createSupplier = async (req, res) => {
  try {
    const { supplier_name, contact_person, phone, email, address } = req.body;

    // Check if supplier name already exists
    const existingSupplier = await executeQuery(
      'SELECT supplier_id FROM suppliers WHERE supplier_name = ?',
      [supplier_name]
    );

    if (existingSupplier.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name already exists'
      });
    }

    // Insert new supplier
    const result = await executeQuery(
      'INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [supplier_name, contact_person || null, phone || null, email || null, address || null]
    );

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        supplier_id: result.insertId,
        supplier_name,
        contact_person,
        phone,
        email,
        address
      }
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update supplier
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, contact_person, phone, email, address, is_active } = req.body;

    // Check if supplier exists
    const existingSupplier = await executeQuery(
      'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
      [id]
    );

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if supplier name already exists (excluding current supplier)
    const nameCheck = await executeQuery(
      'SELECT supplier_id FROM suppliers WHERE supplier_name = ? AND supplier_id != ?',
      [supplier_name, id]
    );

    if (nameCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name already exists'
      });
    }

    // Update supplier - only update provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (supplier_name !== undefined) {
      updateFields.push('supplier_name = ?');
      updateValues.push(supplier_name);
    }
    if (contact_person !== undefined) {
      updateFields.push('contact_person = ?');
      updateValues.push(contact_person);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    
    updateValues.push(id);
    
    if (updateFields.length === 0) { // No fields to update
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    await executeQuery(
      `UPDATE suppliers SET ${updateFields.join(', ')} WHERE supplier_id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete supplier
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const existingSupplier = await executeQuery(
      'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
      [id]
    );

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if supplier has purchase orders
    const purchaseOrders = await executeQuery(
      'SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?',
      [id]
    );

    if (purchaseOrders[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier with existing purchase orders'
      });
    }

    // Soft delete supplier
    await executeQuery(
      'UPDATE suppliers SET is_active = 0 WHERE supplier_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get purchase orders by supplier
const getPurchaseOrdersBySupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const purchaseOrders = await executeQuery(`
      SELECT po.*, u.full_name as staff_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.user_id = u.user_id
      WHERE po.supplier_id = ?
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM purchase_orders WHERE supplier_id = ?',
      [id]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      data: purchaseOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get purchase orders by supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrdersBySupplier
};
