const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const NodeCache = require('node-cache');
const multer = require('multer');
const compression = require('compression');
const { query } = require('./lib/db');
const PDFService = require('./pdf-service');
require('dotenv').config();

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

const app = express();

// Middleware
app.use(cors()); // CORS middleware
app.set('trust proxy', 1); // Trust proxy for Vercel deployment

// Body parsing will be handled by individual routes or Vercel's built-in parser

// Configure multer for memory storage (for BLOB storage)
const storage = multer.memoryStorage();

// File filter to allow only images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

    // ============================================================================
    // INLINE API ROUTES (Single Serverless Function Approach)
    // All routes defined inline to create ONE serverless function for all API endpoints
    // ============================================================================

    // `query` and `PDFService` already imported at top of file
    // Load all routes from consolidated router files and define them inline
    // This avoids separate router files that Vercel treats as individual functions

    // ============================================================================
    // EMPLOYEE PORTAL ROUTES (Most Critical)
    // ============================================================================

    // Get employee's payslips by PIN (used by Employee Portal)
    app.get('/api/employee/:pin/payslips', async (req, res) => {
      try {
        const { pin } = req.params;

        // Validate PIN format (must be 4 digits)
        if (!pin || !/^\d{4}$/.test(pin)) {
          return res.status(400).json({
            error: 'Invalid PIN format',
            message: 'PIN must be exactly 4 digits'
          });
        }

        // Find employee by PIN
        const employeeResult = await query(
          'SELECT * FROM employees WHERE access_pin = $1',
          [pin]
        );

        if (employeeResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Employee not found',
            message: 'No employee found with this PIN'
          });
        }

        const employee = employeeResult.rows[0];

        // Get employee's payslips ordered by most recent first
        const payslipsResult = await query(
          'SELECT * FROM payslips WHERE employee_uuid = $1 ORDER BY created_date DESC',
          [employee.uuid]
        );

        // Format payslips data for Employee Portal consumption
        const formattedPayslips = payslipsResult.rows.map(payslip => {
          let details = {};
          try {
            // Parse payslip details from JSONB
            details = payslip.details && typeof payslip.details === 'string' ?
              JSON.parse(payslip.details) : payslip.details || {};
          } catch (parseError) {
            console.warn(`Failed to parse payslip details for ${payslip.id}:`, parseError.message);
            details = {};
          }

          // Return simplified format expected by Employee Portal
          return {
            id: payslip.id,
            payslipNumber: payslip.payslip_number,
            employeeName: employee.name,
            period: details.period?.periodText || '',
            grossPay: payslip.gross_pay || details.totals?.grossPay || 0,
            totalDeductions: payslip.deductions || details.totals?.totalDeductions || 0,
            netPay: payslip.net_pay || details.totals?.netPay || 0,
            trips: details.trips || [],
            deductions: details.deductions || [],
            createdDate: payslip.created_date,
            status: payslip.status,
            blobUrl: details.blobUrl // For PDF download if available
          };
        });

        // Return employee and their payslips
        res.json({
          employee: {
            id: employee.id,
            name: employee.name,
            position: employee.position,
            department: employee.department,
            pin: employee.access_pin
          },
          payslips: formattedPayslips
        });

      } catch (error) {
        console.error('Error fetching employee payslips:', error);
        res.status(500).json({
          error: 'Failed to fetch employee payslips',
          message: error.message
        });
      }
    });

    // ============================================================================
    // ESSENTIAL CRUD ROUTES (For Dashboard/Admin Functionality)
    // ============================================================================

    // Get all employees
    app.get('/api/employees', async (req, res) => {
      try {
        const result = await query('SELECT * FROM employees ORDER BY name ASC');
        res.json(result.rows);
      } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
      }
    });

    // Trip calculation endpoint
    app.get('/api/trips/calculated', async (req, res) => {
      try {
        const limit = req.query.limit;
        // For now, just return empty array - can be implemented properly later
        res.json({ trips: [], total: 0, limit: limit });
      } catch (error) {
        console.error('Error fetching calculated trips:', error);
        res.status(500).json({ error: 'Failed to fetch calculated trips' });
      }
    });

    // ============================================================================
    // TEST ROUTES (For PDF Service Testing)
    // ============================================================================

    app.post('/api/test/pdf', async (req, res) => {
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

// ============================================================================
// Export the serverless handler
module.exports = app;
module.exports.handler = serverless(app);
