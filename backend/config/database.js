const mysql = require('mysql2');
require('dotenv').config();

console.log('Attempting database connection with:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection immediately
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
    // Test query
    connection.query('SELECT 1 + 1 AS result', (error, results) => {
      if (error) {
        console.error('Test query failed:', error);
      } else {
        console.log('Test query successful:', results);
      }
      connection.release();
    });
  }
});

const promisePool = pool.promise();

module.exports = promisePool; 