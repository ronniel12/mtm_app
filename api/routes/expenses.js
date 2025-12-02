const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// Expenses API endpoints
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses ORDER BY created_at DESC');

    // Transform dates to ensure they're returned in the user's local timezone
    const transformedExpenses = result.rows.map(expense => ({
      id: expense.id,
      date: expense.date ? new Date(expense.date).toLocaleDateString('sv-SE') : null, // YYYY-MM-DD format
      category: expense.category,
      description: expense.description,
      amount: parseFloat(expense.amount)
    }));

    res.json(transformedExpenses);
  } catch (error) {
    console.error('❌ GET /api/expenses - Database error:', error)
    console.error('❌ GET /api/expenses - Error stack:', error.stack)
    res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Transform date to ensure it's returned in the user's local timezone
    const expense = result.rows[0];
    const transformedExpense = {
      ...expense,
      date: expense.date ? new Date(expense.date).toLocaleDateString('sv-SE') : null // YYYY-MM-DD format
    };

    res.json(transformedExpense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Custom multer middleware for expenses (handles both FormData and JSON)
// Note: This will be handled at the main app level since file upload is app-wide
// router.use(uploadOptional = upload.fields([
//   { name: 'receipt', maxCount: 1 }
// ]));


// Use regular JSON body parser for all expense routes (including creation)
router.post('/', async (req, res) => {
  try {
    // Validate required fields are present in req.body
    const requiredFields = ['date', 'category', 'description', 'amount'];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missingFields
      });
    }

    // Handle file attachment data if provided
    let receiptData = null;
    let receiptFilename = null;
    let receiptOriginalName = null;
    let receiptMimetype = null;
    let receiptSize = null;

    if (req.body.receiptFile) {
      try {
        // Decode base64 data to Buffer
        receiptData = Buffer.from(req.body.receiptFile.data, 'base64');
        receiptFilename = req.body.receiptFile.filename;
        receiptOriginalName = req.body.receiptFile.filename; // Keep original name as-is
        receiptMimetype = req.body.receiptFile.mimetype;
        receiptSize = req.body.receiptFile.size;
      } catch (decodeError) {
        return res.status(400).json({ error: 'Invalid file data provided' });
      }
    }

    const result = await query(`
      INSERT INTO expenses (
        date, category, description, vehicle, amount, payment_method, notes,
        receipt_filename, receipt_original_name, receipt_mimetype, receipt_size, receipt_data,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      req.body.date,
      req.body.category,
      req.body.description,
      req.body.vehicle || '',
      parseFloat(req.body.amount),
      req.body.paymentMethod || req.body.payment_method || 'cash',
      req.body.notes || '',
      receiptFilename,  // null for now - no file support
      receiptOriginalName, // null for now
      receiptMimetype, // null for now
      receiptSize, // null for now
      receiptData // null for now
    ]);

    const createdExpense = result.rows[0];
    return res.status(201).json(createdExpense);
  } catch (error) {
    console.error('❌ Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE expenses
      SET date = $1, category = $2, description = $3, vehicle = $4, amount = $5,
          payment_method = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      body.date,
      body.category,
      body.description,
      body.vehicle,
      parseFloat(body.amount),
      body.paymentMethod || body.payment_method || 'cash',
      body.notes,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Download expense receipt
router.get('/:id/receipt', async (req, res) => {
  try {
    const result = await query('SELECT receipt_data, receipt_original_name, receipt_mimetype FROM expenses WHERE id = $1', [parseInt(req.params.id)]);

    if (result.rows.length === 0 || !result.rows[0].receipt_data) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const expense = result.rows[0];

    res.setHeader('Content-Type', expense.receipt_mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${expense.receipt_original_name}"`);
    res.send(expense.receipt_data);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ error: 'Failed to download receipt' });
  }
});

module.exports = router;
