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
// ROUTE MODULE IMPORTS and MOUNTING
// ============================================================================

// Import consolidated route modules to stay within Vercel serverless function limits (Hobby plan: 12 functions max)
const financeRouter = require('./routes/finance');
const operationsRouter = require('./routes/operations');
const employeeRouter = require('./routes/employee');
const servicesRouter = require('./routes/services');

// Mount consolidated route modules (grouped to reduce serverless functions)
app.use('/api', financeRouter);       // rates, expenses, billings (all finance-related)
app.use('/api', operationsRouter);    // trips, fuel, vehicles, maintenance (all operations-related)
app.use('/api', employeeRouter);      // employees, deductions, configs, employee-portal
app.use('/api', servicesRouter);      // payslips, PDF generation, test endpoints

// ============================================================================
// Export the serverless handler
module.exports = app;
module.exports.handler = serverless(app);
