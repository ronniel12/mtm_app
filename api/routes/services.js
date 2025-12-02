const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const PDFService = require('../pdf-service');

// ============================================================================
// PAYSLIPS ROUTES
// ============================================================================

router.get('/payslips', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get total count for pagination metadata
    const countResult = await query('SELECT COUNT(*) as total FROM payslips');
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      'SELECT * FROM payslips ORDER BY created_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      payslips: result.rows,
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
    console.error('Error fetching payslips:', error);
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});

router.get('/payslips/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM payslips WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching payslip:', error);
    res.status(500).json({ error: 'Failed to fetch payslip' });
  }
});

// PDF download endpoint for payslips
router.get('/payslips/:id/download', async (req, res) => {
  try {
    const result = await query('SELECT details FROM payslips WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    const payslip = result.rows[0];
    let details;
    try {
      // JSONB is already parsed by pg, so use directly
      details = payslip.details || {};
    } catch (parseError) {
      console.warn(`Failed to parse payslip details for ${req.params.id}:`, parseError.message);
      details = {};
    }

    if (!details.blobUrl) {
      return res.status(404).json({ message: 'PDF not available for this payslip' });
    }

    // Redirect to the blob URL
    res.redirect(details.blobUrl);
  } catch (error) {
    console.error('Error downloading payslip PDF:', error);
    res.status(500).json({ error: 'Failed to download payslip PDF' });
  }
});

// Generate PDF for employee payslips on-demand
router.post('/payslips/generate-pdf', async (req, res) => {
  try {
    const payslipData = req.body;

    if (!payslipData || !payslipData.payslipNumber) {
      return res.status(400).json({
        error: 'Invalid payslip data provided',
        received: {
          hasData: !!payslipData,
          payslipNumber: payslipData?.payslipNumber
        }
      });
    }


    // Transform employee payslip data to match PDF service format
    // This matches the structure expected by PDFService.generatePayslipHTML
    const transformedData = {
      payslipNumber: payslipData.payslipNumber,
      employee: {
        name: payslipData.employeeName || 'Employee'
      },
      period: {
        periodText: payslipData.period
      },
      totals: {
        grossPay: payslipData.grossPay || 0,
        totalDeductions: payslipData.totalDeductions || 0,
        netPay: payslipData.netPay || 0,
        totalBags: payslipData.trips?.reduce((sum, trip) => sum + (trip.numberOfBags || trip.number_of_bags || 0), 0) || 0
      },
      deductions: payslipData.deductions || [],
      trips: payslipData.trips?.map(trip => {
        // Ensure we have the role information needed for PDF
        const role = trip._role || 'D'; // Default to Driver if not specified
        const commission = trip._commission || (role === 'D' ? 0.11 : 0.10); // Default commission rates

        return {
          date: trip.date,
          truckPlate: trip.truckPlate || trip.truck_plate,
          invoiceNumber: trip.invoiceNumber,
          destination: trip.destination || trip.fullDestination,
          numberOfBags: trip.numberOfBags || trip.number_of_bags,
          // Preserve or reconstruct the detailed information needed for PDF columns
          _role: role,
          _commission: commission,
          adjustedRate: trip.adjustedRate || (trip.rate ? trip.rate - 4 : 0),
          rate: trip.rate || 0,
          total: trip.total || 0
        };
      }) || [],
      createdDate: payslipData.createdDate
    };

    // Generate PDF using the same service as admin payslips
    const pdfBuffer = await PDFService.generatePDFOnly(transformedData);


    // Return the PDF buffer as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payslipData.payslipNumber}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating employee payslip PDF:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      details: error.message
    });
  }
});

