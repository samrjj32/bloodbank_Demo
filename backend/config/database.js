const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'blood_bank_db',
  port: 8889,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convert pool to use promises
const promisePool = pool.promise();

module.exports = promisePool; 