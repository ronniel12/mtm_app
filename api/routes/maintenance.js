const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// ============================================================================
// MAINTENANCE SYSTEM API ENDPOINTS
// ============================================================================

// Maintenance Schedules API endpoints
router.get('/schedules', async (req, res) => {
  try {
    const { vehicle_id, status, category } = req.query;
    let queryStr = 'SELECT * FROM maintenance_schedules WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (status) {
      queryStr += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (category) {
      queryStr += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    queryStr += ' ORDER BY next_due_date ASC, created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
  }
});

router.get('/schedules/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM maintenance_schedules WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedule' });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const body = req.body;

    // Calculate next due date based on schedule type
    let nextDueDate = null;
    let nextDueMileage = null;

    if (body.scheduleType === 'time_based') {
      const now = new Date();
      if (body.frequencyUnit === 'days') {
        nextDueDate = new Date(now.getTime() + (body.frequencyValue * 24 * 60 * 60 * 1000));
      } else if (body.frequencyUnit === 'weeks') {
        nextDueDate = new Date(now.getTime() + (body.frequencyValue * 7 * 24 * 60 * 60 * 1000));
      } else if (body.frequencyUnit === 'months') {
        nextDueDate = new Date(now.getFullYear(), now.getMonth() + body.frequencyValue, now.getDate());
      } else if (body.frequencyUnit === 'years') {
        nextDueDate = new Date(now.getFullYear() + body.frequencyValue, now.getMonth(), now.getDate());
      }
    }

    const result = await query(`
      INSERT INTO maintenance_schedules (
        vehicle_id, maintenance_type, category, schedule_type, frequency_value, frequency_unit,
        reminder_days, last_completed_date, last_mileage_serviced, next_due_date, next_due_mileage, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      body.vehicleId,
      body.maintenanceType,
      body.category,
      body.scheduleType,
      body.frequencyValue,
      body.frequencyUnit,
      body.reminderDays || 7,
      body.lastCompletedDate,
      body.lastMileageServiced,
      nextDueDate?.toISOString().split('T')[0],
      nextDueMileage,
      body.status || 'active',
      body.notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to create maintenance schedule' });
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    const body = req.body;

    // Build dynamic update query - only update fields that are provided
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined) {
        // Convert camelCase to snake_case for database columns
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(body[key]);
        paramCount++;
      }
    });

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(parseInt(req.params.id)); // Add ID at the end

    const result = await query(`
      UPDATE maintenance_schedules
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to update maintenance schedule' });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM maintenance_schedules WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    res.json({ message: 'Maintenance schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to delete maintenance schedule' });
  }
});

// Vehicle Documents API endpoints
router.get('/documents', async (req, res) => {
  try {
    const { vehicle_id, document_type } = req.query;
    let queryStr = 'SELECT * FROM vehicle_documents WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (document_type) {
      queryStr += ` AND document_type = $${paramCount}`;
      params.push(document_type);
      paramCount++;
    }

    queryStr += ' ORDER BY expiry_date ASC, created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicle documents:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle documents' });
  }
});

router.get('/documents/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicle_documents WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle document:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle document' });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO vehicle_documents (
        vehicle_id, document_type, document_number, issue_date, expiry_date,
        issuing_authority, cost, document_file_path, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.vehicleId,
      body.documentType,
      body.documentNumber,
      body.issueDate,
      body.expiryDate,
      body.issuingAuthority,
      body.cost ? parseFloat(body.cost) : null,
      body.documentFilePath,
      body.notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle document:', error);
    res.status(500).json({ error: 'Failed to create vehicle document' });
  }
});

router.put('/documents/:id', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE vehicle_documents
      SET vehicle_id = $1, document_type = $2, document_number = $3, issue_date = $4,
          expiry_date = $5, issuing_authority = $6, cost = $7, document_file_path = $8,
          notes = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      body.vehicleId,
      body.documentType,
      body.documentNumber,
      body.issueDate,
      body.expiryDate,
      body.issuingAuthority,
      body.cost ? parseFloat(body.cost) : null,
      body.documentFilePath,
      body.notes,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle document:', error);
    res.status(500).json({ error: 'Failed to update vehicle document' });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM vehicle_documents WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }
    res.json({ message: 'Vehicle document deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle document:', error);
    res.status(500).json({ error: 'Failed to delete vehicle document' });
  }
});

