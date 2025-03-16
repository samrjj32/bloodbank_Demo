const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, bloodType, phone, location } = req.body;

    // Validate role
    const validRoles = ['donor', 'requester', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Insert user
      const [result] = await db.query(
        'INSERT INTO users (name, email, password, role, status, location, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, hashedPassword, role, 'active', location, phone]
      );

      // If user is a donor, create donor profile
      if (role === 'donor') {
        await db.query(
          'INSERT INTO donor_profiles (user_id, blood_type, is_available) VALUES (?, ?, ?)',
          [result.insertId, bloodType || 'O+', true]
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: result.insertId, role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1d' }
      );

      // Commit transaction
      await db.query('COMMIT');

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: result.insertId,
          name,
          email,
          role
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Test database connection first
    try {
      const [testResult] = await db.query('SELECT 1 as test');
      console.log('Database connection test:', testResult);
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Find user
    let user;
    try {
      const [users] = await db.query(
        'SELECT id, email, password, name, role FROM users WHERE email = ?', 
        [email]
      );
      console.log('Users found:', users.length);
      
      if (users.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      user = users[0];
      console.log('User found:', { id: user.id, email: user.email, hasPassword: !!user.password });
      
      if (!user.password) {
        console.error('User has no password stored');
        return res.status(500).json({ message: 'Invalid user data' });
      }
    } catch (queryError) {
      console.error('User query error:', queryError);
      return res.status(500).json({ message: 'Error finding user' });
    }

    // Compare passwords
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('Password match result:', isMatch);
      
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } catch (bcryptError) {
      console.error('Password comparison error:', bcryptError);
      return res.status(500).json({ message: 'Error verifying password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message 
    });
  }
});

router.get('/test-connection', async (req, res) => {
  try {
    const [result] = await db.query('SELECT 1 + 1 as sum');
    res.json({ 
      success: true, 
      result,
      dbConfig: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
      }
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      dbConfig: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
      }
    });
  }
});

module.exports = router; 