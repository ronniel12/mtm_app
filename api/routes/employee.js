const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// ============================================================================
// EMPLOYEES ROUTES
// ============================================================================

router.get('/employees', async (req, res) => {
  try {
    const result = await query('SELECT * FROM employees ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/employees/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/employees', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO employees (
        name, phone, license_number, pagibig_number, sss_number, philhealth_number,
        address, cash_advance, loans, auto_deduct_cash_advance, auto_deduct_loans,
        access_pin, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      req.body.name,
      req.body.phone,
      req.body.licenseNumber,
      req.body.pagibigNumber,
      req.body.SssNumber,
      req.body.philhealthNumber,
      req.body.address,
      parseFloat(req.body.cashAdvance || 0),
      parseFloat(req.body.loans || 0),
      req.body.autoDeductCashAdvance || false,
      req.body.autoDeductLoans || false,
      req.body.accessPin,
      req.body.createdBy
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/employees/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE employees
      SET name = $1, phone = $2, license_number = $3, pagibig_number = $4,
          sss_number = $5, philhealth_number = $6, address = $7, cash_advance = $8,
          loans = $9, auto_deduct_cash_advance = $10, auto_deduct_loans = $11,
          access_pin = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      req.body.name,
      req.body.phone,
      req.body.licenseNumber,
      req.body.pagibigNumber,
      req.body.SssNumber,
      req.body.philhealthNumber,
      req.body.address,
      parseFloat(req.body.cashAdvance || 0),
      parseFloat(req.body.loans || 0),
      req.body.autoDeductCashAdvance || false,
      req.body.autoDeductLoans || false,
      req.body.accessPin,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.put('/employees/:id/pin', async (req, res) => {
  try {
    const result = await query(`
      UPDATE employees SET access_pin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [
      req.body.pin,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee PIN:', error);
    res.status(500).json({ error: 'Failed to update employee PIN' });
  }
});

router.get('/employees/:id/payslips', async (req, res) => {
  try {
    // First get employee details
    const employeeResult = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get employee's payslips ordered by most recent first
    const payslipsResult = await query(
      'SELECT * FROM payslips WHERE employee_uuid = $1 ORDER BY created_date DESC',
      [employee.uuid]
    );

    res.json({
      employee: {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        department: employee.department
      },
      payslips: payslipsResult.rows
    });
  } catch (error) {
    console.error('Error fetching employee payslips:', error);
    res.status(500).json({ error: 'Failed to fetch employee payslips' });
  }
});

router.delete('/employees/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM employees WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// ============================================================================
// DEDUCTIONS ROUTES
// ============================================================================

router.get('/deductions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM deductions');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM deductions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      deductions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ error: 'Failed to fetch deductions' });
  }
});

router.get('/deductions/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM deductions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching deduction:', error);
    res.status(500).json({ error: 'Failed to fetch deduction' });
  }
});

router.post('/deductions', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO deductions (name, description, amount, type, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.body.name,
      req.body.description,
      parseFloat(req.body.amount) || 0,
      req.body.type,
      req.body.isActive ?? true,
      req.body.createdBy
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating deduction:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

router.put('/deductions/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE deductions
      SET name = $1, description = $2, amount = $3, type = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      req.body.name,
      req.body.description,
      parseFloat(req.body.amount) || 0,
      req.body.type,
      req.body.isActive ?? true,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating deduction:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

router.delete('/deductions/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM deductions WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }
    res.json({ message: 'Deduction deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting deduction:', error);
    res.status(500).json({ error: 'Failed to delete deduction' });
  }
});

// ============================================================================
// EMPLOYEE DEDUCTION CONFIGS ROUTES
// ============================================================================

router.get('/employee-deduction-configs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM employee_deduction_configs');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM employee_deduction_configs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      configs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching employee deduction configs:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction configs' });
  }
});

router.get('/employee-deduction-configs/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM employee_deduction_configs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee deduction config:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction config' });
  }
});

router.post('/employee-deduction-configs', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO employee_deduction_configs (employee_uuid, deduction_id, amount, type, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.body.employeeUuid,
      req.body.deductionId,
      parseFloat(req.body.amount) || 0,
      req.body.type,
      req.body.isActive ?? true,
      req.body.createdBy
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to create employee deduction config' });
  }
});

router.put('/employee-deduction-configs/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE employee_deduction_configs
      SET employee_uuid = $1, deduction_id = $2, amount = $3, type = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      req.body.employeeUuid,
      req.body.deductionId,
      parseFloat(req.body.amount) || 0,
      req.body.type,
      req.body.isActive ?? true,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to update employee deduction config' });
  }
});

router.delete('/employee-deduction-configs/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM employee_deduction_configs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }
    res.json({ message: 'Employee deduction config deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee deduction config:', error);
    res.status(500).json({ error: 'Failed to delete employee deduction config' });
  }
});

router.get('/employee-deduction-configs/employee/:employeeUuid', async (req, res) => {
  try {
    const result = await query(`
      SELECT edc.*, d.name, d.description, d.type as deduction_type
      FROM employee_deduction_configs edc
      JOIN deductions d ON edc.deduction_id = d.id
      WHERE edc.employee_uuid = $1 AND edc.is_active = true
      ORDER BY d.name ASC
    `, [req.params.employeeUuid]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee deduction matrix:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction matrix' });
  }
});

module.exports = router;
