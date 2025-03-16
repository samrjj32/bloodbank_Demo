const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// Get requester profile
router.get('/profile', auth, checkRole(['requester']), async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// Update requester profile
router.put('/profile', auth, checkRole(['requester']), async (req, res) => {
  try {
    const { name, email, phone, location } = req.body;

    // Start transaction
    await db.query('START TRANSACTION');

    // Update user table
    await db.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, req.user.id]
    );

    // Check if requester profile exists
    const [existingProfile] = await db.query(
      'SELECT * FROM requester_profiles WHERE user_id = ?',
      [req.user.id]
    );

    if (existingProfile.length === 0) {
      // Create new profile if it doesn't exist
      await db.query(
        'INSERT INTO requester_profiles (user_id, phone, location) VALUES (?, ?, ?)',
        [req.user.id, phone, location]
      );
    } else {
      // Update existing profile
      await db.query(
        'UPDATE requester_profiles SET phone = ?, location = ? WHERE user_id = ?',
        [phone, location, req.user.id]
      );
    }

    // Commit transaction
    await db.query('COMMIT');

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    // Rollback on error
    await db.query('ROLLBACK');
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

module.exports = router; 