const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// Apply auth and admin role check to all routes
router.use(auth);
router.use(checkRole(['admin']));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, status, created_at FROM users'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Update user status
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const [result] = await db.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Error updating user status' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total users by role
    const [userStats] = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'donor' THEN 1 ELSE 0 END) as total_donors,
        SUM(CASE WHEN role = 'requester' THEN 1 ELSE 0 END) as total_requesters
      FROM users
    `);

    // Get blood requests stats
    const [requestStats] = await db.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN br.status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE 
          WHEN br.status = 'completed' 
          AND EXISTS (
            SELECT 1 FROM donations d 
            WHERE d.request_id = br.id 
            AND d.status = 'completed'
          ) 
          THEN 1 ELSE 0 END) as completed_requests
      FROM blood_requests br
    `);

    // Get blood type availability with successful donations count
    const [bloodTypeStats] = await db.query(`
      SELECT 
        dp.blood_type,
        COUNT(DISTINCT dp.user_id) as available_donors,
        COUNT(DISTINCT CASE 
          WHEN d.status = 'completed' 
          THEN d.donor_id 
          END) as successful_donations
      FROM donor_profiles dp
      LEFT JOIN donations d ON dp.user_id = d.donor_id
      WHERE dp.is_available = true
      GROUP BY dp.blood_type
    `);

    // Get recent activity with more details
    const [recentActivity] = await db.query(`
      (SELECT 
        'request' as type,
        br.id,
        u.name as user_name,
        br.blood_type,
        br.status,
        br.urgency,
        br.created_at as date
      FROM blood_requests br
      JOIN users u ON br.requester_id = u.id
      WHERE br.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
      UNION ALL
      (SELECT 
        'donation' as type,
        d.id,
        u.name as user_name,
        br.blood_type,
        d.status,
        br.urgency,
        d.donation_date as date
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      JOIN blood_requests br ON d.request_id = br.id
      WHERE d.donation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY))
      ORDER BY date DESC
      LIMIT 10
    `);

    res.json({
      users: userStats[0],
      requests: {
        ...requestStats[0],
        successful_donations: bloodTypeStats.reduce((sum, curr) => sum + (curr.successful_donations || 0), 0)
      },
      bloodTypeAvailability: bloodTypeStats.reduce((acc, curr) => {
        acc[curr.blood_type] = {
          available_donors: curr.available_donors,
          successful_donations: curr.successful_donations || 0
        };
        return acc;
      }, {}),
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// Get all blood requests
router.get('/requests', auth, checkRole(['admin']), async (req, res) => {
  try {
    const [requests] = await db.query(`
      SELECT 
        br.id,
        br.blood_type,
        br.units,
        br.urgency,
        br.location,
        br.status,
        br.created_at,
        u.name as requester_name,
        u.email as requester_email
      FROM blood_requests br
      JOIN users u ON br.requester_id = u.id
      ORDER BY br.created_at DESC
    `);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Error fetching requests' });
  }
});

// Update request priority
router.put('/requests/:requestId/priority', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { urgency } = req.body;

    const [result] = await db.query(
      'UPDATE blood_requests SET urgency = ? WHERE id = ?',
      [urgency, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ message: 'Request priority updated successfully' });
  } catch (error) {
    console.error('Error updating request priority:', error);
    res.status(500).json({ message: 'Error updating request priority' });
  }
});

// Update request status
router.put('/requests/:requestId/status', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const [result] = await db.query(
      'UPDATE blood_requests SET status = ? WHERE id = ?',
      [status, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ message: 'Request status updated successfully' });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'Error updating request status' });
  }
});

// Complete a donation
router.put('/donations/:donationId/complete', async (req, res) => {
  try {
    const { donationId } = req.params;
    const { hemoglobin_level, blood_pressure, pulse_rate, notes } = req.body;

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Update donation status and medical details
      const [donationResult] = await db.query(
        `UPDATE donations 
         SET status = 'completed',
             hemoglobin_level = ?,
             blood_pressure = ?,
             pulse_rate = ?,
             notes = ?,
             donation_date = NOW()
         WHERE id = ?`,
        [hemoglobin_level, blood_pressure, pulse_rate, notes, donationId]
      );

      if (donationResult.affectedRows === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ message: 'Donation not found' });
      }

      // Get the request ID for this donation
      const [donationData] = await db.query(
        'SELECT request_id, donor_id FROM donations WHERE id = ?',
        [donationId]
      );

      if (donationData.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ message: 'Donation data not found' });
      }

      // Update the blood request status to completed
      await db.query(
        'UPDATE blood_requests SET status = ? WHERE id = ?',
        ['completed', donationData[0].request_id]
      );

      // Update donor's last donation date
      await db.query(
        `UPDATE donor_profiles 
         SET last_donation_date = NOW()
         WHERE user_id = ?`,
        [donationData[0].donor_id]
      );

      // Commit transaction
      await db.query('COMMIT');

      res.json({ 
        message: 'Donation completed successfully',
        donationId,
        requestId: donationData[0].request_id
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error completing donation:', error);
    res.status(500).json({ message: 'Error completing donation' });
  }
});

// Get all donations
router.get('/donations', async (req, res) => {
  try {
    const [donations] = await db.query(`
      SELECT 
        d.id,
        d.donation_date,
        d.status,
        d.hemoglobin_level,
        d.blood_pressure,
        d.pulse_rate,
        d.notes,
        u.name as donor_name,
        br.blood_type,
        br.units,
        br.location as donation_location
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      JOIN blood_requests br ON d.request_id = br.id
      ORDER BY d.donation_date DESC
    `);
    res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Error fetching donations' });
  }
});

module.exports = router; 