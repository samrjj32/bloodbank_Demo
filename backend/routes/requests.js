const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// Valid values for urgency
const VALID_URGENCY_LEVELS = ['normal', 'urgent', 'emergency'];

// Create new blood request
router.post('/', auth, checkRole(['requester']), async (req, res) => {
  try {
    const { bloodType, units, urgency, location, notes } = req.body;

    // Validate urgency
    if (!VALID_URGENCY_LEVELS.includes(urgency)) {
      return res.status(400).json({
        message: `Invalid urgency level. Must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`
      });
    }

    // Validate blood type
    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!validBloodTypes.includes(bloodType)) {
      return res.status(400).json({
        message: `Invalid blood type. Must be one of: ${validBloodTypes.join(', ')}`
      });
    }

    // Validate units
    if (!Number.isInteger(units) || units < 1) {
      return res.status(400).json({
        message: 'Units must be a positive integer'
      });
    }

    // Validate location
    if (!location || location.trim().length === 0) {
      return res.status(400).json({
        message: 'Location is required'
      });
    }

    const [result] = await db.query(
      'INSERT INTO blood_requests (requester_id, blood_type, units, urgency, location, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, bloodType, units, urgency, location, notes || '']
    );

    res.status(201).json({
      message: 'Blood request created successfully',
      requestId: result.insertId
    });
  } catch (error) {
    console.error('Error creating request:', error);
    // Send more specific error message if available
    res.status(500).json({ 
      message: error.sqlMessage || 'Error creating blood request',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Get user's requests
router.get('/my-requests', auth, checkRole(['requester']), async (req, res) => {
  try {
    const [requests] = await db.query(
      'SELECT * FROM blood_requests WHERE requester_id = ?',
      [req.user.id]
    );

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Error fetching requests' });
  }
});

// Get matched donors for a request
router.get('/:requestId/matches', auth, checkRole(['requester']), async (req, res) => {
  try {
    const { requestId } = req.params;

    // Verify request belongs to user
    const [request] = await db.query(
      'SELECT * FROM blood_requests WHERE id = ? AND requester_id = ?',
      [requestId, req.user.id]
    );

    if (request.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const [donors] = await db.query(
      'SELECT d.*, u.name, u.email ' +
      'FROM donors d ' +
      'JOIN users u ON d.user_id = u.id ' +
      'WHERE d.blood_type = ? AND d.availability = true',
      [request[0].blood_type]
    );

    res.json(donors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching matched donors' });
  }
});

// Update request status
router.put('/:requestId', auth, checkRole(['requester']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    const [result] = await db.query(
      'UPDATE blood_requests SET status = ? WHERE id = ? AND requester_id = ?',
      [status, requestId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found or unauthorized' });
    }

    res.json({ message: 'Request updated successfully' });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ message: 'Error updating request' });
  }
});

// Delete request
router.delete('/:requestId', auth, checkRole(['requester']), async (req, res) => {
  try {
    const { requestId } = req.params;

    const [result] = await db.query(
      'DELETE FROM blood_requests WHERE id = ? AND requester_id = ? AND status = "pending"',
      [requestId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: 'Request not found, unauthorized, or cannot be deleted' 
      });
    }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ message: 'Error deleting request' });
  }
});

module.exports = router; 