# MTM Serverless App Cleanup & Reorganization Plan

## Overview
This plan outlines the comprehensive cleanup and restructuring of the MTM serverless app to improve maintainability, remove redundant code, and organize the codebase into a more scalable structure.

## Phase 1: Remove Orphaned/Reundant Files
### Files to Delete (Safe Removal - Not Referenced)
1. **Test/Data Files**
   - `employees.json` - unused test employee data
   - `payslips.json` - unused test payslip data
   - `test-config-deductions.js` - test configuration file

2. **One-off Migration Scripts**
   - `api/fix-deductions-migration.js` - completed migration
   - `api/update-food-allowance.js` - completed migration

3. **Unused Renderer Classes**
   - `api/billing-renderer.js` - renderer class not used in server.js
   - `api/payslip-renderer.js` - renderer class not used in server.js

4. **Deprecated Setup Scripts**
   - `api/lib/create-indexes.js` - database setup script not used in production
   - `api/lib/create-tables.js` - database setup script not used in production

5. **Log/Backup Files**
   - `server_log.txt` - can be recreated if needed
   - `temp_backup/` - backup directory

6. **Documentation To Review**
   - `CRUD_ENDPOINTS_AUDIT.md` - may be kept or updated based on new structure

## Phase 2: Create Modular Structure
### Target Directory Structure
```
api/
├── server.js (entry point - 200-300 lines)
├── lib/
│   ├── db.js (unchanged)
│   └── pdf-service.js (unchanged)
├── routes/
│   ├── trips.js
│   ├── employees.js
│   ├── payslips.js
│   ├── billings.js
│   ├── deductions.js
│   ├── rates.js
│   ├── expenses.js
│   ├── fuel.js
│   ├── maintenance.js
│   └── auth.js
├── middleware/
│   ├── cors.js
│   ├── multer.js
│   ├── upload.js
│   └── cache.js
├── services/
│   ├── employee-deduction.js
│   └── trip-calculations.js
├── utils/
│   ├── date-parser.js
│   └── validation.js
└── models/
    └── employee.js
```

## Phase 3: Break Down server.js Code Organization

### Current server.js Structure (5,300+ lines):
- Express app setup (~100 lines)
- Middleware configuration (~50 lines)
- CORS, multer, compression (~100 lines)
- Multer upload configuration (~50 lines)
- All route handlers (5,000+ lines)
  - Trip routes (~800 lines)
  - Employee routes (~500 lines)
  - Deduction routes (~400 lines)
  - Billing routes (~400 lines)
  - Expense routes (~400 lines)
  - Fuel routes (~400 lines)
  - Maintenance routes (~1,000 lines)
- Helper functions scattered throughout (~200 lines)

### New Route Modules Breakdown:
1. **api/routes/trips.js** - All trip-related routes
   - GET/POST/PUT/DELETE /api/trips
   - GET /api/trips/suggestions
   - POST /api/trips/:id/complete
   - Put toll computation logic here

2. **api/routes/employees.js** - All employee-related routes
   - GET/POST/PUT/DELETE /api/employees
   - GET /api/employee/:pin/payslips
   - PUT /api/employees/:uuid/pin

3. **api/routes/payslips.js** - All payslip-related routes
   - GET/POST/PUT/DELETE /api/payslips
   - GET /api/payslips/:id/download
   - POST /api/payslips/generate-pdf

4. **api/routes/billings.js** - All billing-related routes
   - GET/POST/PUT/DELETE /api/billings
   - GET /api/billings/:id/download

5. **api/routes/deductions.js** - All deduction-related routes
   - GET/POST/PUT/DELETE /api/deductions
   - GET /api/employee-deduction-configs/matrix
   - Employee deduction config management

6. **api/routes/expenses.js** - All expense-related routes
   - GET/POST/PUT/DELETE /api/expenses
   - GET /api/expenses/:id/receipt

7. **api/routes/fuel.js** - All fuel-related routes
   - GET/POST/PUT/DELETE /api/fuel
   - POST /api/fuel/bulk

8. **api/routes/rates.js** - All rate-related routes
   - GET /api/rates
   - GET /api/rates/search
   - POST/PUT/DELETE /api/rates

9. **api/routes/maintenance.js** - All maintenance-related routes
   - GET/POST/PUT/DELETE maintenance schedules
   - GET/POST/PUT/DELETE vehicle documents
   - Notification preferences
   - Dashboard endpoint

10. **api/routes/auth.js** - Authentication-related routes
    - User contact management
    - Employee PIN validation

### Middleware Modules:
1. **api/middleware/multer.js**
   - Upload configuration
   - File filter functions

2. **api/middleware/cache.js**
   - NodeCache setup
   - Cache management functions

### Utility Modules:
1. **api/utils/date-parser.js**
   - parseDateQuery function
   - All date parsing logic

2. **api/utils/validation.js**
   - parseDeductionId function
   - Request validation helpers

### Service Modules:
1. **api/services/employee-deduction.js**
   - Employee-specific deduction calculation logic
   - Deduction config processing

2. **api/services/trip-calculations.js**
   - Rate calculation logic
   - Commission and toll calculations

## Phase 4: Refactor server.js Entry Point
### New api/server.js Structure:
```javascript
// Entry point only - load required modules
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const multer = require('multer');
const compression = require('compression');
const NodeCache = require('node-cache');
require('dotenv').config();

const { query } = require('./lib/db');
const PDFService = require('./pdf-service');

// Import all route modules
const tripsRoutes = require('./routes/trips');
const employeesRoutes = require('./routes/employees');
// ... other route imports

// Import middleware
const corsMiddleware = require('./middleware/cors');
const uploadMiddleware = require('./middleware/upload');


const cache = new NodeCache({ stdTTL: 900 });
const app = express();

// Apply middleware
app.use(corsMiddleware);
app.use(uploadMiddleware);

// Apply routes
app.use('/api', tripsRoutes);
app.use('/api', employeesRoutes);
// ... other route mounts

// Export serverless handler
module.exports = app;
module.exports.handler = serverless(app);
```

## Phase 5: Testing & Verification
### Checklist:
- [ ] All API endpoints return same responses
- [ ] No broken imports or dependencies
- [ ] Vercel deployment works
- [ ] Frontend communication intact
- [ ] All CRUD operations functional
- [ ] PDF generation still works
- [ ] Employee PIN authentication works
- [ ] File uploads work
- [ ] Database connections work

## Phase 6: Additional Improvements
### Post-Structuring Cleanup:
1. **Environment Variables**
   - Review all process.env usage
   - Ensure .env.example is complete

2. **Error Handling**
   - Centralized error handling middleware
   - Consistent error response format

3. **Performance**
   - Review cache management
   - Optimize database queries where possible

4. **Documentation**
   - Update API documentation
   - Add README files for new modules

## Migration Impact Assessment
### Low Risk Components:
- Static middleware extraction
- Utility function extraction
- Helper function extraction

### Medium Risk Components:
- Route extraction and mounting
- Database query extraction
- PDF service integration

### High Risk Components:
- Cache management integration
- Express app restructuring
- Serverless handler configuration

## Rollback Plan
- Keep backup copy of original server.js
- Use git versioning for all changes
- Test deploy to staging before production

## Timeline Estimate
- Phase 1: File removal - 15 minutes
- Phase 2: Directory structure - 10 minutes
- Phase 3: Route extraction - 2-3 hours
- Phase 4: Server entry point - 30 minutes
- Phase 5: Testing - 1 hour
- Phase 6: Improvements - Ongoing

**Total estimated time: 4-5 hours**
