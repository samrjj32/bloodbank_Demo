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

    // Check if user exists
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

module.exports = router; 