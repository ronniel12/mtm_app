const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const NodeCache = require('node-cache');

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

// Employee API endpoints
router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'employees:all';
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const result = await query('SELECT * FROM employees ORDER BY created_at DESC');

    // Cache the result
    cache.set(cacheKey, result.rows);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/:uuid', async (req, res) => {
  try {
    const result = await query('SELECT * FROM employees WHERE uuid = $1', [req.params.uuid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Generate UUID if not provided
    const uuid = body.uuid || require('crypto').randomUUID();

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
      INSERT INTO employees (uuid, name, phone, license_number, pagibig_number, sss_number, philhealth_number, address, cash_advance, loans, auto_deduct_cash_advance, auto_deduct_loans, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      uuid,
      body.name,
      body.phone || '',
      body.licenseNumber || '',
      body.pagibigNumber || '',
      body.sssNumber || '',
      body.philhealthNumber || '',
      body.address || '',
      parseFloat(body.cashAdvance) || 0,
      parseFloat(body.loans) || 0,
      body.autoDeductCashAdvance !== false, // Default true
      body.autoDeductLoans !== false, // Default true
      localTimeString
    ]);

    // Clear employees cache
    cache.del('employees:all');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/:uuid', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE employees
      SET name = $1, phone = $2, license_number = $3, pagibig_number = $4, sss_number = $5,
          philhealth_number = $6, address = $7, cash_advance = $8, loans = $9,
          auto_deduct_cash_advance = $10, auto_deduct_loans = $11, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $12
      RETURNING *
    `, [
      body.name,
      body.phone || '',
      body.licenseNumber || '',
      body.pagibigNumber || '',
      body.sssNumber || '',
      body.philhealthNumber || '',
      body.address || '',
      parseFloat(body.cashAdvance) || 0,
      parseFloat(body.loans) || 0,
      body.autoDeductCashAdvance !== false,
      body.autoDeductLoans !== false,
      req.params.uuid
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

// Employee PIN management endpoints
router.put('/:uuid/pin', async (req, res) => {
  try {
    const { pin } = req.body;

    // Validate 4-digit PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Check if PIN is already used by another employee
    const existingResult = await query('SELECT uuid FROM employees WHERE access_pin = $1 AND uuid != $2', [pin, req.params.uuid]);
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'This PIN is already in use by another employee' });
    }

    const result = await query(`
      UPDATE employees
      SET access_pin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $2
      RETURNING *
    `, [pin, req.params.uuid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Clear employees cache
    cache.del('employees:all');

    res.json({ message: 'PIN updated successfully', employee: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee PIN:', error);
    res.status(500).json({ error: 'Failed to update employee PIN' });
  }
});

// Employee payslips access via PIN
router.get('/:pin/payslips', async (req, res) => {
  try {
    const { pin } = req.params;

    // Validate PIN format
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Find employee by PIN
    const employeeResult = await query('SELECT * FROM employees WHERE access_pin = $1', [pin]);
    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or invalid PIN' });
    }

    const employee = employeeResult.rows[0];

    // Get all payslips for this employee with period data
    const payslipsResult = await query(`
      SELECT *, period_start::text as period_start, period_end::text as period_end FROM payslips
      WHERE employee_uuid = $1
      ORDER BY created_date DESC
    `, [employee.uuid]);

    // Process payslips with Blob URLs if available
    const processedPayslips = payslipsResult.rows.map(payslip => {
      let details = {};
      try {
        // JSONB is already parsed by pg, so use directly
        details = payslip.details || {};
      } catch (parseError) {
        console.warn(`Failed to parse payslip details for ${payslip.id}:`, parseError.message);
        details = {};
      }

      // Build comprehensive deductions array including employee-specific deductions
      let comprehensiveDeductions = details.deductions ? [...details.deductions] : [];

      // Add employee-specific deductions if not already included
      // Cash Advance (if auto-deduct is enabled and amount > 0)
      if (employee.cash_advance && employee.cash_advance > 0 && employee.auto_deduct_cash_advance) {
        const cashAdvanceDeduction = {
          name: 'Cash Advance',
          type: 'employee',
          calculatedAmount: parseFloat(employee.cash_advance),
          isEmployeeSpecific: true
        };
        comprehensiveDeductions.push(cashAdvanceDeduction);
      }

      // Loans (if auto-deduct is enabled and amount > 0)
      if (employee.loans && employee.loans > 0 && employee.auto_deduct_loans) {
        const loanDeduction = {
          name: 'Loans',
          type: 'employee',
          calculatedAmount: parseFloat(employee.loans),
          isEmployeeSpecific: true
        };
        comprehensiveDeductions.push(loanDeduction);
      }

      // Recalculate total deductions from comprehensive list
      const totalCalculatedDeductions = comprehensiveDeductions.reduce((sum, deduction) =>
        sum + (parseFloat(deduction.calculatedAmount) || 0), 0
      );
      const recalculatedNetPay = (parseFloat(payslip.gross_pay) || 0) - totalCalculatedDeductions;

      // Format period properly for display with database fallback
      let formattedPeriod = 'N/A';

      // First try to use period from details JSON if available
      if (details.period && details.period.periodText) {
        formattedPeriod = details.period.periodText;
      }
      else if (details.period && details.period.startDate && details.period.endDate) {
        const start = new Date(details.period.startDate).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const end = new Date(details.period.endDate).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        formattedPeriod = `${start} to ${end}`;
      }
      else if (typeof details.period === 'string') {
        formattedPeriod = details.period;
      }
      // Fall back to database period_start/period_end fields
      else if (payslip.period_start && payslip.period_end) {
        const start = new Date(payslip.period_start).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const end = new Date(payslip.period_end).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        formattedPeriod = `${start} to ${end}`;
      }

      return {
        id: payslip.id,
        payslipNumber: payslip.payslip_number,
        employeeName: employee.name,
        period: formattedPeriod,
        grossPay: payslip.gross_pay,
        deductions: comprehensiveDeductions,
        totalDeductions: totalCalculatedDeductions,
        netPay: Math.max(0, recalculatedNetPay), // Ensure net pay can't be negative
        createdDate: payslip.created_date,
        status: payslip.status,
        blobUrl: details.blobUrl || null, // Add Blob URL directly to top level
        // Include trip summary and other details for employee view
        trips: details.trips || [],
        totals: details.totals || {}
      };
    });

    res.json({
      employee: {
        name: employee.name,
        id: employee.uuid
      },
      payslips: processedPayslips
    });
  } catch (error) {
    console.error('Error fetching employee payslips:', error);
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});

router.delete('/:uuid', async (req, res) => {
  try {
    const result = await query('DELETE FROM employees WHERE uuid = $1 RETURNING *', [req.params.uuid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

module.exports = router;
