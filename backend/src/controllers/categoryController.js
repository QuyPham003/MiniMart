const { executeQuery, executeTransaction } = require('../config/database');

// Get all categories - simplified version
const getCategories = async (req, res) => {
  try {
    const categories = await executeQuery(`
      SELECT c.*, COUNT(p.product_id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id AND p.is_active = 1
      GROUP BY c.category_id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: categories,
        pagination: {
          page: 1,
          limit: 10,
          total: categories.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const categories = await executeQuery(
      'SELECT * FROM categories WHERE category_id = ?',
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: categories[0]
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { category_name, description } = req.body;

    // Check if category name already exists
    const existingCategory = await executeQuery(
      'SELECT category_id FROM categories WHERE category_name = ?',
      [category_name]
    );

    if (existingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists'
      });
    }

    // Insert new category
    const result = await executeQuery(
      'INSERT INTO categories (category_name, description) VALUES (?, ?)',
      [category_name, description]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category_id: result.insertId,
        category_name,
        description
      }
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, description } = req.body;

    console.log('Updating category with ID:', id, 'Data:', req.body);

    // Check if category exists
    const existingCategory = await executeQuery(
      'SELECT category_id FROM categories WHERE category_id = ?',
      [id]
    );

    if (existingCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category name already exists (excluding current category)
    if (category_name) {
      const nameCheck = await executeQuery(
        'SELECT category_id FROM categories WHERE category_name = ? AND category_id != ?',
        [category_name, id]
      );

      if (nameCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Category name already exists'
        });
      }
    }

    // Update category - only update provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (category_name !== undefined) {
      updateFields.push('category_name = ?');
      updateValues.push(category_name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    updateValues.push(id);
    
    if (updateFields.length === 0) { // No fields to update
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    await executeQuery(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE category_id = ?`,
      updateValues
    );

    console.log('Category updated successfully');

    res.json({
      success: true,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existingCategory = await executeQuery(
      'SELECT category_id FROM categories WHERE category_id = ?',
      [id]
    );

    if (existingCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productsInCategory = await executeQuery(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = 1',
      [id]
    );

    if (productsInCategory[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products'
      });
    }

    // Delete category
    await executeQuery('DELETE FROM categories WHERE category_id = ?', [id]);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.category_id = ? AND p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM products WHERE category_id = ? AND is_active = 1',
      [id]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory
};