router.post('/payslips', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Generate PDF synchronously (works in serverless)
    let pdfResult = null;
    try {
      pdfResult = await PDFService.generateAndUploadPDF(body);
    } catch (pdfError) {
      console.error('❌ PDF generation failed during payslip creation:', pdfError.message);
      pdfResult = { pdfGenerated: false, error: pdfError.message };
    }

    // Build details with PDF result
    const payslipDetails = {
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

    // Create the payslip record with PDF URL embedded
    const result = await query(`
      INSERT INTO payslips (id, payslip_number, employee_uuid, period_start, period_end, gross_pay, deductions, net_pay, status, created_date, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      body.id || Date.now().toString(),
      body.payslipNumber,
      body.employee?.uuid || body.employee_uuid,
      body.period?.startDate || body.period_start,
      body.period?.endDate || body.period_end,
      parseFloat(body.totals?.grossPay || body.gross_pay || 0),
      parseFloat(body.totals?.totalDeductions || body.deductions || 0),
      parseFloat(body.totals?.netPay || body.net_pay || 0),
      body.status || 'pending',
      body.createdDate || new Date().toISOString(),
      JSON.stringify(payslipDetails)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payslip:', error);
    res.status(500).json({ error: 'Failed to create payslip', details: error.message });
  }
});

router.put('/payslips/:id', async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE payslips
      SET payslip_number = $1, employee_uuid = $2, period_start = $3, period_end = $4,
          gross_pay = $5, deductions = $6, net_pay = $7, status = $8, details = $9
      WHERE id = $10
      RETURNING *
    `, [
      body.payslipNumber,
      body.employee?.uuid || body.employee_uuid,
      body.period?.startDate || body.period_start,
      body.period?.endDate || body.period_end,
      parseFloat(body.totals?.grossPay || body.gross_pay || 0),
      parseFloat(body.totals?.totalDeductions || body.deductions || 0),
      parseFloat(body.totals?.netPay || body.net_pay || 0),
      body.status || 'pending',
      JSON.stringify(body),
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payslip:', error);
    res.status(500).json({ error: 'Failed to update payslip' });
  }
});

router.delete('/payslips/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM payslips WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }
    res.json({ message: 'Payslip deleted successfully' });
  } catch (error) {
    console.error('Error deleting payslip:', error);
    res.status(500).json({ error: 'Failed to delete payslip' });
  }
});

// ============================================================================
// TEST ROUTES (for development)
// ============================================================================

// Test PDF generation and blob upload endpoint
router.post('/test/pdf', async (req, res) => {
  try {

    // Create mock payslip data for testing
    const mockPayslipData = {
      id: 'TEST-' + Date.now(),
      payslipNumber: 'TEST-001',
      employee: {
        uuid: 'test-employee-uuid',
        name: 'Test Employee Name'
      },
      period: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        periodText: 'January 2025'
      },
      totals: {
        grossPay: 35000.00,
        totalDeductions: 2500.00,
        netPay: 32500.00
      },
      deductions: [
        { name: 'SSS Share', calculatedAmount: 500.00, type: 'standard' },
        { name: 'PhilHealth', calculatedAmount: 400.00, type: 'standard' },
        { name: 'Pag-IBIG', calculatedAmount: 200.00, type: 'standard' },
        { name: 'Cash Advance', calculatedAmount: 1400.00, type: 'employee', isEmployeeSpecific: true }
      ],
      trips: [
        {
          date: '2025-01-15',
          truckPlate: 'TEST-PLATE',
          invoiceNumber: 'INV-001',
          destination: 'Test Destination',
          rate: 450.00,
          bags: 10,
          total: 4500.00
        },
        {
          date: '2025-01-20',
          truckPlate: 'TEST-PLATE',
          invoiceNumber: 'INV-002',
          destination: 'Another Destination',
          rate: 420.00,
          bags: 8,
          total: 3360.00
        }
      ],
      createdDate: new Date().toISOString()
    };


    // Test the complete PDF workflow
    const pdfResult = await PDFService.generateAndUploadPDF(mockPayslipData);


    res.json({
      success: pdfResult.pdfGenerated,
      message: pdfResult.pdfGenerated ?
        'PDF generated and uploaded to Vercel Blob successfully!' :
        'PDF generation/upload failed',
      result: pdfResult,
      testData: {
        urlAccessible: pdfResult.pdfGenerated ? `${pdfResult.blobUrl}` : null,
        note: 'If successful, you can visit the blobUrl directly to download the PDF'
      }
    });

  } catch (error) {
    console.error('❌ PDF test failed:', error);
    res.status(500).json({
      success: false,
      message: 'PDF test failed with error',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
