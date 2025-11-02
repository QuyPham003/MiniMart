const { executeQuery, executeTransaction } = require('../config/database');
const { logActivity, ACTIVITY_TYPES } = require('../utils/activityLogger');

// Get all products - simplified version
const getProducts = async (req, res) => {
  try {
    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: products,
        pagination: {
          page: 1,
          limit: 10,
          total: products.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const products = await executeQuery(`
      SELECT p.*, c.category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id = ?
    `, [id]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get product by barcode
const getProductByBarcode = async (req, res) => {
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

    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Get product by barcode error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create product
const createProduct = async (req, res) => {
  try {
    const { product_name, barcode, category_id, purchase_price, sale_price, unit, min_stock, image_url } = req.body;

    console.log('Creating product with data:', req.body);

    // Check if barcode already exists
    if (barcode) {
      const existingProduct = await executeQuery(
        'SELECT product_id FROM products WHERE barcode = ?',
        [barcode]
      );

      if (existingProduct.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Barcode already exists'
        });
      }
    }

    // Insert new product
    const result = await executeQuery(`
      INSERT INTO products (product_name, barcode, category_id, purchase_price, sale_price, unit, min_stock, image_url, current_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [product_name, barcode || null, category_id, purchase_price, sale_price, unit || 'cái', min_stock || 0, image_url || null]);

    console.log('Product created successfully with ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product_id: result.insertId,
        product_name,
        barcode,
        category_id,
        purchase_price,
        sale_price,
        unit,
        min_stock,
        image_url,
        current_stock: 0
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, barcode, category_id, purchase_price, sale_price, unit, min_stock, image_url, is_active } = req.body;

    console.log('Updating product with ID:', id, 'Data:', req.body);

    // Check if product exists
    const existingProduct = await executeQuery(
      'SELECT product_id FROM products WHERE product_id = ?',
      [id]
    );

    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if barcode already exists (excluding current product)
    if (barcode) {
      const barcodeCheck = await executeQuery(
        'SELECT product_id FROM products WHERE barcode = ? AND product_id != ?',
        [barcode, id]
      );

      if (barcodeCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Barcode already exists'
        });
      }
    }

    // Update product - only update provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (product_name !== undefined) {
      updateFields.push('product_name = ?');
      updateValues.push(product_name);
    }
    if (barcode !== undefined) {
      updateFields.push('barcode = ?');
      updateValues.push(barcode);
    }
    if (category_id !== undefined) {
      updateFields.push('category_id = ?');
      updateValues.push(category_id);
    }
    if (purchase_price !== undefined) {
      updateFields.push('purchase_price = ?');
      updateValues.push(purchase_price);
    }
    if (sale_price !== undefined) {
      updateFields.push('sale_price = ?');
      updateValues.push(sale_price);
    }
    if (unit !== undefined) {
      updateFields.push('unit = ?');
      updateValues.push(unit);
    }
    if (min_stock !== undefined) {
      updateFields.push('min_stock = ?');
      updateValues.push(min_stock);
    }
    if (image_url !== undefined) {
      updateFields.push('image_url = ?');
      updateValues.push(image_url);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    await executeQuery(`
      UPDATE products 
      SET ${updateFields.join(', ')}
      WHERE product_id = ?
    `, updateValues);

    console.log('Product updated successfully');

    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await executeQuery(
      'SELECT product_id FROM products WHERE product_id = ?',
      [id]
    );

    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Soft delete (set is_active = 0)
    await executeQuery(
      'UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get product statistics
const getProductStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
        SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock_products,
        SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock_products,
        AVG(sale_price) as avg_price,
        SUM(current_stock * purchase_price) as total_inventory_value
      FROM products
    `);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats
};
