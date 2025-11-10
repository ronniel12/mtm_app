const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const NodeCache = require('node-cache');
const multer = require('multer');
const compression = require('compression');
const { query } = require('../backend/db');
require('dotenv').config();

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

const app = express();

// Middleware
app.use(cors());
app.use(compression({ level: 6 })); // Add compression middleware

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

// JSON parsing middleware - applied selectively to avoid conflicts
const jsonParser = express.json({ limit: '10mb' });

// Copy all routes from original server.js
// Trip suggestions API endpoint
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

// All routes from your original server.js

app.get('/api/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    let limit, offset;

    if (limitParam === 'all') {
      limit = null;
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    const countResult = await query('SELECT COUNT(*) as total FROM trips');
    const total = parseInt(countResult.rows[0].total);

    let result;
    if (limit === null) {
      result = await query('SELECT * FROM trips ORDER BY created_at DESC');
    } else {
      result = await query(
        'SELECT * FROM trips ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
    }

    const transformedTrips = result.rows.map(trip => {
      // Convert all timestamps to local time for display (add 2 hours for Helsinki)
      // PostgreSQL stores as UTC, so we need to add 2 hours for Helsinki time
      const createdAtDate = new Date(trip.created_at);
      const updatedAtDate = new Date(trip.updated_at);

      // Always add 2 hours to convert from UTC to Helsinki time
      const localCreatedAt = new Date(createdAtDate.getTime() + (2 * 60 * 60 * 1000));
      const localUpdatedAt = new Date(updatedAtDate.getTime() + (2 * 60 * 60 * 1000));

      const adjustedCreatedAt = localCreatedAt.getFullYear() + '-' +
        String(localCreatedAt.getMonth() + 1).padStart(2, '0') + '-' +
        String(localCreatedAt.getDate()).padStart(2, '0') + ' ' +
        String(localCreatedAt.getHours()).padStart(2, '0') + ':' +
        String(localCreatedAt.getMinutes()).padStart(2, '0') + ':' +
        String(localCreatedAt.getSeconds()).padStart(2, '0') + '.' +
        String(localCreatedAt.getMilliseconds()).padStart(3, '0') + '+02';

      const adjustedUpdatedAt = localUpdatedAt.getFullYear() + '-' +
        String(localUpdatedAt.getMonth() + 1).padStart(2, '0') + '-' +
        String(localUpdatedAt.getDate()).padStart(2, '0') + ' ' +
        String(localUpdatedAt.getHours()).padStart(2, '0') + ':' +
        String(localUpdatedAt.getMinutes()).padStart(2, '0') + ':' +
        String(localUpdatedAt.getSeconds()).padStart(2, '0') + '.' +
        String(localUpdatedAt.getMilliseconds()).padStart(3, '0') + '+02';

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
        createdAt: adjustedCreatedAt,
        updatedAt: adjustedUpdatedAt,
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

// Optimized trips endpoint with pre-calculated rates
app.get('/api/trips/calculated', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    let limit, offset;

    if (limitParam === 'all') {
      limit = null;
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    // For paginated requests, use separate optimized queries
    if (limit !== null) {
      // Get data first (usually faster)
      const tripsResult = await query(
        'SELECT * FROM trips ORDER BY id DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      // Get cached count (much faster than recounting every time)
      const countCacheKey = 'trips:count';
      let total = cache.get(countCacheKey);
      if (!total) {
        const countResult = await query('SELECT COUNT(*) as total FROM trips');
        total = parseInt(countResult.rows[0].total);
        cache.set(countCacheKey, total, 300); // Cache count for 5 minutes
      }

      const trips = tripsResult.rows;

      // Get cached data
      const ratesCacheKey = 'rates:all';
      let rates = cache.get(ratesCacheKey);
      if (!rates) {
        const ratesResult = await query('SELECT * FROM rates');
        rates = ratesResult.rows;
        cache.set(ratesCacheKey, rates, 900);
      }

      const employeesCacheKey = 'employees:all';
      let employees = cache.get(employeesCacheKey);
      if (!employees) {
        const employeesResult = await query('SELECT * FROM employees');
        employees = employeesResult.rows;
        cache.set(employeesCacheKey, employees, 900);
      }

      // Process trips with pre-calculated rates
      const processedTrips = trips.map(trip => {
        // Convert timestamps to local time
        const createdAtDate = new Date(trip.created_at);
        const updatedAtDate = new Date(trip.updated_at);
        const localCreatedAt = new Date(createdAtDate.getTime() + (2 * 60 * 60 * 1000));
        const localUpdatedAt = new Date(updatedAtDate.getTime() + (2 * 60 * 60 * 1000));

        const adjustedCreatedAt = localCreatedAt.getFullYear() + '-' +
          String(localCreatedAt.getMonth() + 1).padStart(2, '0') + '-' +
          String(localCreatedAt.getDate()).padStart(2, '0') + ' ' +
          String(localCreatedAt.getHours()).padStart(2, '0') + ':' +
          String(localCreatedAt.getMinutes()).padStart(2, '0') + ':' +
          String(localCreatedAt.getSeconds()).padStart(2, '0') + '.' +
          String(localCreatedAt.getMilliseconds()).padStart(3, '0') + '+02';

        const adjustedUpdatedAt = localUpdatedAt.getFullYear() + '-' +
          String(localUpdatedAt.getMonth() + 1).padStart(2, '0') + '-' +
          String(localUpdatedAt.getDate()).padStart(2, '0') + ' ' +
          String(localUpdatedAt.getHours()).padStart(2, '0') + ':' +
          String(localUpdatedAt.getMinutes()).padStart(2, '0') + ':' +
          String(localUpdatedAt.getSeconds()).padStart(2, '0') + '.' +
          String(localUpdatedAt.getMilliseconds()).padStart(3, '0') + '+02';

        // Calculate rate for this trip
        let foundRate = null;
        const destination = trip.destination || '';
        const destinationParts = destination.split(' - ');
        if (destinationParts.length === 2) {
          const townName = destinationParts[0].trim();
          const provinceName = destinationParts[1].trim();

          const exactMatch = rates.find(rate =>
            (rate.town?.toLowerCase() === townName.toLowerCase()) &&
            (rate.province?.toLowerCase() === provinceName.toLowerCase())
          );

          if (exactMatch) {
            foundRate = exactMatch.new_rates || exactMatch.rates;
          }
        }

        const total = foundRate ? foundRate * (trip.number_of_bags || 0) : 0;

        // Get employee names
        const driverName = trip.driver ? employees.find(emp => emp.uuid === trip.driver)?.name || 'Unknown' : 'Not assigned';
        const helperName = trip.helper ? employees.find(emp => emp.uuid === trip.helper)?.name || 'Unknown' : 'Not assigned';

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
          driverName: driverName,
          helper: trip.helper,
          helperName: helperName,
          numberOfBags: trip.number_of_bags,
          createdAt: adjustedCreatedAt,
          updatedAt: adjustedUpdatedAt,
          computedToll: trip.computed_toll,
          roundtripToll: trip.roundtrip_toll,
          actualTollExpense: trip.actual_toll_expense,
          // Pre-calculated rate data
          _rate: foundRate,
          _rateFound: !!foundRate,
          _total: total,
          _rateStatus: foundRate ? null : 'No rate available'
        };
      });

      return res.json({
        trips: processedTrips,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
    }

    // For "all" requests, get count and all trips
    const countResult = await query('SELECT COUNT(*) as total FROM trips');
    const total = parseInt(countResult.rows[0].total);
    const tripsResult = await query('SELECT * FROM trips ORDER BY id DESC');

    // Get all rates for calculation (cached)
    const ratesCacheKey = 'rates:all';
    let rates = cache.get(ratesCacheKey);
    if (!rates) {
      const ratesResult = await query('SELECT * FROM rates');
      rates = ratesResult.rows;
      cache.set(ratesCacheKey, rates, 900); // Cache for 15 minutes
    }

    // Get employees for name resolution (cached)
    const employeesCacheKey = 'employees:all';
    let employees = cache.get(employeesCacheKey);
    if (!employees) {
      const employeesResult = await query('SELECT * FROM employees');
      employees = employeesResult.rows;
      cache.set(employeesCacheKey, employees, 900); // Cache for 15 minutes
    }

    // Process trips with pre-calculated rates
    const processedTrips = tripsResult.rows.map(trip => {
      // Convert timestamps to local time
      const createdAtDate = new Date(trip.created_at);
      const updatedAtDate = new Date(trip.updated_at);
      const localCreatedAt = new Date(createdAtDate.getTime() + (2 * 60 * 60 * 1000));
      const localUpdatedAt = new Date(updatedAtDate.getTime() + (2 * 60 * 60 * 1000));

      const adjustedCreatedAt = localCreatedAt.getFullYear() + '-' +
        String(localCreatedAt.getMonth() + 1).padStart(2, '0') + '-' +
        String(localCreatedAt.getDate()).padStart(2, '0') + '-' +
        String(localCreatedAt.getHours()).padStart(2, '0') + ':' +
        String(localCreatedAt.getMinutes()).padStart(2, '0') + ':' +
        String(localCreatedAt.getSeconds()).padStart(2, '0') + '.' +
        String(localCreatedAt.getMilliseconds()).padStart(3, '0') + '+02';

      const adjustedUpdatedAt = localUpdatedAt.getFullYear() + '-' +
        String(localUpdatedAt.getMonth() + 1).padStart(2, '0') + '-' +
        String(localUpdatedAt.getDate()).padStart(2, '0') + ' ' +
        String(localUpdatedAt.getHours()).padStart(2, '0') + ':' +
        String(localUpdatedAt.getMinutes()).padStart(2, '0') + ':' +
        String(localUpdatedAt.getSeconds()).padStart(2, '0') + '.' +
        String(localUpdatedAt.getMilliseconds()).padStart(3, '0') + '+02';

      // Calculate rate for this trip
      let foundRate = null;
      const destination = trip.destination || '';
      const destinationParts = destination.split(' - ');
      if (destinationParts.length === 2) {
        const townName = destinationParts[0].trim();
        const provinceName = destinationParts[1].trim();

        const exactMatch = rates.find(rate =>
          (rate.town?.toLowerCase() === townName.toLowerCase()) &&
          (rate.province?.toLowerCase() === provinceName.toLowerCase())
        );

        if (exactMatch) {
          foundRate = exactMatch.new_rates || exactMatch.rates;
        }
      }

      const total = foundRate ? foundRate * (trip.number_of_bags || 0) : 0;

      // Get employee names
      const driverName = trip.driver ? employees.find(emp => emp.uuid === trip.driver)?.name || 'Unknown' : 'Not assigned';
      const helperName = trip.helper ? employees.find(emp => emp.uuid === trip.helper)?.name || 'Unknown' : 'Not assigned';

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
        driverName: driverName,
        helper: trip.helper,
        helperName: helperName,
        numberOfBags: trip.number_of_bags,
        createdAt: adjustedCreatedAt,
        updatedAt: adjustedUpdatedAt,
        computedToll: trip.computed_toll,
        roundtripToll: trip.roundtrip_toll,
        actualTollExpense: trip.actual_toll_expense,
        // Pre-calculated rate data
        _rate: foundRate,
        _rateFound: !!foundRate,
        _total: total,
        _rateStatus: foundRate ? null : 'No rate available'
      };
    });

    res.json({
      trips: processedTrips,
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
    console.error('Error fetching calculated trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips with calculations' });
  }
});

// Add all routes from your original server.js here
app.get('/api/trips/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM trips WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

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

// Continue copying all other routes from your original server.js
app.post('/api/trips', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Use current UTC time - PostgreSQL will handle timezone conversion
    const finalTimestamp = new Date().toISOString();

    const utcNow = new Date();
    const localNow = new Date(utcNow.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours for Helsinki
    const tomorrow = new Date(localNow.getTime() + 24 * 60 * 60 * 1000);

    const idResult = await query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM trips');
    const nextId = idResult.rows[0].next_id;

    const newTrip = {
      id: nextId,
      tracking_number: `TRP${String(nextId).padStart(3, '0')}`,
      date: body.date || utcNow.toISOString().split('T')[0],
      truck_plate: body.truckPlate || 'NGU 9174',
      invoice_number: body.invoiceNumber || 'To be assigned',
      origin: body.origin || 'Dampol 2nd A, Pulilan Bulacan',
      farm_name: body.farmName || body.destination || 'Farm destination',
      destination: body.destination || 'Destine destination',
      full_destination: body.fullDestination || '',
      rate_lookup_key: body.rateLookupKey || '',
      status: body.status || 'Pending',
      estimated_delivery: body.estimatedDelivery || tomorrow.toISOString().split('T')[0],
      driver: body.driver || 'MTM Driver',
      helper: body.helper || '',
      number_of_bags: body.numberOfBags || 1
    };

    const result = await query(`
      INSERT INTO trips (id, tracking_number, date, truck_plate, invoice_number, origin, farm_name, destination, full_destination, rate_lookup_key, status, estimated_delivery, driver, helper, number_of_bags, computed_toll, roundtrip_toll, actual_toll_expense, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      newTrip.id, newTrip.tracking_number, newTrip.date, newTrip.truck_plate, newTrip.invoice_number,
      newTrip.origin, newTrip.farm_name, newTrip.destination, newTrip.full_destination, newTrip.rate_lookup_key,
      newTrip.status, newTrip.estimated_delivery, newTrip.driver, newTrip.helper, newTrip.number_of_bags,
      0, // computed_toll default
      0, // roundtrip_toll default
      0, // actual_toll_expense default
      finalTimestamp, // created_at
      finalTimestamp  // updated_at
    ]);

    console.log('Creating new trip:', newTrip.tracking_number);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip', details: error.message });
  }
});

app.put('/api/trips/:id', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined) {
        // Convert camelCase to snake_case for database columns
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(body[key]);
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

// Employee API endpoints
app.get('/api/employees', async (req, res) => {
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

app.post('/api/employees', jsonParser, async (req, res) => {
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

    console.log('Created new employee:', body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

app.put('/api/employees/:uuid', jsonParser, async (req, res) => {
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

    console.log('Updated employee:', body.name);
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

app.post('/api/deductions', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

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
      INSERT INTO deductions (name, type, value, is_default, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.name,
      body.type,
      parseFloat(body.value),
      body.isDefault || false,
      localTimeString
    ]);

    console.log('Created new deduction:', body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating deduction:', error);
    res.status(500).json({ error: 'Failed to create deduction' });
  }
});

app.put('/api/deductions/:id', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE deductions
      SET name = $1, type = $2, value = $3, is_default = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [
      body.name,
      body.type,
      parseFloat(body.value),
      body.isDefault || false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    console.log('Updated deduction:', body.name);
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

app.post('/api/drivers', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

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
      INSERT INTO drivers (name, phone, license_number, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [body.name, body.phone, body.licenseNumber, localTimeString]);

    console.log('Created new driver:', body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

app.put('/api/drivers/:id', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE drivers
      SET name = $1, phone = $2, license_number = $3
      WHERE id = $4
      RETURNING *
    `, [body.name, body.phone, body.licenseNumber, parseInt(req.params.id)]);

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

app.post('/api/helpers', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

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
      INSERT INTO helpers (name, phone, address, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [body.name, body.phone, body.address, localTimeString]);

    console.log('Created new helper:', body.name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating helper:', error);
    res.status(500).json({ error: 'Failed to create helper' });
  }
});

app.put('/api/helpers/:id', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE helpers
      SET name = $1, phone = $2, address = $3
      WHERE id = $4
      RETURNING *
    `, [body.name, body.phone, body.address, parseInt(req.params.id)]);

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

app.post('/api/payslips', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

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
      JSON.stringify(body)
    ]);

    console.log('Created new payslip:', body.payslipNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payslip:', error);
    res.status(500).json({ error: 'Failed to create payslip', details: error.message });
  }
});

app.put('/api/payslips/:id', jsonParser, async (req, res) => {
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

    console.log('Updated payslip:', body.payslipNumber);
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

app.post('/api/billings', jsonParser, async (req, res) => {
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

    const result = await query(`
      INSERT INTO billings (id, billing_number, period_start, period_end, client_name, client_address, client_tin, trips, totals, prepared_by, payment_status, created_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      body.id || Date.now().toString(),
      body.billingNumber,
      body.period?.startDate,
      body.period?.endDate,
      body.client?.name,
      body.client?.address,
      body.client?.tin,
      JSON.stringify(body.trips || []),
      JSON.stringify(body.totals || {}),
      body.preparedBy,
      body.paymentStatus || 'pending',
      finalTimestamp
    ]);

    console.log('Created new billing:', body.billingNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating billing:', error);
    res.status(500).json({ error: 'Failed to create billing', details: error.message });
  }
});

app.put('/api/billings/:id', async (req, res) => {
  try {
    // Parse JSON body manually to avoid middleware conflicts
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (parseError) {
      // If req.body is already parsed, use it directly
      body = req.body;
    }

    // Transform frontend format to database format
    const billingData = {
      billing_number: body.billingNumber,
      period_start: body.period?.startDate,
      period_end: body.period?.endDate,
      client_name: body.client?.name,
      client_address: body.client?.address,
      client_tin: body.client?.tin,
      trips: body.trips || [],
      totals: body.totals || {},
      prepared_by: body.preparedBy,
      payment_status: body.paymentStatus || 'pending'
    };

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

// Vehicles API endpoints
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json(result.rows);
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
      INSERT INTO vehicles (plate_number, vehicle_class, name, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      req.body.plateNumber || req.body.plate_number,
      req.body.vehicleClass || req.body.vehicle_class,
      req.body.name,
    ]);

    console.log('Created new vehicle:', req.body.plateNumber || req.body.plate_number);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

app.put('/api/vehicles/:id', jsonParser, async (req, res) => {
  try {
    // Body is already parsed by jsonParser middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`
      UPDATE vehicles
      SET plate_number = $1, vehicle_class = $2, name = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [
      body.plateNumber || body.plate_number,
      body.vehicleClass || body.vehicle_class,
      body.name,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    console.log('Updated vehicle:', body.plateNumber || body.plate_number);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
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
    const result = await query('SELECT * FROM expenses ORDER BY created_at DESC');
    res.json(result.rows);
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
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

app.post('/api/expenses', upload.single('receipt'), async (req, res) => {
  try {
    let receiptData = null;
    let receiptFilename = null;
    let receiptOriginalName = null;
    let receiptMimetype = null;
    let receiptSize = null;

    // Handle file upload if present
    if (req.file) {
      receiptData = req.file.buffer;
      receiptFilename = `${Date.now()}_${req.file.originalname}`;
      receiptOriginalName = req.file.originalname;
      receiptMimetype = req.file.mimetype;
      receiptSize = req.file.size;
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
      req.body.vehicle,
      parseFloat(req.body.amount),
      req.body.paymentMethod || req.body.payment_method || 'cash',
      req.body.notes,
      receiptFilename,
      receiptOriginalName,
      receiptMimetype,
      receiptSize,
      receiptData
    ]);

    console.log('Created new expense:', req.body.description);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', jsonParser, async (req, res) => {
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

    console.log('Updated expense:', body.description);
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

// Download expense receipt
app.get('/api/expenses/:id/receipt', async (req, res) => {
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

// Export the serverless handler
module.exports = app;
module.exports.handler = serverless(app);
