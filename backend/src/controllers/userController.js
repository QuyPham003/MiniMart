const { executeQuery, executeTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logActivity, ACTIVITY_TYPES } = require('../utils/activityLogger');

// Get all users - simplified version
const getUsers = async (req, res) => {
  try {
    const users = await executeQuery(`
      SELECT user_id, username, full_name, email, phone, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        data: users,
        pagination: {
          page: 1,
          limit: 10,
          total: users.length,
          pages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const users = await executeQuery(
      'SELECT user_id, username, full_name, email, phone, role, is_active, created_at FROM users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role } = req.body;

    console.log('Creating user with data:', req.body);

    // Check if username already exists
    const existingUser = await executeQuery(
      'SELECT user_id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert new user
    const result = await executeQuery(
      'INSERT INTO users (username, password, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, full_name || null, email || null, phone || null, role]
    );

    console.log('User created successfully with ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user_id: result.insertId,
        username,
        full_name,
        email,
        phone,
        role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, email, phone, role, is_active } = req.body;

    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT user_id FROM users WHERE user_id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username already exists (excluding current user)
    if (username) {
      const usernameCheck = await executeQuery(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, id]
      );

      if (usernameCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Update user - only update provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(role);
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
    
    await executeQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT user_id FROM users WHERE user_id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is trying to delete themselves
    if (parseInt(id) === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Delete user
    await executeQuery('DELETE FROM users WHERE user_id = ?', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff_count,
        SUM(CASE WHEN role = 'cashier' THEN 1 ELSE 0 END) as cashier_count,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_users
      FROM users
    `);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats
};
