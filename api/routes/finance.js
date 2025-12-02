const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// ============================================================================
// RATES ROUTES
// ============================================================================

router.get('/rates', async (req, res) => {
  try {
    const result = await query('SELECT * FROM rates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.post('/rates', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO rates (origin, province, town, rate, new_rates, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      req.body.origin,
      req.body.province,
      req.body.town,
      req.body.rate || 0,
      req.body.newRates || req.body.rate || 0
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rate:', error);
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

router.put('/rates/:origin/:province/:town', async (req, res) => {
  try {
    const { originalOrigin, originalProvince, originalTown, ...updateData } = req.body;

    const result = await query(`
      UPDATE rates
      SET origin = $1, province = $2, town = $3, rate = $4, new_rates = $5, updated_at = CURRENT_TIMESTAMP
      WHERE origin = $6 AND province = $7 AND town = $8
      RETURNING *
    `, [
      updateData.origin || req.body.origin,
      updateData.province || req.body.province,
      updateData.town || req.body.town,
      updateData.rate || updateData.newRates || 0,
      updateData.newRates || updateData.rate || 0,
      req.params.origin,
      req.params.province,
      req.params.town
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

router.delete('/rates/:origin/:province/:town', async (req, res) => {
  try {
    const result = await query('DELETE FROM rates WHERE origin = $1 AND province = $2 AND town = $3 RETURNING *', [
      req.params.origin,
      req.params.province,
      req.params.town
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }
    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate:', error);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// ============================================================================
// EXPENSES ROUTES
// ============================================================================

router.get('/expenses', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM expenses');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM expenses ORDER BY expense_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      expenses: result.rows,
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
    console.error('❌ GET /api/expenses - Database error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
  }
});

router.get('/expenses/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

router.post('/expenses', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO expenses (
        description, amount, expense_date, category, reference_number,
        payment_method, vendor_name, notes, receipt_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.body.description,
      parseFloat(req.body.amount) || 0,
      req.body.expenseDate || req.body.expense_date,
      req.body.category,
      req.body.referenceNumber || req.body.reference_number,
      req.body.paymentMethod || req.body.payment_method,
      req.body.vendorName || req.body.vendor_name,
      req.body.notes,
      req.body.receiptUrl || req.body.receipt_url,
      req.body.createdBy || req.body.created_by
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
});

router.put('/expenses/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE expenses
      SET description = $1, amount = $2, expense_date = $3, category = $4,
          reference_number = $5, payment_method = $6, vendor_name = $7,
          notes = $8, receipt_url = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      req.body.description,
      parseFloat(req.body.amount) || 0,
      req.body.expenseDate || req.body.expense_date,
      req.body.category,
      req.body.referenceNumber || req.body.reference_number,
      req.body.paymentMethod || req.body.payment_method,
      req.body.vendorName || req.body.vendor_name,
      req.body.notes,
      req.body.receiptUrl || req.body.receipt_url,
      req.params.id
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

router.delete('/expenses/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

router.get('/expenses/:id/receipt', async (req, res) => {
  try {
    const result = await query('SELECT receipt_url FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (!result.rows[0].receipt_url) {
      return res.status(404).json({ message: 'No receipt available' });
    }

    res.redirect(result.rows[0].receipt_url);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ error: 'Failed to download receipt' });
  }
});

// ============================================================================
// BILLINGS ROUTES
// ============================================================================

router.get('/billings', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get total count for pagination metadata
    const countResult = await query('SELECT COUNT(*) as total FROM billings');
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      'SELECT * FROM billings ORDER BY created_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    // Transform database format to frontend expected format
    const transformedBillings = result.rows.map(billing => ({
      ...billing,
      // Transform period fields
      period: {
        startDate: billing.period_start,
        endDate: billing.period_end,
        periodText: billing.period_start && billing.period_end ?
          `${new Date(billing.period_start).toLocaleDateString('en-PH')} to ${new Date(billing.period_end).toLocaleDateString('en-PH')}` :
          'Period not set'
      },
      // Transform client fields
      client: {
        name: billing.client_name,
        address: billing.client_address,
        city: billing.client_city || '',
        zipCode: billing.client_zip_code || '',
        tin: billing.client_tin
      },
      // Transform payment status
      paymentStatus: billing.payment_status,
      // Transform totals and trips (already JSONB)
      totals: billing.totals,
      trips: billing.trips,
      // Transform billing number
      billingNumber: billing.billing_number,
      // Keep other fields
      preparedBy: billing.prepared_by,
      createdDate: billing.created_date
    }));

    res.json({
      billings: transformedBillings,
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
    console.error('Error fetching billings:', error);
    res.status(500).json({ error: 'Failed to fetch billings' });
  }
});

router.get('/billings/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM billings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Billing not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching billing:', error);
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

router.post('/billings', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Convert frontend UTC timestamp to local time for storage
    let finalTimestamp;
    if (body.createdDate) {
      // Frontend sends UTC timestamp, convert to local time
      const frontendUtcTime = new Date(body.createdDate);
      const localTime = new Date(frontendUtcTime.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours for Helsinki
      finalTimestamp = localTime.getFullYear() + '-' +
        String(localTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(localTime.getDate()).padStart(2, '0') + ' ' +
        String(localTime.getHours()).padStart(2, '0') + ':' +
        String(localTime.getMinutes()).padStart(2, '0') + ':' +
        String(localTime.getSeconds()).padStart(2, '0') + '.' +
        String(localTime.getMilliseconds()).padStart(3, '0') + '+02';
    } else {
      // Fallback to current local time
      const utcNow = new Date();
      const localNow = new Date(utcNow.getTime() + (2 * 60 * 60 * 1000));
      finalTimestamp = localNow.getFullYear() + '-' +
        String(localNow.getMonth() + 1).padStart(2, '0') + '-' +
        String(localNow.getDate()).padStart(2, '0') + ' ' +
        String(localNow.getHours()).padStart(2, '0') + ':' +
        String(localNow.getMinutes()).padStart(2, '0') + ':' +
        String(localNow.getSeconds()).padStart(2, '0') + '.' +
        String(localNow.getMilliseconds()).padStart(3, '0') + '+02';
    }

    // Generate PDF synchronously (works in serverless)
    let pdfResult = null;
    try {
      const PDFService = require('../pdf-service');
      pdfResult = await PDFService.generateAndUploadBillingPDF(body);
    } catch (pdfError) {
      console.error('❌ PDF generation failed during billing creation:', pdfError.message);
      pdfResult = { pdfGenerated: false, error: pdfError.message };
    }

    // Build details with PDF result
    const billingDetails = {
      ...body,
      ...(pdfResult && pdfResult.pdfGenerated ? {
        blobUrl: pdfResult.blobUrl,
        pdfGenerated: true,
        pdfFilename: pdfResult.filename,
        pdfSize: pdfResult.size
      } : {
        pdfGenerated: false,
        pdfError: pdfResult?.error || 'Unknown PDF error'
      })
    };

    const result = await query(`
      INSERT INTO billings (id, billing_number, period_start, period_end, client_name, client_address, client_city, client_zip_code, client_tin, trips, totals, prepared_by, payment_status, created_date, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      body.id || Date.now().toString(),
      body.billingNumber,  // Use frontend-generated billing number
      body.period?.startDate,
      body.period?.endDate,
      body.client?.name,
      body.client?.address,
      body.client?.city,
      body.client?.zipCode,
      body.client?.tin,
      JSON.stringify(body.trips || []),
      JSON.stringify(body.totals || {}),
      body.preparedBy,
      body.paymentStatus || 'pending',
      finalTimestamp,
      JSON.stringify(billingDetails)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating billing:', error);
    res.status(500).json({ error: 'Failed to create billing', details: error.message });
  }
});

router.put('/billings/:id', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Transform frontend format to database format
    const billingData = {
      billing_number: body.billingNumber,
      period_start: body.period?.startDate,
      period_end: body.period?.endDate,
      client_name: body.client?.name,
      client_address: body.client?.address,
      client_city: body.client?.city,
      client_zip_code: body.client?.zipCode,
      client_tin: body.client?.tin,
      trips: body.trips || [],
      totals: body.totals || {},
      prepared_by: body.preparedBy,
      payment_status: body.paymentStatus || 'pending'
    };

    const result = await query(`
      UPDATE billings
      SET billing_number = $1, period_start = $2, period_end = $3, client_name = $4,
          client_address = $5, client_city = $6, client_zip_code = $7, client_tin = $8,
          trips = $9, totals = $10, prepared_by = $11, payment_status = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      billingData.billing_number,
      billingData.period_start,
      billingData.period_end,
      billingData.client_name,
      billingData.client_address,
      billingData.client_city,
      billingData.client_zip_code,
      billingData.client_tin,
      JSON.stringify(billingData.trips),
      JSON.stringify(billingData.totals),
      billingData.prepared_by,
      billingData.payment_status,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Billing not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating billing:', error);
    res.status(500).json({ error: 'Failed to update billing' });
  }
});

router.delete('/billings/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM billings WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Billing not found' });
    }
    res.json({ message: 'Billing deleted successfully' });
  } catch (error) {
    console.error('Error deleting billing:', error);
    res.status(500).json({ error: 'Failed to delete billing' });
  }
});

// PDF download endpoint for billings
router.get('/billings/:id/download', async (req, res) => {
  try {
    const result = await query('SELECT billing_number FROM billings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Billing not found' });
    }

    const billing = result.rows[0];
    let details;
    try {
      // JSONB is already parsed by pg, so use directly
      details = billing.details || {};
    } catch (parseError) {
      console.warn(`Failed to parse billing details for ${req.params.id}:`, parseError.message);
      details = {};
    }

    if (!details.blobUrl) {
      return res.status(404).json({ message: 'PDF not available for this billing' });
    }

    // Redirect to the blob URL
    res.redirect(details.blobUrl);
  } catch (error) {
    console.error('Error downloading billing PDF:', error);
    res.status(500).json({ error: 'Failed to download billing PDF' });
  }
});

module.exports = router;
