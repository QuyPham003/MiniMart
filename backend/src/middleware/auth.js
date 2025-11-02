const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = verifyToken(token);
    const user = await executeQuery(
      'SELECT user_id, username, full_name, email, role, is_active FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (!user.length || !user[0].is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user not found.' 
      });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Please authenticate first.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Log activity middleware
const logActivity = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the activity after response is sent
    if (req.user && req.method !== 'GET') {
      const activityData = {
        user_id: req.user.user_id,
        action: `${req.method} ${req.route?.path || req.path}`,
        table_name: req.route?.path?.split('/')[1] || 'unknown',
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent')
      };

      // Don't await this to avoid blocking the response
      executeQuery(
        'INSERT INTO activity_logs (user_id, action, table_name, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
        [activityData.user_id, activityData.action, activityData.table_name, activityData.ip_address, activityData.user_agent]
      ).catch(err => console.error('Activity log error:', err));
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  logActivity
};