// Notification Preferences API endpoints
router.get('/notifications/preferences', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notification_preferences WHERE is_active = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

router.post('/notifications/preferences', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO notification_preferences (
        user_id, maintenance_type, reminder_days, notification_methods, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.userId,
      body.maintenanceType,
      body.reminderDays || 7,
      JSON.stringify(body.notificationMethods || ['in_app']),
      body.isActive !== false
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification preference:', error);
    res.status(500).json({ error: 'Failed to create notification preference' });
  }
});

router.put('/notifications/preferences/:id', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE notification_preferences
      SET user_id = $1, maintenance_type = $2, reminder_days = $3,
          notification_methods = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      body.userId,
      body.maintenanceType,
      body.reminderDays || 7,
      JSON.stringify(body.notificationMethods || ['in_app']),
      body.isActive !== false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification preference not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating notification preference:', error);
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

// Notification History API endpoints
router.get('/notifications/history', async (req, res) => {
  try {
    const { vehicle_id, status, limit = 50 } = req.query;
    let queryStr = 'SELECT * FROM notification_history WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (status) {
      queryStr += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    queryStr += ` ORDER BY sent_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// User Contacts API endpoints
router.get('/contacts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM user_contacts WHERE verified = true ORDER BY is_primary DESC, created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user contacts:', error);
    res.status(500).json({ error: 'Failed to fetch user contacts' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO user_contacts (
        user_id, contact_type, contact_value, is_primary, verified, verification_code
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      body.userId,
      body.contactType,
      body.contactValue,
      body.isPrimary || false,
      body.verified || false,
      body.verificationCode || Math.random().toString(36).substring(2, 8).toUpperCase()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user contact:', error);
    res.status(500).json({ error: 'Failed to create user contact' });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE user_contacts
      SET user_id = $1, contact_type = $2, contact_value = $3, is_primary = $4,
          verified = $5, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      body.userId,
      body.contactType,
      body.contactValue,
      body.isPrimary || false,
      body.verified || false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User contact not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user contact:', error);
    res.status(500).json({ error: 'Failed to update user contact' });
  }
});

// Maintenance Dashboard API endpoint
router.get('/dashboard', async (req, res) => {
  try {
    // Get maintenance statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_schedules,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_schedules,
        COUNT(CASE WHEN next_due_date <= CURRENT_DATE + INTERVAL '7 days' AND status = 'active' THEN 1 END) as due_soon,
        COUNT(CASE WHEN next_due_date < CURRENT_DATE AND status = 'active' THEN 1 END) as overdue,
        COUNT(CASE WHEN last_completed_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as completed_this_month
      FROM maintenance_schedules
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Get upcoming maintenance (next 30 days)
    const upcomingQuery = `
      SELECT ms.*, v.plate_number, v.name as vehicle_name
      FROM maintenance_schedules ms
      JOIN vehicles v ON ms.vehicle_id = v.id
      WHERE ms.status = 'active'
        AND ms.next_due_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY ms.next_due_date ASC
      LIMIT 10
    `;

    const upcomingResult = await query(upcomingQuery);

    // Get expiring documents (next 30 days)
    const expiringQuery = `
      SELECT vd.*, v.plate_number, v.name as vehicle_name
      FROM vehicle_documents vd
      JOIN vehicles v ON vd.vehicle_id = v.id
      WHERE vd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY vd.expiry_date ASC
      LIMIT 10
    `;

    const expiringResult = await query(expiringQuery);

    res.json({
      stats: {
        totalSchedules: parseInt(stats.total_schedules),
        activeSchedules: parseInt(stats.active_schedules),
        dueSoon: parseInt(stats.due_soon),
        overdue: parseInt(stats.overdue),
        completedThisMonth: parseInt(stats.completed_this_month)
      },
      upcomingMaintenance: upcomingResult.rows,
      expiringDocuments: expiringResult.rows
    });
  } catch (error) {
    console.error('Error fetching maintenance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance dashboard' });
  }
});

module.exports = router;
