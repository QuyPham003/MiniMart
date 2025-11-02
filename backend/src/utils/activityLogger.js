const { executeQuery } = require('../config/database');

// Log user activity
const logActivity = async (userId, action, details = '', entityType = '', entityId = null) => {
  try {
    const query = `
      INSERT INTO activity_logs (user_id, action, details, entity_type, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    await executeQuery(query, [userId, action, details, entityType, entityId]);
  } catch (error) {
    console.error('Log activity error:', error);
    // Don't throw error to avoid breaking main functionality
  }
};

// Get activity logs
const getActivityLogs = async (params = {}) => {
  try {
    const { 
      user_id = '', 
      action = '', 
      entity_type = '', 
      start_date = '', 
      end_date = '',
      page = 1, 
      limit = 20 
    } = params;

    let whereConditions = [];
    let queryParams = [];

    if (user_id) {
      whereConditions.push('al.user_id = ?');
      queryParams.push(user_id);
    }

    if (action) {
      whereConditions.push('al.action LIKE ?');
      queryParams.push(`%${action}%`);
    }

    if (entity_type) {
      whereConditions.push('al.entity_type = ?');
      queryParams.push(entity_type);
    }

    if (start_date && end_date) {
      whereConditions.push('DATE(al.created_at) BETWEEN ? AND ?');
      queryParams.push(start_date, end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ${whereClause}
    `;
    
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get logs with pagination
    const offset = (page - 1) * limit;
    const logsQuery = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.username
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const logs = await executeQuery(logsQuery, [...queryParams, limit, offset]);

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Get activity logs error:', error);
    throw error;
  }
};

// Activity types
const ACTIVITY_TYPES = {
  // User activities
  USER_LOGIN: 'Đăng nhập',
  USER_LOGOUT: 'Đăng xuất',
  USER_CREATE: 'Tạo người dùng',
  USER_UPDATE: 'Cập nhật người dùng',
  USER_DELETE: 'Xóa người dùng',
  
  // Product activities
  PRODUCT_CREATE: 'Tạo sản phẩm',
  PRODUCT_UPDATE: 'Cập nhật sản phẩm',
  PRODUCT_DELETE: 'Xóa sản phẩm',
  
  // Category activities
  CATEGORY_CREATE: 'Tạo danh mục',
  CATEGORY_UPDATE: 'Cập nhật danh mục',
  CATEGORY_DELETE: 'Xóa danh mục',
  
  // Supplier activities
  SUPPLIER_CREATE: 'Tạo nhà cung cấp',
  SUPPLIER_UPDATE: 'Cập nhật nhà cung cấp',
  SUPPLIER_DELETE: 'Xóa nhà cung cấp',
  
  // Purchase activities
  PURCHASE_CREATE: 'Tạo phiếu nhập',
  PURCHASE_UPDATE: 'Cập nhật phiếu nhập',
  PURCHASE_DELETE: 'Xóa phiếu nhập',
  PURCHASE_COMPLETE: 'Hoàn thành phiếu nhập',
  
  // Sale activities
  SALE_CREATE: 'Tạo hóa đơn bán',
  SALE_PRINT: 'In hóa đơn',
  
  // Inventory activities
  INVENTORY_ADJUST: 'Điều chỉnh tồn kho',
  
  // Discount activities
  DISCOUNT_CREATE: 'Tạo chương trình giảm giá',
  DISCOUNT_UPDATE: 'Cập nhật chương trình giảm giá',
  DISCOUNT_DELETE: 'Xóa chương trình giảm giá',
  
  // Report activities
  REPORT_GENERATE: 'Tạo báo cáo',
  REPORT_EXPORT: 'Xuất báo cáo'
};

module.exports = {
  logActivity,
  getActivityLogs,
  ACTIVITY_TYPES
};
