# Pure Serverless Migration Plan - Component-Based Bundling with Universal Handler

## Overview
This migration converts the monolithic Express server to pure serverless functions using a **universal API handler pattern** similar to the ChatGPT discussion, bundled by frontend components to stay under Vercel's 12-function limit.

**Current Architecture:** Express server with 50+ routes
**Target Architecture:** 8 bundled serverless functions using universal handler pattern

## Universal API Handler Pattern (From ChatGPT Discussion)

```javascript
// utils/apiHandler.js - Universal handler with schema validation
// Direct implementation from your ChatGPT discussion for consistency

export default async function apiHandler({ req, res, handlers, schema = {} }) {
  const method = req.method;

  if (!handlers[method]) {
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  // Parse body safely
  let body = {};
  try {
    body = req.body || (req.json ? await req.json() : {});
  } catch (err) {
    // ignore if no body
  }

  // Automatic schema-based validation
  try {
    const methodSchema = schema[method] || {};
    const { query: querySchema = [], body: bodySchema = [] } = methodSchema;

    for (const key of querySchema) {
      if (!(key in req.query)) throw { status: 400, message: `Missing query parameter: ${key}` };
    }
    for (const key of bodySchema) {
      if (!(key in body)) throw { status: 400, message: `Missing body parameter: ${key}` };
    }
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || 'Validation error' });
  }

  // Execute the method-specific handler
  try {
    return await handlers[method]({ req, res, body });
  } catch (err) {
    console.error(`Error in ${method} handler:`, err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
```

## Component-Based Bundling Strategy

We'll bundle routes by frontend components to get exactly 8 functions (under 12 limit):

1. **`api/trips.js`** - All trip operations (trips component)
2. **`api/employees.js`** - All employee operations (employees component)
3. **`api/payslips.js`** - All payslip operations (payroll component)
4. **`api/billings.js`** - All billing operations (billing component)
5. **`api/rates.js`** - Rate lookups (settings component)
6. **`api/expenses.js`** - Expense management (expenses component)
7. **`api/fuel.js`** - Fuel tracking (maintenance component)
8. **`api/maintenance.js`** - Maintenance system (settings component)

## Detailed Migration Phases

### Phase 1: Prerequisites & Infrastructure Setup

#### Step 1.1: Create Universal Handler Library
- **File:** `api/_utils/apiHandler.js`
- **Content:** Implement the universal handler with schema validation from ChatGPT discussion
- **Test:** Create a simple test file to verify handler works

#### Step 1.2: Move Utility Files to Ignored Directories
- Move `api/billing-renderer.js` → `api/_lib/billing-renderer.js`
- Move `api/payslip-renderer.js` → `api/_lib/payslip-renderer.js`
- Move `api/pdf-service.js` → `api/_lib/pdf-service.js`
- Move `api/lib/db.js` → `api/_lib/db.js`
- Move `api/middleware/*` → `api/_lib/`
- Move `api/utils/*` → `api/_lib/`
- Update all import paths in existing files
- **Test:** Run `vercel dev` to ensure imports still work

#### Step 1.3: Create Shared Database Wrapper
- **File:** `api/_utils/db.js`
- **Content:** Wrapper with connection pooling for serverless
- **Test:** Basic database connection test

### Phase 2: Core Trips Component Migration

#### Step 2.1: Create api/trips.js Structure
```javascript
export const config = { runtime: 'nodejs' };
import apiHandler from './_utils/apiHandler';
import { query } from './_lib/db';

export default apiHandler({
  req,
  res,
  schema: {
    GET: { query: ['startDate', 'endDate'] },
    POST: { body: ['date'] },
    DELETE: { query: ['id'] }
  },
  handlers: {
    GET: async ({ req, res }) => {
      // Trip listing logic
    },
    POST: async ({ req, res, body }) => {
      // Trip creation logic
    },
    DELETE: async ({ req, res }) => {
      // Trip deletion logic
    }
  }
});
```

#### Step 2.2: Migrate GET /api/trips Routes
- Migrate `/api/trips` (with date filters and pagination)
- Migrate `/api/trips/calculated` (with rate lookups)
- Migrate `/api/trips/suggestions` (farm/destination suggestions)
- **Test:** Local testing with curl/Postman for all GET endpoints

#### Step 2.3: Migrate POST /api/trips Route
- Migrate trip creation with food allowance logic
- Migrate UUID generation and tracking number logic
- **Test:** Create test trip via POST and verify database

#### Step 2.4: Migrate PUT/DELETE /api/trips Routes
- Migrate `/api/trips/:id` PUT for updates
- Migrate `/api/trips/:id` DELETE
- **Test:** Update and delete operations

### Phase 3: Employee Component Migration

#### Step 3.1: Create api/employees.js Structure
- Similar universal handler structure
- Schema validation for employee operations

#### Step 3.2: Migrate Employee CRUD Operations
- GET `/api/employees`
- GET `/api/employees/:uuid`
- POST `/api/employees`
- PUT `/api/employees/:uuid`
- DELETE `/api/employees/:uuid`

