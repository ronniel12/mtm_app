const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// Employee Deduction Configs endpoints (standalone module)
router.get('/', async (req, res) => {
  try {
    const { employee_uuid, deduction_id } = req.query;
    let queryStr = 'SELECT * FROM employee_deduction_configs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (employee_uuid) {
      queryStr += ` AND employee_uuid = $${paramCount}`;
      params.push(employee_uuid);
      paramCount++;
    }

    if (deduction_id) {
      queryStr += ` AND deduction_id = $${paramCount}`;
      params.push(parseInt(deduction_id));
      paramCount++;
    }

    queryStr += ' ORDER BY created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee deduction configs:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction configs' });
  }
});

router.get('/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_deduction_configs WHERE employee_uuid = $1 AND deduction_id = $2',
      [req.params.employee_uuid, parseInt(req.params.deduction_id)]
    );

    if (result.rows.length === 0) {
      return res.json({ apply_mode: 'never', date_config: null });
    }

    const config = result.rows[0];
    // Parse JSON date_config if exists
    if (config.date_config) {
      try {
        config.date_config = JSON.parse(config.date_config);
      } catch (e) {
        config.date_config = null;
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching employee deduction config:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction config' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body || !body.employee_uuid || !body.deduction_id) {
      return res.status(400).json({ error: 'employee_uuid and deduction_id are required' });
    }

    const result = await query(`INSERT INTO employee_deduction_configs
      (employee_uuid, deduction_id, apply_mode, date_config)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_uuid, deduction_id)
      DO UPDATE SET
        apply_mode = EXCLUDED.apply_mode,
        date_config = EXCLUDED.date_config,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`, [
      body.employee_uuid,
      parseInt(body.deduction_id),
      body.apply_mode || 'never',
      body.date_config ? JSON.stringify(body.date_config) : null
    ]);

    const config = result.rows[0];
    // JSON is already parsed by pg library as JSONB
    // No additional parsing needed

    res.status(201).json(config);
  } catch (error) {
    console.error('Error creating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to create employee deduction config' });
  }
});

router.put('/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`UPDATE employee_deduction_configs
      SET apply_mode = $1, date_config = $2, updated_at = CURRENT_TIMESTAMP
      WHERE employee_uuid = $3 AND deduction_id = $4
      RETURNING *`, [
      body.apply_mode || 'never',
      body.date_config ? JSON.stringify(body.date_config) : null,
      req.params.employee_uuid,
      parseInt(req.params.deduction_id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }

    const config = result.rows[0];
    // Parse JSON date_config for response
    if (config.date_config) {
      try {
        config.date_config = JSON.parse(config.date_config);
      } catch (e) {
        config.date_config = null;
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Error updating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to update employee deduction config' });
  }
});

router.delete('/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM employee_deduction_configs WHERE employee_uuid = $1 AND deduction_id = $2 RETURNING *',
      [req.params.employee_uuid, parseInt(req.params.deduction_id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }
    res.json({ message: 'Employee deduction config deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee deduction config:', error);
    res.status(500).json({ error: 'Failed to delete employee deduction config' });
  }
});

// Helper endpoint to get matrix data for UI (employees × deductions with configs)
router.get('/matrix', async (req, res) => {
  try {
    // Get all employees - sort by name for consistent ordering
    const employeesResult = await query('SELECT uuid, name FROM employees ORDER BY name');

    // Get all deductions - sort by ID for consistent ordering and to match UI expectations
    const deductionsResult = await query('SELECT id, name, type, value FROM deductions ORDER BY id ASC');

    // Get all configs
    const configsResult = await query('SELECT * FROM employee_deduction_configs');

    // Build matrix structure with guaranteed sorting
    const employees = employeesResult.rows;
    const deductions = deductionsResult.rows;
    const configs = configsResult.rows;

    // Debug: log deductions for troubleshooting

    // Create config lookup map for quick access
    const configMap = new Map();
    configs.forEach(config => {
      // Ensure deduction_id is parsed as number for consistency
      const key = `${config.employee_uuid}-${parseInt(config.deduction_id)}`;
      configMap.set(key, config);
    });

    // Build matrix with explicit deduction ID mapping
    const matrix = employees.map(employee => ({
      employee: employee,
      configs: deductions.map(deduction => ({
        deduction: deduction,
        config: configMap.get(`${employee.uuid}-${deduction.id}`) || {
          apply_mode: 'never',
          date_config: null
        }
      }))
    }));

    res.json({
      employees: employees,
      deductions: deductions, // This is used for table headers in UI
      matrix: matrix // This contains configs for each cell
    });
  } catch (error) {
    console.error('Error fetching employee deduction matrix:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction matrix' });
  }
});

module.exports = router;
