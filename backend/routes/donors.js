const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// Get donor profile
router.get('/profile', auth, checkRole(['donor']), async (req, res) => {
  try {
    const [donors] = await db.query(
      `SELECT dp.*, u.name, u.email 
       FROM donor_profiles dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.user_id = ?`,
      [req.user.id]
    );

    if (donors.length === 0) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    res.json(donors[0]);
  } catch (error) {
    console.error('Error fetching donor profile:', error);
    res.status(500).json({ message: 'Error fetching donor profile' });
  }
});

// Update donor profile
router.put('/profile', auth, checkRole(['donor']), async (req, res) => {
  try {
    const { name, email, phone, bloodType, location } = req.body;

    // Start transaction
    await db.query('START TRANSACTION');

    // Update user table
    await db.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, req.user.id]
    );

    // Update donor_profiles table
    await db.query(
      'UPDATE donor_profiles SET phone = ?, blood_type = ?, location = ? WHERE user_id = ?',
      [phone, bloodType, location, req.user.id]
    );

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

// Update availability
router.put('/availability', auth, checkRole(['donor']), async (req, res) => {
  try {
    const { is_available } = req.body;
    await db.query(
      'UPDATE donor_profiles SET is_available = ? WHERE user_id = ?',
      [is_available, req.user.id]
    );

    res.json({ message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: 'Error updating availability' });
  }
});

// Get matching requests
router.get('/requests', auth, checkRole(['donor']), async (req, res) => {
  try {
    const [donor] = await db.query(
      'SELECT blood_type FROM donor_profiles WHERE user_id = ?',
      [req.user.id]
    );

    if (donor.length === 0) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    const [requests] = await db.query(
      'SELECT * FROM blood_requests WHERE blood_type = ? AND status = "pending" ORDER BY urgency DESC, created_at ASC',
      [donor[0].blood_type]
    );

    res.json(requests);
  } catch (error) {
    console.error('Error fetching matching requests:', error);
    res.status(500).json({ message: 'Error fetching matching requests' });
  }
});

// Accept request
router.post('/accept-request/:requestId', auth, checkRole(['donor']), async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Start transaction
    await db.query('START TRANSACTION');

    // Update request status
    await db.query(
      'UPDATE blood_requests SET status = "approved" WHERE id = ?',
      [requestId]
    );

    // Add to donations
    await db.query(
      'INSERT INTO donations (donor_id, request_id, donation_date) VALUES (?, ?, NOW())',
      [req.user.id, requestId]
    );

    // Update donor's last donation date
    await db.query(
      'UPDATE donor_profiles SET last_donation_date = NOW() WHERE user_id = ?',
      [req.user.id]
    );

    // Commit transaction
    await db.query('COMMIT');

    res.json({ message: 'Request accepted successfully' });
  } catch (error) {
    // Rollback on error
    await db.query('ROLLBACK');
    console.error('Error accepting request:', error);
    res.status(500).json({ message: 'Error accepting request' });
  }
});

// Get donation history
router.get('/history', auth, checkRole(['donor']), async (req, res) => {
  try {
    const [donations] = await db.query(
      `SELECT d.*, r.blood_type, r.location, u.name as requester_name 
       FROM donations d 
       JOIN blood_requests r ON d.request_id = r.id 
       JOIN users u ON r.requester_id = u.id 
       WHERE d.donor_id = ?
       ORDER BY d.donation_date DESC`,
      [req.user.id]
    );

    res.json(donations);
  } catch (error) {
    console.error('Error fetching donation history:', error);
    res.status(500).json({ message: 'Error fetching donation history' });
  }
});

module.exports = router; 