const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { parseDeductionId } = require('../utils/validation');
const { cache, CACHE_KEYS } = require('../middleware/cache');

// Deductions API endpoints
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM deductions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ error: 'Failed to fetch deductions' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM deductions WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching deduction:', error);
    res.status(500).json({ error: 'Failed to fetch deduction' });
  }
});

router.post('/', async (req, res) => {
  try {

    // Body is already parsed by global JSON middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Store local time directly for TIMESTAMP columns
    // PostgreSQL TIMESTAMP stores exactly what we send
    const utcNow = new Date();
    const localNow = new Date(utcNow.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours for Helsinki
    const localTimeString = localNow.getFullYear() + '-' +
      String(localNow.getMonth() + 1).padStart(2, '0') + '-' +
      String(localNow.getDate()).padStart(2, '0') + ' ' +
      String(localNow.getHours()).padStart(2, '0') + ':' +
      String(localNow.getMinutes()).padStart(2, '0') + ':' +
      String(localNow.getSeconds()).padStart(2, '0') + '.' +
      String(localNow.getMilliseconds()).padStart(3, '0') + '+02';

    const result = await query(`
      INSERT INTO deductions (name, type, value, is_default, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.name,
      body.type,
      parseFloat(body.value),
      body.isDefault || false,
      localTimeString
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating deduction:', error);
    res.status(500).json({ error: 'Failed to create deduction' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    // Body is already parsed by global JSON middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Parse the deduction ID - handles both custom IDs and numeric IDs
    const idInfo = parseDeductionId(req.params.id);

    // Build query parameters based on ID type
    let querySql, queryParams;

    if (idInfo.type === 'numeric') {
      // Standard update by numeric ID
      querySql = `
        UPDATE deductions
        SET name = $2, type = $3, value = $4, is_default = $5::boolean, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      queryParams = [
        idInfo.value,                    // $1: ID
        body.name,                       // $2: name
        body.type,                       // $3: type
        parseFloat(body.value),          // $4: value
        !!body.isDefault                 // $5: is_default (boolean)
      ];
    } else if (idInfo.type === 'custom') {
      // Custom ID fallback - update by name (frontend may not have database ID yet)
      querySql = `
        UPDATE deductions
        SET name = $2, type = $3, value = $4, is_default = $5::boolean, updated_at = CURRENT_TIMESTAMP
        WHERE name = $1
        RETURNING *
      `;
      queryParams = [
        body.name,                       // $1: name for WHERE clause
        body.name,                       // $2: name value (no-op)
        body.type,                       // $3: type
        parseFloat(body.value),          // $4: value
        !!body.isDefault                 // $5: is_default (boolean)
      ];
    } else {
      // Invalid ID format
      return res.status(400).json({
        error: 'Invalid deduction ID format',
        message: 'Please refresh the page and try again'
      });
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating deduction:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Parse the deduction ID - handles both custom IDs and numeric IDs
    const idInfo = parseDeductionId(req.params.id);

    let querySql, queryParams;
    let identifier = idInfo.value;

    if (idInfo.type === 'numeric') {
      // Execute DELETE for numeric IDs
      querySql = 'DELETE FROM deductions WHERE id = $1 RETURNING *';
      queryParams = [idInfo.value];
    } else if (idInfo.type === 'custom') {
      // For custom IDs, we can try to find by creating timestamp if needed
      // Extract timestamp from custom ID for potential fallback lookup
      const timestamp = idInfo.timestamp;
      if (timestamp) {
        // Try to find by name if recent creation (within last 5 minutes)
        const searchTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

        // Get the deduction list and try to find a matching one (simple fallback)
        const deductionList = await query('SELECT * FROM deductions ORDER BY created_at DESC LIMIT 10');

        // If there's only one deduction, or find the first one that might match, delete it
        // This is a fallback for frontend issues - not ideal but pragmatic
        for (const deduction of deductionList.rows) {
          if (deduction.created_at) {
            const createdTime = new Date(deduction.created_at).getTime();
            if (createdTime >= searchTime.getTime() - 10000 && createdTime <= timestamp + 10000) { // Within 10 seconds
              querySql = 'DELETE FROM deductions WHERE id = $1 RETURNING *';
              queryParams = [deduction.id];
              identifier = `fallback:${deduction.id}`;
              break;
            }
          }
        }

        if (!querySql) {
          return res.status(400).json({
            message: 'Could not resolve deduction ID for deletion. Please refresh the page and try again.',
            hint: 'Custom frontend IDs cannot be reliably used for deletion. Use the database ID instead.'
          });
        }
      } else {
        return res.status(400).json({
          message: 'Invalid custom ID format for deletion'
        });
      }
    } else {
      // Fallback for invalid ID format
      return res.status(400).json({
        message: 'Invalid ID format for deletion'
      });
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    res.json({ message: 'Deduction deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting deduction:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 200) // Limit stack trace
    });

    res.status(500).json({
      error: 'Failed to delete deduction',
      details: error.message
    });
  }
});



module.exports = router;