#### Step 3.3: Migrate Employee PIN System
- PUT `/api/employees/:uuid/pin`
- GET `/api/employee/:pin/payslips`
- **Test:** PIN creation and validation logic

#### Step 3.4: Migrate Employee Matrix
- GET `/api/employees/matrix` (deduction configurations)
- **Test:** Matrix calculation and response format

### Phase 4: Payslip Component Migration

#### Step 4.1: Create api/payslips.js Structure
#### Step 4.2: Migrate Payslip CRUD
- GET `/api/payslips` (paginated)
- POST `/api/payslips` (with PDF generation)
- PUT `/api/payslips/:id`
- DELETE `/api/payslips/:id`
- GET `/api/payslips/:id/download`
#### Step 4.3: Migrate Pay Period Generation
- POST `/api/payslips/generate-pdf`
- **Test:** PDF generation and blob upload

### Phase 5: Billing Component Migration

#### Step 5.1: Create api/billings.js Structure
#### Step 5.2: Migrate Billing CRUD
- GET `/api/billings`
- POST `/api/billings`
- PUT `/api/billings/:id`
- DELETE `/api/billings/:id`
- GET `/api/billings/:id/download`
#### Step 5.3: Integrate PDF Service
- Call billing renderer for PDF generation
- **Test:** Billing creation with PDF

### Phase 6: Rates & Expenses Components

#### Step 6.1: Create api/rates.js
#### Step 6.2: Create api/expenses.js
#### Step 6.3: Migrate Rate and Expense Operations
- Rate search and CRUD operations
- Expense management with receipt uploads
- **Test:** Search functionality and file uploads

### Phase 7: Fuel & Maintenance Components

#### Step 7.1: Create api/fuel.js
#### Step 7.2: Create api/maintenance.js
#### Step 7.3: Migrate Fuel and Maintenance Operations
- Fuel tracking and bulk import
- Maintenance schedules, documents, notifications
- **Test:** Bulk operations and scheduling logic

### Phase 8: Configuration & Cleanup

#### Step 8.1: Update vercel.json
- Remove or update routing rules (functions handle their own routes now)

#### Step 8.2: Remove Old Express Files
- Delete `api/server.js`
- Delete empty directories (`api/lib/`, `api/middleware/`, etc.)

#### Step 8.3: Update Package.json
- Remove `express` and `serverless-http` dependencies
- Keep necessary deps: `pg`, `multer`, `axios`, etc.

### Phase 9: Testing & Verification

#### Step 9.1: Local Testing
- Run `vercel dev`
- Test all endpoints with curl/Postman
- Verify frontend API calls work

#### Step 9.2: Function Count Verification
- Deploy to staging
- Check Vercel dashboard shows 8 functions

#### Step 9.3: Full Deployment
- Deploy to production
- Verify all frontend operations work

#### Step 9.4: Performance Testing
- Test cold starts
- Verify consistent local vs deployed behavior

### Phase 10: Backup & Rollback

#### Step 10.1: Verify All Features Work
- Test every major functionality
- Compare with Express version

#### Step 10.2: Document Migration
- Update README with new architecture
- Document any backend changes

#### Step 10.3: Final Backup
- Create final commit
- Ready to rollback to `backup-express-architecture` branch if needed

## Testing Strategy at Each Step

### Unit Testing Each Handler
```javascript
// test/api/trips.test.js
import apiHandler from './_utils/apiHandler';

test('trips GET handler', async () => {
  const handlerResponse = await apiHandler({
    req: mockRequest,
    res: mockResponse,
    handlers: {/* trip handlers */},
    schema: {/* trip schema */}
  });
  expect(handlerResponse).toBeDefined();
});
```

### Integration Testing
- Test complete request/response cycles
- Test database operations
- Test file uploads and PDF generation

### End-to-End Testing
- Deploy staging environment
- Test all frontend components connect to new backend
- Verify all CRUD operations work

## Rollback Plan

If anything fails use:
```bash
git checkout backup-express-architecture
# Roll back to express setup
```

## Benefits of This Migration

1. **Stays Under 12 Function Limit** - 8 functions max
2. **Consistent Local vs Deployed** - Universal handler ensures parity
3. **Better Scalability** - Functions scale independently
4. **Easier Testing** - Test individual components
5. **Cleaner Architecture** - Components grouped logically
6. **Future-Proof** - Easy to add more endpoints within components

## Potential Challenges & Solutions

### Challenge: Shared Logic Across Functions
**Solution:** Create shared utilities in `api/_lib/` folder for common operations

### Challenge: Cache Management in Serverless
**Solution:** Move from NodeCache to external Redis or remove caching for serverless

### Challenge: File Uploads in Serverless
**Solution:** Use Vercel Blob or external S3 storage instead of FormData

### Challenge: Data Transformations
**Solution:** Create shared transformation utilities in `_lib/transforms.js`

Ready to execute Phase 1. Should I start with implementing the universal API handler utility?
