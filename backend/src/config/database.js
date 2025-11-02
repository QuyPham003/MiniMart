const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

// Database configuration
const connectionString = `mysql://${process.env.DB_USER || 'root'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'supermarket_management'}?charset=utf8mb4&collation=utf8mb4_unicode_ci`;

const dbConfig = {
  uri: connectionString,
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('SET CHARACTER SET utf8mb4');
    const [rows] = await connection.execute(query, params);
    
    // Fix encoding for Vietnamese text
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (typeof row === 'object' && row !== null) {
          Object.keys(row).forEach(key => {
            if (typeof row[key] === 'string' && row[key].includes('Ã')) {
              try {
                row[key] = Buffer.from(row[key], 'latin1').toString('utf8');
              } catch (e) {
                // Keep original if conversion fails
              }
            }
          });
        }
      });
    }
    
    connection.release();
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Execute transaction
const executeTransaction = async (queries) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    
    const results = [];
    for (const { query, params } of queries) {
      const [rows] = await connection.execute(query, params);
      results.push(rows);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  executeQuery,
  executeTransaction,
  testConnection
};
