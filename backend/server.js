const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const NodeCache = require('node-cache');
const multer = require('multer');
const { query } = require('./db');
require('dotenv').config();

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

console.log('🚀 Starting server with updated deductions endpoints...');

const app = express();

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Middleware initialization completed, now routes
// Trip suggestions API endpoint (must come before /api/trips/:id to avoid route conflict)
app.get('/api/trips/suggestions', async (req, res) => {
  try {
    // Extract unique farm suggestions from trips data
    const result = await query('SELECT farm_name, destination, full_destination FROM trips WHERE farm_name IS NOT NULL AND farm_name != \'\'');
    const farmMap = new Map();
    const destinationMap = new Map();

    result.rows.forEach(trip => {
      // Farm suggestions
      if (trip.farm_name && trip.farm_name.trim()) {
        const farmName = trip.farm_name.trim();
        const destination = trip.destination || '';
        const fullDestination = trip.full_destination || '';

        // Extract town and province from destination (format: "Town - Province")
        let town = '';
        let province = '';

        if (destination.includes(' - ')) {
          const parts = destination.split(' - ');
          if (parts.length === 2) {
            town = parts[0].trim();
            province = parts[1].trim();
          }
        }

        // Use farm name as key to avoid duplicates
        if (!farmMap.has(farmName)) {
          farmMap.set(farmName, {
            name: farmName,
            town: town,
            province: province,
            fullAddress: fullDestination
          });
        }
      }

      // Destination suggestions
      if (trip.destination && trip.destination.trim()) {
        const destination = trip.destination.trim();
        if (!destinationMap.has(destination)) {
          destinationMap.set(destination, destination);
        }
      }
    });

    const farms = Array.from(farmMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const destinations = Array.from(destinationMap.values()).sort();

    res.json({
      farms: farms,
      destinations: destinations
    });

  } catch (error) {
    console.error('Error getting trip suggestions:', error);
    res.status(500).json({ error: 'Failed to get trip suggestions' });
  }
});

app.get('/api/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    let limit, offset;

    // Check if limit is 'all' to fetch all records without pagination
    if (limitParam === 'all') {
      limit = null; // No limit
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    // Get total count for pagination metadata
    const countResult = await query('SELECT COUNT(*) as total FROM trips');
    const total = parseInt(countResult.rows[0].total);

    let result;
    if (limit === null) {
      // Fetch all records without pagination
      result = await query('SELECT * FROM trips ORDER BY created_at DESC');
    } else {
      // Get paginated results
      result = await query(
        'SELECT * FROM trips ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
    }

    // Transform database format to frontend expected format (snake_case to camelCase)
    const transformedTrips = result.rows.map(trip => {
      return {
        id: trip.id,
        trackingNumber: trip.tracking_number,
        date: trip.date,
        truckPlate: trip.truck_plate,
        invoiceNumber: trip.invoice_number,
        origin: trip.origin,
        farmName: trip.farm_name,
        destination: trip.destination,
        fullDestination: trip.full_destination,
        rateLookupKey: trip.rate_lookup_key,
        status: trip.status,
        estimatedDelivery: trip.estimated_delivery,
        driver: trip.driver,
        helper: trip.helper,
        numberOfBags: trip.number_of_bags,
        createdAt: trip.created_at,
        updatedAt: trip.updated_at,
        // Toll-related fields (convert snake_case to camelCase)
        computedToll: trip.computed_toll,
        roundtripToll: trip.roundtrip_toll,
        actualTollExpense: trip.actual_toll_expense
      };
    });

    res.json({
      trips: transformedTrips,
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
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

app.get('/api/trips/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM trips WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Transform database format to frontend expected format (snake_case to camelCase)
    const trip = result.rows[0];
    const transformedTrip = {
      id: trip.id,
      trackingNumber: trip.tracking_number,
      date: trip.date,
      truckPlate: trip.truck_plate,
      invoiceNumber: trip.invoice_number,
      origin: trip.origin,
      farmName: trip.farm_name,
      destination: trip.destination,
      fullDestination: trip.full_destination,
      rateLookupKey: trip.rate_lookup_key,
      status: trip.status,
      estimatedDelivery: trip.estimated_delivery,
      driver: trip.driver,
      helper: trip.helper,
      numberOfBags: trip.number_of_bags,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
      // Toll-related fields (convert snake_case to camelCase)
      computedToll: trip.computed_toll,
      roundtripToll: trip.roundtrip_toll,
      actualTollExpense: trip.actual_toll_expense
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

app.post('/api/trips', async (req, res) => {
  try {
    // Get the next ID
    const idResult = await query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM trips');
    const nextId = idResult.rows[0].next_id;

    const newTrip = {
      id: nextId,
      tracking_number: `TRP${String(nextId).padStart(3, '0')}`,
      date: req.body.date || new Date().toISOString().split('T')[0],
      truck_plate: req.body.truckPlate || 'NGU 9174',
      invoice_number: req.body.invoiceNumber || 'To be assigned',
      origin: req.body.origin || 'Dampol 2nd A, Pulilan Bulacan',
      farm_name: req.body.farmName || req.body.destination || 'Farm destination',
      destination: req.body.destination || 'Destine destination',
      full_destination: req.body.fullDestination || '',
      rate_lookup_key: req.body.rateLookupKey || '',
      status: req.body.status || 'Pending',
      estimated_delivery: req.body.estimatedDelivery || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      driver: req.body.driver || 'MTM Driver',
      helper: req.body.helper || '',
      number_of_bags: req.body.numberOfBags || 1
    };

    const result = await query(`
      INSERT INTO trips (id, tracking_number, date, truck_plate, invoice_number, origin, farm_name, destination, full_destination, rate_lookup_key, status, estimated_delivery, driver, helper, number_of_bags, computed_toll, roundtrip_toll, actual_toll_expense)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      newTrip.id, newTrip.tracking_number, newTrip.date, newTrip.truck_plate, newTrip.invoice_number,
      newTrip.origin, newTrip.farm_name, newTrip.destination, newTrip.full_destination, newTrip.rate_lookup_key,
      newTrip.status, newTrip.estimated_delivery, newTrip.driver, newTrip.helper, newTrip.number_of_bags,
      0, // computed_toll default
      0, // roundtrip_toll default
      0  // actual_toll_expense default
    ]);

    console.log('Creating new trip:', newTrip.tracking_number);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

app.put('/api/trips/:id', async (req, res) => {
  try {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        // Convert camelCase to snake_case for database columns
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(parseInt(req.params.id)); // Add ID at the end

    const result = await query(`
      UPDATE trips
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Transform database format to frontend expected format (snake_case to camelCase)
    const trip = result.rows[0];
    const transformedTrip = {
      id: trip.id,
      trackingNumber: trip.tracking_number,
      date: trip.date,
      truckPlate: trip.truck_plate,
      invoiceNumber: trip.invoice_number,
      origin: trip.origin,
      farmName: trip.farm_name,
      destination: trip.destination,
      fullDestination: trip.full_destination,
      rateLookupKey: trip.rate_lookup_key,
      status: trip.status,
      estimatedDelivery: trip.estimated_delivery,
      driver: trip.driver,
      helper: trip.helper,
      numberOfBags: trip.number_of_bags,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
      // Toll-related fields (convert snake_case to camelCase)
      computedToll: trip.computed_toll,
      roundtripToll: trip.roundtrip_toll,
      actualTollExpense: trip.actual_toll_expense
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

app.delete('/api/trips/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM trips WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Rates API endpoints - supports both destination and town fields for backward compatibility
app.get('/api/rates', async (req, res) => {
  try {
    const { origin, province, destination, town } = req.query;
    const searchTerm = destination || town;

    // Create cache key based on query parameters
    const cacheKey = `rates:${JSON.stringify({ origin, province, destination, town })}`;

    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log('📋 Serving rates from cache');
      return res.json(cachedResult);
    }

    let queryStr = 'SELECT * FROM rates WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (origin) {
      queryStr += ` AND LOWER(origin) LIKE $${paramCount}`;
      params.push(`%${origin.toLowerCase()}%`);
      paramCount++;
    }

    if (province) {
      queryStr += ` AND LOWER(province) LIKE $${paramCount}`;
      params.push(`%${province.toLowerCase()}%`);
      paramCount++;
    }

    if (searchTerm) {
      queryStr += ` AND (LOWER(town) LIKE $${paramCount} OR LOWER(origin) LIKE $${paramCount} OR LOWER(province) LIKE $${paramCount})`;
      params.push(`%${searchTerm.toLowerCase()}%`);
    }

    const result = await query(queryStr, params);

    // Cache the result
    cache.set(cacheKey, result.rows);
    console.log('💾 Cached rates query result');

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

app.get('/api/rates/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      const result = await query('SELECT * FROM rates LIMIT 10');
      return res.json(result.rows);
    }

    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    const result = await query(`
      SELECT * FROM rates
      WHERE LOWER(origin) LIKE $1
         OR LOWER(province) LIKE $1
         OR LOWER(town) LIKE $1
    `, [searchTerm]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching rates:', error);
    res.status(500).json({ error: 'Failed to search rates' });
  }
});

// Drivers API endpoints
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await query('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO drivers (name, phone, license_number)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.body.name, req.body.phone, req.body.licenseNumber]);

    console.log('Created new driver:', req.body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

app.put('/api/drivers/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE drivers
      SET name = $1, phone = $2, license_number = $3
      WHERE id = $4
      RETURNING *
    `, [req.body.name, req.body.phone, req.body.licenseNumber, parseInt(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM drivers WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Failed to delete driver' });
  }
});

// Helpers API endpoints
app.get('/api/helpers', async (req, res) => {
  try {
    const result = await query('SELECT * FROM helpers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching helpers:', error);
    res.status(500).json({ error: 'Failed to fetch helpers' });
  }
});

app.post('/api/helpers', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO helpers (name, phone, address)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.body.name, req.body.phone, req.body.address]);

    console.log('Created new helper:', req.body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating helper:', error);
    res.status(500).json({ error: 'Failed to create helper' });
  }
});

app.put('/api/helpers/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE helpers
      SET name = $1, phone = $2, address = $3
      WHERE id = $4
      RETURNING *
    `, [req.body.name, req.body.phone, req.body.address, parseInt(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Helper not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating helper:', error);
    res.status(500).json({ error: 'Failed to update helper' });
  }
});

app.delete('/api/helpers/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM helpers WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Helper not found' });
    }
    res.json({ message: 'Helper deleted successfully' });
  } catch (error) {
    console.error('Error deleting helper:', error);
    res.status(500).json({ error: 'Failed to delete helper' });
  }
});

// Employee API endpoints
app.get('/api/employees', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'employees:all';
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log('📋 Serving employees from cache');
      return res.json(cachedResult);
    }

    const result = await query('SELECT * FROM employees ORDER BY created_at DESC');

    // Cache the result
    cache.set(cacheKey, result.rows);
    console.log('💾 Cached employees result');

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.get('/api/employees/:uuid', async (req, res) => {
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

app.post('/api/employees', async (req, res) => {
  try {
    // Generate UUID if not provided
    const uuid = req.body.uuid || require('crypto').randomUUID();

    const result = await query(`
      INSERT INTO employees (uuid, name, phone, license_number, pagibig_number, sss_number, philhealth_number, address, cash_advance, loans, auto_deduct_cash_advance, auto_deduct_loans)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      uuid,
      req.body.name,
      req.body.phone || '',
      req.body.licenseNumber || '',
      req.body.pagibigNumber || '',
      req.body.sssNumber || '',
      req.body.philhealthNumber || '',
      req.body.address || '',
      parseFloat(req.body.cashAdvance) || 0,
      parseFloat(req.body.loans) || 0,
      req.body.autoDeductCashAdvance !== false, // Default true
      req.body.autoDeductLoans !== false // Default true
    ]);

    // Clear employees cache
    cache.del('employees:all');
    console.log('🗑️ Cleared employees cache after creation');

    console.log('Created new employee:', req.body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

app.put('/api/employees/:uuid', async (req, res) => {
  try {
    const result = await query(`
      UPDATE employees
      SET name = $1, phone = $2, license_number = $3, pagibig_number = $4, sss_number = $5,
          philhealth_number = $6, address = $7, cash_advance = $8, loans = $9,
          auto_deduct_cash_advance = $10, auto_deduct_loans = $11, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $12
      RETURNING *
    `, [
      req.body.name,
      req.body.phone || '',
      req.body.licenseNumber || '',
      req.body.pagibigNumber || '',
      req.body.sssNumber || '',
      req.body.philhealthNumber || '',
      req.body.address || '',
      parseFloat(req.body.cashAdvance) || 0,
      parseFloat(req.body.loans) || 0,
      req.body.autoDeductCashAdvance !== false,
      req.body.autoDeductLoans !== false,
      req.params.uuid
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log('Updated employee:', req.body.name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:uuid', async (req, res) => {
  try {
    const result = await query('DELETE FROM employees WHERE uuid = $1 RETURNING *', [req.params.uuid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    console.log('Deleted employee:', result.rows[0].name);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Bulk import trips from CSV
app.post('/api/trips/bulk-import', express.text(), (req, res) => {
  try {
    const csvString = req.body.trim();
    console.log('Received CSV data for bulk import. Length:', csvString.length);

    if (!csvString || csvString.length === 0) {
      return res.status(400).json({ error: 'No CSV data received' });
    }

    // Split into lines and clean them
    const lines = csvString.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log(`Processing ${lines.length} lines`);

    if (lines.length < 2) {
      return res.status(400).json({ error: 'Invalid CSV data - needs at least header and one data row' });
    }

    const importResults = {
      imported: 0,
      failed: 0,
      total: lines.length - 1
    };

    // Skip header and process data rows
    lines.slice(1).forEach((line, index) => {
      try {
        // Split by comma and handle quotes properly
        const values = parseCSVLine(line);
        if (values.length < 10) {
          console.log(`Line ${index + 2}: Skipping malformed row with ${values.length} columns`);
          importResults.failed++;
          return;
        }

        // Parse date from Excel format (DD-MM-YY) to proper yyyy-MM-dd format
        let parsedDate;
        try {
          const dateStr = values[0];
          if (dateStr.includes('-')) {
            const dateParts = dateStr.split('-');
            // Convert month abbreviations to numbers
            const monthMap = {
              'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
              'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            const monthNum = monthMap[dateParts[1]] || dateParts[1].padStart(2, '0');
            parsedDate = `20${dateParts[2]}-${monthNum}-${dateParts[0].padStart(2, '0')}`;
          } else {
            parsedDate = dateStr; // Keep as is if not in expected format
          }
        } catch (dateError) {
          console.log(`Line ${index + 2}: Date parsing error for "${values[0]}"`);
          parsedDate = '2025-01-01'; // Fallback to a valid date
        }

        const trip = {
          id: trips.length + 1,
          trackingNumber: `TRS${String(trips.length + 1).padStart(4, '0')}`,
          date: parsedDate,
          truckPlate: values[1] || 'UNKNOWN',
          invoiceNumber: values[2] || 'To be assigned',
          origin: values[3] || 'Pulilan Bulacan',
          farmName: values[5] || 'Unknown Farm',
          destination: `${values[7] || 'Unknown'} - ${values[8] || 'Unknown'}`, // Town - Province format like "Luna - La Union"
          fullDestination: values[9] || 'Unknown Address', // The complete address format
          numberOfBags: 1, // We'll extract bags from invoice if needed
          driver: 'MTM Driver',
          helper: '',
          status: 'Completed',
          estimatedDelivery: parsedDate
        };

        trips.push(trip);
        importResults.imported++;

      } catch (error) {
        console.error(`Error parsing line ${index + 2}:`, line, error);
        importResults.failed++;
      }
    });

    // Save the imported data
    saveData('trips.json', trips);

    console.log(`Bulk import completed: ${importResults.imported} imported, ${importResults.failed} failed`);
    res.json({
      success: true,
      message: `Imported ${importResults.imported} trips, ${importResults.failed} failed`,
      ...importResults
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: `Failed to process CSV data: ${error.message}` });
  }
});

// Helper function to parse CSV line (handle quoted values)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Rates CRUD endpoints
app.post('/api/rates', (req, res) => {
  const newRate = {
    id: rates.length + 1,
    origin: req.body.origin,
    province: req.body.province,
    town: req.body.town,
    newRates: parseFloat(req.body.newRates || req.body.rate)
  };
  rates.push(newRate);
  saveData('rates.json', rates);
  res.status(201).json(newRate);
});

app.put('/api/rates/:origin/:province/:town', (req, res) => {
  const { origin, province, town } = req.params;
  const { originalOrigin, originalProvince, originalTown, ...updateData } = req.body;

  const rateIndex = rates.findIndex(r =>
    r.origin.toLowerCase() === originalOrigin.toLowerCase() &&
    r.province.toLowerCase() === originalProvince.toLowerCase() &&
    (r.town ? r.town.toLowerCase() === originalTown.toLowerCase() : r.destination.toLowerCase() === originalTown.toLowerCase())
  );

  if (rateIndex === -1) {
    return res.status(404).json({ message: 'Rate not found' });
  }

  // Remove the old rate
  const oldRate = rates.splice(rateIndex, 1)[0];

  // Create the updated rate
  const updatedRate = {
    ...oldRate,
    ...updateData
  };

  rates.push(updatedRate);
  saveData('rates.json', rates);
  res.json(updatedRate);
});

app.delete('/api/rates/:origin/:province/:town', (req, res) => {
  const { origin, province, town } = req.params;
  const rateIndex = rates.findIndex(r =>
    r.origin.toLowerCase() === origin.toLowerCase() &&
    r.province.toLowerCase() === province.toLowerCase() &&
    (r.town ? r.town.toLowerCase() === town.toLowerCase() : r.destination.toLowerCase() === town.toLowerCase())
  );

  if (rateIndex === -1) {
    return res.status(404).json({ message: 'Rate not found' });
  }

  rates.splice(rateIndex, 1);
  saveData('rates.json', rates);
  res.json({ message: 'Rate deleted successfully' });
});

// Billings API endpoints
app.get('/api/billings', async (req, res) => {
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
    const transformedBillings = result.rows.map(billing => {
      console.log('🔄 Transforming billing:', billing.id, 'period_start:', billing.period_start, 'period_end:', billing.period_end);

      const transformed = {
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
          city: billing.client_address ? billing.client_address.split(',')[0] : '',
          zipCode: billing.client_address ? billing.client_address.split(',').pop().trim() : '',
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
      };

      console.log('✅ Transformed billing period:', transformed.period);
      return transformed;
    });

    console.log('📤 Sending transformed billings:', transformedBillings.length);
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

app.get('/api/billings/:id', async (req, res) => {
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

app.post('/api/billings', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO billings (id, billing_number, period_start, period_end, client_name, client_address, client_tin, trips, totals, prepared_by, payment_status, created_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      req.body.id || Date.now().toString(),
      req.body.billingNumber,
      req.body.period?.startDate,
      req.body.period?.endDate,
      req.body.client?.name,
      req.body.client?.address,
      req.body.client?.tin,
      JSON.stringify(req.body.trips || []),
      JSON.stringify(req.body.totals || {}),
      req.body.preparedBy,
      req.body.paymentStatus || 'pending',
      req.body.createdDate || new Date().toISOString()
    ]);

    console.log('Created new billing:', req.body.billingNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating billing:', error);
    res.status(500).json({ error: 'Failed to create billing' });
  }
});

app.put('/api/billings/:id', async (req, res) => {
  try {
    console.log('🔄 PUT /api/billings received data:', JSON.stringify(req.body, null, 2));

    // Transform frontend format to database format
    const billingData = {
      billing_number: req.body.billingNumber,
      period_start: req.body.period?.startDate,
      period_end: req.body.period?.endDate,
      client_name: req.body.client?.name,
      client_address: req.body.client?.address,
      client_tin: req.body.client?.tin,
      trips: req.body.trips || [],
      totals: req.body.totals || {},
      prepared_by: req.body.preparedBy,
      payment_status: req.body.paymentStatus || 'pending'
    };

    console.log('📝 Transformed billing data:', billingData);

    const result = await query(`
      UPDATE billings
      SET billing_number = $1, period_start = $2, period_end = $3, client_name = $4,
          client_address = $5, client_tin = $6, trips = $7, totals = $8,
          prepared_by = $9, payment_status = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      billingData.billing_number,
      billingData.period_start,
      billingData.period_end,
      billingData.client_name,
      billingData.client_address,
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

    console.log('Updated billing:', billingData.billing_number);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating billing:', error);
    res.status(500).json({ error: 'Failed to update billing' });
  }
});

app.delete('/api/billings/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM billings WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Billing not found' });
    }
    console.log('Deleted billing:', result.rows[0].billing_number);
    res.json({ message: 'Billing deleted successfully' });
  } catch (error) {
    console.error('Error deleting billing:', error);
    res.status(500).json({ error: 'Failed to delete billing' });
  }
});

// Payslips API endpoints
app.get('/api/payslips', async (req, res) => {
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

app.get('/api/payslips/:id', async (req, res) => {
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

app.post('/api/payslips', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO payslips (id, payslip_number, employee_uuid, period_start, period_end, gross_pay, deductions, net_pay, status, created_date, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.body.id || Date.now().toString(),
      req.body.payslipNumber,
      req.body.employee?.uuid || req.body.employee_uuid,
      req.body.period?.startDate || req.body.period_start,
      req.body.period?.endDate || req.body.period_end,
      parseFloat(req.body.totals?.grossPay || req.body.gross_pay || 0),
      parseFloat(req.body.totals?.totalDeductions || req.body.deductions || 0),
      parseFloat(req.body.totals?.netPay || req.body.net_pay || 0),
      req.body.status || 'pending',
      req.body.createdDate || new Date().toISOString(),
      JSON.stringify(req.body)
    ]);

    console.log('Created new payslip:', req.body.payslipNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payslip:', error);
    res.status(500).json({ error: 'Failed to create payslip' });
  }
});

app.put('/api/payslips/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE payslips
      SET payslip_number = $1, employee_uuid = $2, period_start = $3, period_end = $4,
          gross_pay = $5, deductions = $6, net_pay = $7, status = $8, details = $9
      WHERE id = $10
      RETURNING *
    `, [
      req.body.payslipNumber,
      req.body.employee?.uuid || req.body.employee_uuid,
      req.body.period?.startDate || req.body.period_start,
      req.body.period?.endDate || req.body.period_end,
      parseFloat(req.body.totals?.grossPay || req.body.gross_pay || 0),
      parseFloat(req.body.totals?.totalDeductions || req.body.deductions || 0),
      parseFloat(req.body.totals?.netPay || req.body.net_pay || 0),
      req.body.status || 'pending',
      JSON.stringify(req.body),
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    console.log('Updated payslip:', req.body.payslipNumber);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payslip:', error);
    res.status(500).json({ error: 'Failed to update payslip' });
  }
});

app.delete('/api/payslips/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM payslips WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payslip not found' });
    }
    console.log('Deleted payslip:', result.rows[0].payslip_number);
    res.json({ message: 'Payslip deleted successfully' });
  } catch (error) {
    console.error('Error deleting payslip:', error);
    res.status(500).json({ error: 'Failed to delete payslip' });
  }
});

// Deductions API endpoints
app.get('/api/deductions', async (req, res) => {
  try {
    const result = await query('SELECT * FROM deductions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ error: 'Failed to fetch deductions' });
  }
});

app.get('/api/deductions/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM deductions WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching deduction:', error);
    res.status(500).json({ error: 'Failed to fetch deduction' });
  }
});

app.post('/api/deductions', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO deductions (name, type, value, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      req.body.name,
      req.body.type,
      parseFloat(req.body.value),
      req.body.isDefault || false
    ]);

    console.log('Created new deduction:', req.body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating deduction:', error);
    res.status(500).json({ error: 'Failed to create deduction' });
  }
});

app.put('/api/deductions/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE deductions
      SET name = $1, type = $2, value = $3, is_default = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [
      req.body.name,
      req.body.type,
      parseFloat(req.body.value),
      req.body.isDefault || false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    console.log('Updated deduction:', req.body.name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating deduction:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

app.delete('/api/deductions/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM deductions WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }
    console.log('Deleted deduction:', result.rows[0].name);
    res.json({ message: 'Deduction deleted successfully' });
  } catch (error) {
    console.error('Error deleting deduction:', error);
    res.status(500).json({ error: 'Failed to delete deduction' });
  }
});

// Vehicles API endpoints
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles ORDER BY created_at DESC');

    // Transform database format to frontend expected format (snake_case to camelCase)
    const transformedVehicles = result.rows.map(vehicle => ({
      id: vehicle.id,
      plateNumber: vehicle.plate_number,
      vehicleClass: vehicle.vehicle_class,
      name: vehicle.name,
      createdAt: vehicle.created_at,
      updatedAt: vehicle.updated_at
    }));

    res.json(transformedVehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO vehicles (plate_number, vehicle_class, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [
      req.body.plateNumber,
      req.body.vehicleClass,
      req.body.name || null
    ]);

    console.log('Created new vehicle:', req.body.plateNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Plate number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE vehicles
      SET plate_number = $1, vehicle_class = $2, name = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [
      req.body.plateNumber,
      req.body.vehicleClass,
      req.body.name || null,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    console.log('Updated vehicle:', req.body.plateNumber);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Plate number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    console.log('Deleted vehicle:', result.rows[0].plate_number);
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// Expenses API endpoints
app.get('/api/expenses', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');

    // Transform dates to ensure they're returned as date strings without timezone conversion
    const transformedExpenses = result.rows.map(expense => ({
      ...expense,
      date: expense.date ? expense.date.toISOString().split('T')[0] : null
    }));

    res.json(transformedExpenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.get('/api/expenses/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Transform date to ensure it's returned as a date string without timezone conversion
    const expense = result.rows[0];
    const transformedExpense = {
      ...expense,
      date: expense.date ? expense.date.toISOString().split('T')[0] : null
    };

    res.json(transformedExpense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

app.post('/api/expenses', upload.single('receipt'), async (req, res) => {
  try {
    let receiptData = {
      filename: null,
      originalName: null,
      mimetype: null,
      size: null,
      data: null
    };

    // Handle file upload if present
    if (req.file) {
      receiptData = {
        filename: `receipt-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer // Store the file buffer as BLOB
      };
    }

    const result = await query(`
      INSERT INTO expenses (date, category, description, vehicle, amount, payment_method, notes, receipt_filename, receipt_original_name, receipt_mimetype, receipt_size, receipt_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      req.body.date,
      req.body.category,
      req.body.description,
      req.body.vehicle || null,
      parseFloat(req.body.amount),
      req.body.paymentMethod || 'cash',
      req.body.notes || null,
      receiptData.filename,
      receiptData.originalName,
      receiptData.mimetype,
      receiptData.size,
      receiptData.data
    ]);

    console.log('Created new expense:', req.body.description);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE expenses
      SET date = $1, category = $2, description = $3, vehicle = $4, amount = $5, payment_method = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      req.body.date,
      req.body.category,
      req.body.description,
      req.body.vehicle || null,
      parseFloat(req.body.amount),
      req.body.paymentMethod || 'cash',
      req.body.notes || null,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    console.log('Updated expense:', req.body.description);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    console.log('Deleted expense:', result.rows[0].description);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Serve receipt files from database BLOB
app.get('/api/expenses/:id/receipt', async (req, res) => {
  try {
    const result = await query('SELECT receipt_data, receipt_mimetype, receipt_original_name FROM expenses WHERE id = $1', [parseInt(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const expense = result.rows[0];

    if (!expense.receipt_data) {
      return res.status(404).json({ message: 'No receipt found for this expense' });
    }

    // Set appropriate headers
    const mimetype = expense.receipt_mimetype || 'application/octet-stream';
    const filename = expense.receipt_original_name || 'receipt';

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Send the BLOB data
    res.send(expense.receipt_data);
  } catch (error) {
    console.error('Error serving receipt:', error);
    res.status(500).json({ error: 'Failed to serve receipt' });
  }
});



// Load toll data - commented out for now since we're migrating to database
// let tollData = loadData('toll_data.json');
let tollData = null; // Temporarily disabled

// Toll API endpoints - Use RMap API for proper routing and toll calculation
app.post('/api/tolls/calculate', async (req, res) => {
  try {
    const { origin, destination, town, date, vehicleClass } = req.body;

    console.log('🛣️ Toll calculation request (via RMap):', { origin, destination, town, vehicleClass });

    if (!origin || (!destination && !town)) {
      return res.status(400).json({ error: 'Origin and destination/town are required' });
    }

    // Use vehicle class to determine toll rates (default to Class 2)
    const vehicleClassKey = vehicleClass || '2';

    // Create addresses for RMap API (RMap adds ", Philippines" internally)
    const originAddress = origin;
    const destinationAddress = town || destination;

    console.log('📍 Routing addresses:', { originAddress, destinationAddress });

    // Call RMap API for routing and toll calculation
    const rmapResponse = await axios.post('http://localhost:8000/route', {
      origin: originAddress,
      destination: destinationAddress,
      vehicle: vehicleClassKey,
      profile: "car"
    });

    console.log('✅ RMap API response received with', rmapResponse.data.length, 'routes');
    console.log('📊 Full RMap response data:', JSON.stringify(rmapResponse.data, null, 2));

    // Transform RMap response to match our expected format
    const routes = rmapResponse.data.map(route => ({
      toll: route.toll || 0,
      distance: route.distance || 0,
      duration: route.duration || 0,
      optimization: route.optimization || 'fastest',
      toll_details: route.toll_details || [],
      system: 'RMap',
      geometry: route.geometry // Keep the encoded polyline for potential client-side use
    }));

    console.log('🔄 Transformed routes:', JSON.stringify(routes, null, 2));

    // Find the route with tolls (prefer shortest distance among toll routes)
    let bestRoute = routes.find(route => route.toll > 0) || routes[0];

    if (routes.length > 1) {
      const tollRoutes = routes.filter(route => route.toll > 0);
      if (tollRoutes.length > 0) {
        // Among routes with tolls, select the shortest distance
        bestRoute = tollRoutes.reduce((best, route) =>
          route.distance < best.distance ? route : best
        );
      }
    }

    res.json({
      tollFee: bestRoute.toll || 0,
      details: bestRoute.toll_details || [],
      routes: routes,
      origin,
      destination,
      town,
      vehicleClass: vehicleClassKey,
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error calling RMap API:', error.response?.data || error.message);

    // Fallback to basic toll calculation if RMap is unavailable
    console.log('🔄 Falling back to basic toll calculation...');

    try {
      // Use fallback toll calculation
      const vehicleClassKey = req.body.vehicleClass || '2';
      const vehicleTollData = tollData[vehicleClassKey] || tollData['2'];

      const tollResult = calculateTollFromMatrix(
        req.body.origin,
        req.body.town || req.body.destination,
        vehicleTollData
      );

      // If no direct route, try multi-system
      if (tollResult.tollFee === 0 && tollResult.routes[0].optimization === 'no-toll') {
        const multiSystemResult = calculateMultiSystemToll(
          req.body.origin,
          req.body.town || req.body.destination,
          vehicleTollData
        );
        if (multiSystemResult.tollFee > 0) {
          return res.json({
            ...multiSystemResult,
            origin: req.body.origin,
            destination: req.body.destination,
            town: req.body.town,
            vehicleClass: vehicleClassKey,
            calculatedAt: new Date().toISOString(),
            fallbackMode: true
          });
        }
      }

      return res.json({
        ...tollResult,
        origin: req.body.origin,
        destination: req.body.destination,
        town: req.body.town,
        vehicleClass: vehicleClassKey,
        calculatedAt: new Date().toISOString(),
        fallbackMode: true
      });

    } catch (fallbackError) {
      console.error('❌ Fallback toll calculation also failed:', fallbackError);
      return res.status(500).json({
        error: 'RMap API unavailable and fallback calculation failed',
        tollFee: 0,
        routes: [],
        origin: req.body.origin,
        destination: req.body.destination,
        town: req.body.town,
        vehicleClass: req.body.vehicleClass || '2',
        calculatedAt: new Date().toISOString()
      });
    }
  }
});

// Helper function to calculate toll from matrix data
function calculateTollFromMatrix(origin, destination, tollData) {
  // Extract location names from origin (remove ", Bulacan" suffix if present)
  const cleanOrigin = origin.replace(/,\s*Bulacan\s*$/i, '').trim();
  // For destination, use the passed town/destination directly (no parsing needed)
  const cleanDestination = destination.trim();

  console.log('🔍 Processing locations:', { cleanOrigin, cleanDestination });

  // Find matching toll systems and calculate tolls
  const routes = [];
  let bestRoute = null;
  let cheapestRoute = null;

  // Check each toll system
  for (const [systemName, systemData] of Object.entries(tollData)) {
    const plazas = systemData.plazas;
    const matrix = systemData.matrix;

    // Find entry and exit plazas that match our locations
    const entryPlaza = findMatchingPlaza(cleanOrigin, plazas);
    const exitPlaza = findMatchingPlaza(cleanDestination, plazas);

    if (entryPlaza && exitPlaza && matrix[entryPlaza] && matrix[entryPlaza][exitPlaza] !== undefined) {
      const tollAmount = matrix[entryPlaza][exitPlaza];

      if (tollAmount > 0) { // Only include routes with tolls
        const route = {
          toll: tollAmount,
          distance: estimateDistance(entryPlaza, exitPlaza, plazas), // Estimate distance
          duration: estimateDuration(entryPlaza, exitPlaza, plazas), // Estimate duration
          optimization: 'direct',
          toll_details: [
            { plaza: entryPlaza, amount: 0 }, // Entry plaza (no toll)
            { plaza: exitPlaza, amount: tollAmount } // Exit plaza (toll collected)
          ],
          system: systemName
        };

        routes.push(route);

        // Track best/cheapest routes
        if (!bestRoute || route.toll > bestRoute.toll) {
          bestRoute = route;
        }
        if (!cheapestRoute || route.toll < cheapestRoute.toll) {
          cheapestRoute = route;
        }
      }
    }
  }

  // If no direct routes found, try to find alternative routes or use fallback
  if (routes.length === 0) {
    console.log('⚠️ No direct toll routes found, using fallback calculation');
    return createFallbackRoute(cleanOrigin, cleanDestination);
  }

  // Sort routes by toll amount (highest first for "best" route)
  routes.sort((a, b) => b.toll - a.toll);

  // Ensure we have at least one route marked as "fastest" and one as "cheapest"
  if (routes.length >= 2) {
    routes[0].optimization = 'fastest'; // Highest toll (usually longer/more direct)
    routes[routes.length - 1].optimization = 'cheapest'; // Lowest toll
  } else if (routes.length === 1) {
    routes[0].optimization = 'direct';
  }

  return {
    tollFee: routes[0].toll,
    details: routes[0].toll_details,
    routes: routes
  };
}

// Helper function to find matching plaza for a location
function findMatchingPlaza(location, plazas) {
  if (!location) return null;

  const locationLower = location.toLowerCase().trim();

  // Direct matches first (exact plaza name matches)
  for (const [plazaName, plazaData] of Object.entries(plazas)) {
    if (plazaName.toLowerCase().includes(locationLower) ||
        locationLower.includes(plazaName.toLowerCase())) {
      return plazaName;
    }
  }

  // Specific town to plaza mappings based on toll data
  const specificMappings = {
    // La Union towns - TPLEX plazas (since TPLEX goes to La Union area)
    'luna': ['Victoria', 'Gerona', 'Moncada'], // Closest TPLEX plazas
    'bauang': ['Victoria', 'Gerona', 'Moncada'],
    'arlingay': ['Victoria', 'La Paz', 'Gerona'],
    'caba': ['Victoria', 'La Paz', 'Gerona'],
    'naguilian': ['Paniqui', 'Moncada'],
    'aringay': ['Victoria', 'La Paz', 'Gerona'], // Fixed typo

    // Pangasinan towns - TPLEX plazas
    'umingan': ['Paniqui', 'Moncada', 'Gerona'],
    'sison': ['Paniqui', 'Moncada', 'Pozorrubbio'],
    'bugallon': ['Urdaneta', 'Binalonan', 'Pozorrubbio'],
    'dagupan': ['Urdaneta', 'Binalonan', 'Pozorrubbio'],
    'alaminos': ['Urdaneta', 'Binalonan'],
    'alingayen': ['Urdaneta', 'Binalonan'],
    'mangaldan': ['Urdaneta', 'Binalonan'],
    'san carlos': ['Urdaneta', 'Binalonan'],
    'binalonan': ['Binalonan'],
    'urdaneta': ['Urdaneta'],

    // Nueva Ecija towns - NLEX plazas
    'cabanatuan': ['Balagtas', 'Bocaue', 'Marilao'],
    'guimba': ['Balagtas', 'Bocaue'],
    'munoz': ['Balagtas', 'Bocaue', 'Marilao'],
    'san jose': ['Balagtas', 'Bocaue', 'Marilao'],
    'talavera': ['Balagtas', 'Bocaue'],

    // Tarlac towns - SCTEX/TPLEX plazas
    'tarlac': ['Paniqui', 'Moncada'],
    'paniqui': ['Paniqui'],

    // Zambales towns - SCTEX plazas
    'iba': ['Dinalupihan', 'Floridablanca'],
    'olongapo': ['Dinalupihan', 'Floridablanca'],
    'subic': ['Dinalupihan', 'Floridablanca'],

    // Bulacan towns - NLEX entry plazas
    'pulilan': ['Balagtas', 'Bocaue'],

    // Quezon towns - STAR plazas
    'lucban': ['Sta. Toribio', 'Malvar'],
    'sariaya': ['Sta. Toribio', 'Malvar'],

    // Batangas towns - STAR plazas
    'batangas': ['Malvar', 'Sto. Tomas'],
    'lipa': ['Malvar', 'Sto. Tomas']
  };

  // Check specific mappings first
  if (specificMappings[locationLower]) {
    for (const plaza of specificMappings[locationLower]) {
      if (plazas[plaza]) {
        console.log(`🏛️ Matched "${location}" to plaza "${plaza}"`);
        return plaza;
      }
    }
  }

  // Fallback to general province-based matching
  const provinceMappings = {
    'la union': ['Victoria', 'Gerona', 'Moncada'],
    'pangasinan': ['Paniqui', 'Moncada', 'Urdaneta'],
    'nueva ecija': ['Balagtas', 'Bocaue', 'Marilao'],
    'zambales': ['Dinalupihan', 'Floridablanca'],
    'tarlac': ['Paniqui', 'Moncada'],
    'batangas': ['Malvar', 'Sto. Tomas', 'Tanauan'],
    'quezon': ['Sta. Toribio', 'Malvar', 'Sariaya'],
    'bataan': ['Dinalupihan', 'Floridablanca'],
    'laguna': ['Calamba', 'Sta. Rosa/Tagaytay'],
    'cavite': ['Bacoor', 'Kawit'],
    'bulacan': ['Balagtas', 'Bocaue', 'Marilao']
  };

  for (const [province, possiblePlazas] of Object.entries(provinceMappings)) {
    if (locationLower.includes(province)) {
      for (const plaza of possiblePlazas) {
        if (plazas[plaza]) {
          console.log(`📍 Matched "${location}" (${province}) to plaza "${plaza}"`);
          return plaza;
        }
      }
    }
  }

  return null;
}

// Helper function to estimate distance between plazas
function estimateDistance(entryPlaza, exitPlaza, plazas) {
  if (!plazas[entryPlaza] || !plazas[exitPlaza]) return 50000; // 50km default

  const entry = plazas[entryPlaza];
  const exit = plazas[exitPlaza];

  // Calculate rough distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (exit.lat - entry.lat) * Math.PI / 180;
  const dLon = (exit.lng - entry.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(entry.lat * Math.PI / 180) * Math.cos(exit.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Convert to meters

  return Math.round(distance);
}

// Helper function to estimate duration between plazas
function estimateDuration(entryPlaza, exitPlaza, plazas) {
  const distance = estimateDistance(entryPlaza, exitPlaza, plazas);
  // Assume average speed of 60 km/h (16.67 m/s)
  const speed = 16.67;
  return Math.round(distance / speed);
}

// Helper function for multi-system toll calculation
function calculateMultiSystemToll(origin, destination, tollData) {
  const cleanOrigin = origin.replace(/,\s*Bulacan\s*$/i, '').trim();
  const cleanDestination = destination.trim();

  console.log('🔄 Multi-system routing:', { cleanOrigin, cleanDestination });

  const routes = [];

  // Define common toll system connections
  const systemConnections = {
    // NLEX connections
    'NLEX_SCTEX_(Class_3)': ['NLEX_Connector_(Class_3)', 'Skyway_Stage_3_(Class_3)'],
    'NLEX_Connector_(Class_3)': ['NLEX_SCTEX_(Class_3)'],

    // SCTEX connections
    'NLEX_SCTEX_(Class_3)': ['NLEX_Harbor_Link_(Class_3)'],
    'NLEX_Harbor_Link_(Class_3)': ['NLEX_SCTEX_(Class_3)'],

    // TPLEX connections (northbound from Tarlac)
    'SLEX_SKYWAY_MCX_(Class_3)': ['TPLEX_(Class_3)'],
    'TPLEX_(Class_3)': ['NLEX_SCTEX_(Class_3)', 'STAR_(Class_3)'] // Connected via Tarlac area
  };

  // For Bulacan to La Union route: Pulilan/Bulacan (NLEX) → Tarlac area (SCTEX/TPLEX) → La Union (TPLEX)
  if (cleanOrigin.toLowerCase().includes('pulilan') || cleanOrigin.toLowerCase().includes('bulacan')) {
    if (cleanDestination.toLowerCase().includes('luna') || cleanDestination.toLowerCase().includes('la union')) {
      // Calculate Bulacan to Tarlac segment (NLEX → SCTEX connection)
      const bulacanToll = calculateSegmentToll('Marilao', null, 'Balagtas', tollData['NLEX_SCTEX_(Class_3)'], 'NLEX');
      const tarlacToLunaToll = calculateSegmentToll('Paniqui', null, 'Victoria', tollData['TPLEX_(Class_3)'], 'TPLEX');

      if (bulacanToll > 0 && tarlacToLunaToll > 0) {
        const totalToll = bulacanToll + tarlacToLunaToll;
        routes.push({
          toll: totalToll,
          distance: 200000, // ~200km
          duration: 18000, // ~5 hours
          optimization: 'multi-system',
          toll_details: [
            { plaza: 'Balagtas', amount: bulacanToll, system: 'NLEX' },
            { plaza: 'Victoria', amount: tarlacToLunaToll, system: 'TPLEX' }
          ],
          system: 'NLEX + TPLEX'
        });
      }
    }
  }

  // For other La Union towns, try TPLEX directly from major entry points
  if (cleanDestination.toLowerCase().includes('la union') ||
      cleanDestination.toLowerCase().includes('luna') ||
      cleanDestination.toLowerCase().includes('bauang') ||
      cleanDestination.toLowerCase().includes('arlingay')) {

    // Try to find an entry plaza from any connected system
    const entryPlazas = ['Paniqui', 'Moncada', 'Binalonan', 'Urdaneta'];
    const exitPlazas = ['Victoria', 'Gerona', 'Moncada'];

    for (const entry of entryPlazas) {
      for (const exit of exitPlazas) {
        const toll = calculateSegmentToll(entry, exit, null, tollData['TPLEX_(Class_3)'], 'TPLEX');
        if (toll > 0) {
          routes.push({
            toll: toll,
            distance: 150000, // ~150km
            duration: 10800, // ~3 hours
            optimization: 'connected',
            toll_details: [
              { plaza: entry, amount: 0, system: 'TPLEX' },
              { plaza: exit, amount: toll, system: 'TPLEX' }
            ],
            system: 'TPLEX'
          });
          break; // Use first valid route
        }
      }
      if (routes.length > 0) break;
    }
  }

  if (routes.length > 0) {
    console.log('✅ Multi-system route found:', routes[0]);
    return {
      tollFee: routes[0].toll,
      details: routes[0].toll_details,
      routes: routes
    };
  }

  return createFallbackRoute(cleanOrigin, cleanDestination);
}

// Helper function to calculate toll for a segment within one system
function calculateSegmentToll(entryPlaza, altEntry, exitPlaza, systemData, systemName) {
  if (!systemData || !systemData.matrix) return 0;

  const matrix = systemData.matrix;

  // Try primary entry plaza first
  if (matrix[entryPlaza] && matrix[entryPlaza][exitPlaza]) {
    return matrix[entryPlaza][exitPlaza];
  }

  // Try alternative entry plaza
  if (altEntry && matrix[altEntry] && matrix[altEntry][exitPlaza]) {
    return matrix[altEntry][exitPlaza];
  }

  return 0;
}

// Fallback route when no direct toll routes are found
function createFallbackRoute(origin, destination) {
  return {
    tollFee: 0,
    details: [],
    routes: [{
      toll: 0,
      distance: 50000, // 50km default
      duration: 3000, // 50 minutes default
      optimization: 'no-toll',
      toll_details: [],
      system: 'No toll roads found'
    }]
  };
}



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
