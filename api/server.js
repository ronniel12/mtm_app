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
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    let limit, offset;

    // Check if both startDate and endDate are provided and not empty
    if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
      console.log('🔍 DEBUG: Missing startDate or endDate, returning empty array');
      console.log('  startDate:', startDate, 'endDate:', endDate);
      return res.json({
        trips: [],
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Build WHERE clause for date filtering
    let whereClause = 'WHERE date >= $1 AND date <= $2';
    let params = [startDate, endDate];
    let paramCount = 3;

    console.log('🔍 DEBUG: Date filtering parameters:');
    console.log('  startDate:', startDate, 'type:', typeof startDate);
    console.log('  endDate:', endDate, 'type:', typeof endDate);
    console.log('  params:', params);

    // Handle limit
    if (limitParam === 'all') {
      limit = null;
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    // Get total count for pagination metadata (with date filter)
    const countQuery = `SELECT COUNT(*) as total FROM trips ${whereClause}`;
    console.log('🔍 DEBUG: Count query:', countQuery);
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    console.log('🔍 DEBUG: Total count result:', total);

    let result;
    if (limit === null) {
      // Fetch all records without pagination (with date filter)
      const queryStr = `SELECT * FROM trips ${whereClause} ORDER BY created_at DESC`;
      console.log('🔍 DEBUG: Data query (all):', queryStr);
      result = await query(queryStr, params);
    } else {
      // Get paginated results (with date filter)
      const queryStr = `SELECT * FROM trips ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      console.log('🔍 DEBUG: Data query (paginated):', queryStr, 'params:', [...params, limit, offset]);
      result = await query(queryStr, [...params, limit, offset]);
    }

    console.log('🔍 DEBUG: Query result count:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('🔍 DEBUG: First few trip dates:', result.rows.slice(0, 3).map(r => r.date));
    } else {
      console.log('🔍 DEBUG: No trips found in date range');
    }

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
        foodAllowance: trip.food_allowance,
        createdAt: trip.created_at,
        updatedAt: trip.updated_at,
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

// Helper function to parse various date formats and generate date range queries
function parseDateQuery(searchQuery) {
  const query = searchQuery.toLowerCase().trim();

  // Relative date patterns
  if (query === 'today') {
    return { type: 'exact', date: new Date().toISOString().split('T')[0] };
  }

  if (query === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { type: 'exact', date: yesterday.toISOString().split('T')[0] };
  }

  if (query === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { type: 'exact', date: tomorrow.toISOString().split('T')[0] };
  }

  if (query === 'this week') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return {
      type: 'range',
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    };
  }

  if (query === 'last week') {
    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    return {
      type: 'range',
      startDate: lastWeekStart.toISOString().split('T')[0],
      endDate: lastWeekEnd.toISOString().split('T')[0]
    };
  }

  if (query === 'this month') {
    const now = new Date();
    return {
      type: 'range',
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
    };
  }

  if (query === 'last month') {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      type: 'range',
      startDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${lastDayOfLastMonth.getDate()}`
    };
  }

  if (query === 'this year') {
    const now = new Date();
    return {
      type: 'range',
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`
    };
  }

  // Parse various date formats
  const datePatterns = [
    // ISO format: YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // US format: MM/DD/YYYY or M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // European format: DD/MM/YYYY or D/M/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // Dash format: YYYY-MM-DD, DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // Year only: YYYY
    /^(\d{4})$/,
    // Month and year: MM/YYYY
    /^(\d{1,2})\/(\d{4})$/
  ];

  for (let pattern of datePatterns) {
    const match = query.match(pattern);
    if (match) {
      if (pattern.source === '^(\\d{4})$') {
        // Year only
        const year = parseInt(match[1]);
        if (year >= 2010 && year <= 2030) {
          return {
            type: 'range',
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`
          };
        }
      } else if (pattern.source === '^(\\d{1,2})\\/(\\d{4})$') {
        // Month/Year format
        const month = parseInt(match[1]);
        const year = parseInt(match[2]);
        if (month >= 1 && month <= 12 && year >= 2010 && year <= 2030) {
          const lastDay = new Date(year, month, 0).getDate();
          return {
            type: 'range',
            startDate: `${year}-${String(month).padStart(2, '0')}-01`,
            endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`
          };
        }
      } else {
        // Try different date interpretations
        let day, month, year;

        if (match.length === 4 && match[4]) {
          // DD-MM-YYYY format
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[4]);
        } else if (pattern.source.includes('^(\\d{4})')) {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          // Try US format first (MM/DD/YYYY), then European (DD/MM/YYYY)
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          year = parseInt(match[3]);

          if (num1 > 12 && num1 <= 31 && num2 <= 12) {
            // First number > 12, likely DD/MM/YYYY (European)
            day = num1;
            month = num2;
          } else if (num1 <= 12 && num2 <= 31) {
            // Assume US format MM/DD/YYYY first
            month = num1;
            day = num2;
          } else {
            continue; // Invalid date
          }
        }

        if (year >= 2010 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Validate the date is actually valid
          const testDate = new Date(year, month - 1, day);
          if (testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day) {
            return {
              type: 'exact',
              date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            };
          }
        }
      }
    }
  }

  // Parse month names
  const monthNames = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12
  };

  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (query.includes(monthName) || query.includes(monthName.substring(0, 3))) {
      const yearMatch = query.match(/(\d{4})/);
      const dayMatch = query.match(/(\d{1,2})(?:st|nd|rd|th)?\s+/);

      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (dayMatch) {
          // "January 15 2025" or "Jan 15 2025"
          const day = parseInt(dayMatch[1]);
          if (day >= 1 && day <= 31 && year >= 2010 && year <= 2030) {
            const testDate = new Date(year, monthNum - 1, day);
            if (testDate.getDate() === day) {
              return {
                type: 'exact',
                date: `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              };
            }
          }
        } else {
          // Just month and year: "January 2025" or "Jan 2025"
          if (year >= 2010 && year <= 2030) {
            const lastDay = new Date(year, monthNum, 0).getDate();
            return {
              type: 'range',
              startDate: `${year}-${String(monthNum).padStart(2, '0')}-01`,
              endDate: `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`
            };
          }
        }
      }
    }
  }

  return null; // Not a date
}

// Optimized trips endpoint with pre-calculated rates and search
app.get('/api/trips/calculated', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    let limit, offset;

    if (limitParam === 'all') {
      limit = null;
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    // Build search condition if searching
    let searchCondition = '';
    let searchParams = [];
    if (searchQuery) {
      const dateSearch = parseDateQuery(searchQuery);

      if (dateSearch) {
        // Date-specific search
        if (dateSearch.type === 'exact') {
          searchCondition = 'WHERE date = $1';
          searchParams = [dateSearch.date];
        } else if (dateSearch.type === 'range') {
          searchCondition = 'WHERE date >= $1 AND date <= $2';
          searchParams = [dateSearch.startDate, dateSearch.endDate];
        }
      } else {
        // Original text search logic
        searchCondition = `
          LEFT JOIN employees e1 ON trips.driver = e1.uuid
          LEFT JOIN employees e2 ON trips.helper = e2.uuid
          WHERE (
            LOWER(tracking_number) LIKE LOWER($1) OR
            LOWER(invoice_number) LIKE LOWER($1) OR
            LOWER(origin) LIKE LOWER($1) OR
            LOWER(farm_name) LIKE LOWER($1) OR
            LOWER(destination) LIKE LOWER($1) OR
            LOWER(full_destination) LIKE LOWER($1) OR
            LOWER(truck_plate) LIKE LOWER($1) OR
            LOWER(COALESCE(e1.name, '')) LIKE LOWER($1) OR
            LOWER(COALESCE(e2.name, '')) LIKE LOWER($1) OR
            LOWER(status) LIKE LOWER($1)
          )
        `;
        searchParams = [`%${searchQuery}%`];
      }
    }

    // For paginated requests, use separate optimized queries
    if (limit !== null) {
      let tripsQuery, countQuery, tripsParams, countParams;

      // Regular paginated query (with optional search)
      tripsQuery = `SELECT *, date::text as date FROM trips ${searchCondition} ORDER BY trips.date DESC LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}`;
      countQuery = `SELECT COUNT(*) as total FROM trips ${searchCondition}`;
      tripsParams = [...searchParams, limit, offset];
      countParams = searchParams;

    // Get data first (usually faster)
      const tripsResult = await query(tripsQuery, tripsParams);

      // Get fresh count (no caching in serverless environments)
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

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
          createdAt: trip.created_at,
          updatedAt: trip.updated_at,
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

    // For "all" requests, get count and all trips (with optional search)
    const countQuery = `SELECT COUNT(*) as total FROM trips ${searchCondition}`;
    const countResult = await query(countQuery, searchParams);
    const total = parseInt(countResult.rows[0].total);
    const tripsResult = await query(`SELECT * FROM trips ${searchCondition} ORDER BY date DESC`, searchParams);

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
          createdAt: trip.created_at,
          updatedAt: trip.updated_at,
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
      foodAllowance: trip.food_allowance,
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

    // Check if there's already a trip on this date with food allowance
    const tripDate = body.date;
    let foodAllowance = 0;

    if (tripDate) {
      const existingTripResult = await query(
        'SELECT COUNT(*) as count FROM trips WHERE date = $1 AND food_allowance > 0',
        [tripDate]
      );
      const existingCount = parseInt(existingTripResult.rows[0].count);

      // Set food allowance to 450 only if no existing trip on this date has it
      if (existingCount === 0) {
        foodAllowance = 450.00;
      }
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
      date: tripDate || utcNow.toISOString().split('T')[0],
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
      number_of_bags: body.numberOfBags || 1,
      food_allowance: foodAllowance
    };

    const result = await query(`
      INSERT INTO trips (id, tracking_number, date, truck_plate, invoice_number, origin, farm_name, destination, full_destination, rate_lookup_key, status, estimated_delivery, driver, helper, number_of_bags, food_allowance, computed_toll, roundtrip_toll, actual_toll_expense, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      newTrip.id, newTrip.tracking_number, newTrip.date, newTrip.truck_plate, newTrip.invoice_number,
      newTrip.origin, newTrip.farm_name, newTrip.destination, newTrip.full_destination, newTrip.rate_lookup_key,
      newTrip.status, newTrip.estimated_delivery, newTrip.driver, newTrip.helper, newTrip.number_of_bags, newTrip.food_allowance,
      0, // computed_toll default
      0, // roundtrip_toll default
      0, // actual_toll_expense default
      finalTimestamp, // created_at
      finalTimestamp  // updated_at
    ]);

    console.log('Creating new trip:', newTrip.tracking_number, 'Food allowance:', newTrip.food_allowance);
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
      foodAllowance: trip.food_allowance,
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
      INSERT INTO billings (id, billing_number, period_start, period_end, client_name, client_address, client_city, client_zip_code, client_tin, trips, totals, prepared_by, payment_status, created_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      body.id || Date.now().toString(),
      body.billingNumber,
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
      finalTimestamp
    ]);

    console.log('Created new billing:', body.billingNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating billing:', error);
    res.status(500).json({ error: 'Failed to create billing', details: error.message });
  }
});

app.put('/api/billings/:id', jsonParser, async (req, res) => {
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

app.post('/api/vehicles', jsonParser, async (req, res) => {
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

// Rates API endpoints
app.post('/api/rates', jsonParser, async (req, res) => {
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

    console.log('Created new rate:', req.body.origin, req.body.province, req.body.town);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rate:', error);
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

app.put('/api/rates/:origin/:province/:town', jsonParser, async (req, res) => {
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

    console.log('Updated rate:', req.params.origin, req.params.province, req.params.town);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

app.delete('/api/rates/:origin/:province/:town', async (req, res) => {
  try {
    const result = await query('DELETE FROM rates WHERE origin = $1 AND province = $2 AND town = $3 RETURNING *', [
      req.params.origin,
      req.params.province,
      req.params.town
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }
    console.log('Deleted rate:', req.params.origin, req.params.province, req.params.town);
    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate:', error);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// Expenses API endpoints
app.get('/api/expenses', async (req, res) => {
  try {
    const result = await query('SELECT * FROM expenses ORDER BY created_at DESC');

    // Transform dates to ensure they're returned in the user's local timezone
    const transformedExpenses = result.rows.map(expense => ({
      ...expense,
      date: expense.date ? new Date(expense.date).toLocaleDateString('sv-SE') : null // YYYY-MM-DD format
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

    // Fuel API endpoints - fresh implementation
    app.get('/api/fuel', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limitParam = req.query.limit;
        const searchQuery = req.query.search ? req.query.search.trim() : '';
        const plateFilter = req.query.plate_number || '';
        let limit, offset;

        if (limitParam === 'all') {
          limit = null;
          offset = 0;
        } else {
          limit = parseInt(limitParam) || 50;
          offset = (page - 1) * limit;
        }

        // Build search condition if searching
        let searchCondition = '';
        let searchParams = [];
        if (searchQuery) {
          searchCondition = `
            WHERE (
              LOWER(plate_number) LIKE LOWER($1) OR
              LOWER(po_number) LIKE LOWER($1) OR
              LOWER(product) LIKE LOWER($1) OR
              LOWER(gas_station) LIKE LOWER($1) OR
              LOWER(status) LIKE LOWER($1) OR
              LOWER(notes) LIKE LOWER($1) OR
              CAST(liters AS TEXT) LIKE $1 OR
              CAST(price_per_liter AS TEXT) LIKE $1 OR
              CAST(amount AS TEXT) LIKE $1
            )
          `;
          searchParams = [`%${searchQuery}%`];
        }

        // Add plate number filter if specified
        if (plateFilter && !searchQuery) {
          searchCondition = 'WHERE plate_number = $1';
          searchParams = [plateFilter];
        } else if (plateFilter && searchQuery) {
          searchCondition += ' AND plate_number = $' + (searchParams.length + 1);
          searchParams.push(plateFilter);
        }

        // For paginated requests
        if (limit !== null) {
          let fuelQuery, countQuery, fuelParams, countParams;

          fuelQuery = `SELECT *, date::text as date FROM fuel ${searchCondition} ORDER BY fuel.date DESC LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}`;
          countQuery = `SELECT COUNT(*) as total FROM fuel ${searchCondition}`;
          fuelParams = [...searchParams, limit, offset];
          countParams = searchParams;

          const fuelResult = await query(fuelQuery, fuelParams);
          const countResult = await query(countQuery, countParams);
          const total = parseInt(countResult.rows[0].total);

          // Transform database format to frontend expected format
          const transformedFuel = fuelResult.rows.map(fuel => ({
            id: fuel.id,
            date: fuel.date,
            liters: parseFloat(fuel.liters),
            pricePerLiter: parseFloat(fuel.price_per_liter),
            amount: parseFloat(fuel.amount),
            plateNumber: fuel.plate_number,
            poNumber: fuel.po_number,
            product: fuel.product,
            gasStation: fuel.gas_station,
            status: fuel.status,
            notes: fuel.notes,
            createdAt: fuel.created_at,
            updatedAt: fuel.updated_at
          }));

          return res.json({
            fuel: transformedFuel,
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

        // For "all" requests
        const countQuery = `SELECT COUNT(*) as total FROM fuel ${searchCondition}`;
        const countResult = await query(countQuery, searchParams);
        const total = parseInt(countResult.rows[0].total);
        const fuelResult = await query(`SELECT *, date::text as date FROM fuel ${searchCondition} ORDER BY date DESC`, searchParams);

        const transformedFuel = fuelResult.rows.map(fuel => ({
          id: fuel.id,
          date: fuel.date,
          liters: parseFloat(fuel.liters),
          pricePerLiter: parseFloat(fuel.price_per_liter),
          amount: parseFloat(fuel.amount),
          plateNumber: fuel.plate_number,
          poNumber: fuel.po_number,
          product: fuel.product,
          gasStation: fuel.gas_station,
          status: fuel.status,
          notes: fuel.notes,
          createdAt: fuel.created_at,
          updatedAt: fuel.updated_at
        }));

        res.json({
          fuel: transformedFuel,
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
        console.error('Error fetching fuel:', error);
        res.status(500).json({ error: 'Failed to fetch fuel records' });
      }
    });

    app.get('/api/fuel/:id', async (req, res) => {
      try {
        const result = await query('SELECT *, date::text as date FROM fuel WHERE id = $1', [parseInt(req.params.id)]);
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Fuel record not found' });
        }

        const fuel = result.rows[0];
        const transformedFuel = {
          id: fuel.id,
          date: fuel.date,
          liters: parseFloat(fuel.liters),
          pricePerLiter: parseFloat(fuel.price_per_liter),
          amount: parseFloat(fuel.amount),
          plateNumber: fuel.plate_number,
          poNumber: fuel.po_number,
          product: fuel.product,
          gasStation: fuel.gas_station,
          status: fuel.status,
          notes: fuel.notes,
          createdAt: fuel.created_at,
          updatedAt: fuel.updated_at
        };

        res.json(transformedFuel);
      } catch (error) {
        console.error('Error fetching fuel record:', error);
        res.status(500).json({ error: 'Failed to fetch fuel record' });
      }
    });

    app.post('/api/fuel', jsonParser, async (req, res) => {
      try {
        const body = req.body;
        console.log('POST /api/fuel received:', JSON.stringify(body, null, 2));

        // Validate required fields
        if (!body) {
          return res.status(400).json({ error: 'Request body is required' });
        }

        // Validate required fields
        if (!body.date || !body.liters || !body.pricePerLiter) {
          return res.status(400).json({ error: 'Date, liters, and price_per_liter are required' });
        }

        // Calculate amount if not provided (liters * price_per_liter)
        let amount = body.amount;
        if (!amount && body.liters && body.pricePerLiter) {
          amount = parseFloat(body.liters) * parseFloat(body.pricePerLiter);
          console.log('Calculated amount:', amount);
        }

        if (!amount || amount <= 0) {
          return res.status(400).json({ error: 'Amount is required or must be calculable from liters and price_per_liter' });
        }

        console.log('Inserting fuel record with params:', [
          body.date,
          parseFloat(body.liters),
          parseFloat(body.pricePerLiter),
          parseFloat(amount),
          body.plateNumber || null,
          body.poNumber || null,
          body.product || 'Diesel',
          body.gasStation || null,
          body.status || 'completed',
          body.notes || null
        ]);

        const result = await query(`
          INSERT INTO fuel (
            date, liters, price_per_liter, amount, plate_number, po_number,
            product, gas_station, status, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *, date::text as date
        `, [
          body.date,
          parseFloat(body.liters),
          parseFloat(body.pricePerLiter),
          parseFloat(amount),
          body.plateNumber || null,
          body.poNumber || null,
          body.product || 'Diesel',
          body.gasStation || null,
          body.status || 'completed',
          body.notes || null
        ]);

        const fuel = result.rows[0];
        const transformedFuel = {
          id: fuel.id,
          date: fuel.date,
          liters: parseFloat(fuel.liters),
          pricePerLiter: parseFloat(fuel.price_per_liter),
          amount: parseFloat(fuel.amount),
          plateNumber: fuel.plate_number,
          poNumber: fuel.po_number,
          product: fuel.product,
          gasStation: fuel.gas_station,
          status: fuel.status,
          notes: fuel.notes,
          createdAt: fuel.created_at,
          updatedAt: fuel.updated_at
        };

        console.log('Created fuel record:', fuel.id);
        res.status(201).json(transformedFuel);
      } catch (error) {
        console.error('Error creating fuel record:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
          error: 'Failed to create fuel record',
          details: error.message,
          code: error.code
        });
      }
    });

    app.put('/api/fuel/:id', jsonParser, async (req, res) => {
      try {
        const body = req.body;

        // Validate required fields
        if (!body) {
          return res.status(400).json({ error: 'Request body is required' });
        }

        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        // Map frontend format to database format
        const fieldMapping = {
          date: 'date',
          liters: 'liters',
          pricePerLiter: 'price_per_liter',
          amount: 'amount',
          plateNumber: 'plate_number',
          poNumber: 'po_number',
          product: 'product',
          gasStation: 'gas_station',
          status: 'status',
          notes: 'notes'
        };

        Object.keys(fieldMapping).forEach(frontendKey => {
          if (body[frontendKey] !== undefined) {
            updateFields.push(`${fieldMapping[frontendKey]} = $${paramCount}`);
            values.push(body[frontendKey]);
            paramCount++;
          }
        });

        // Auto-recalculate amount when liters or price_per_liter change
        const existingFuel = await query('SELECT liters, price_per_liter FROM fuel WHERE id = $1', [parseInt(req.params.id)]);
        if (existingFuel.rows.length > 0 && updateFields.length > 0) {
          const currentValues = existingFuel.rows[0];
          const newLiters = body.liters !== undefined ? parseFloat(body.liters) : currentValues.liters;
          const newPricePerLiter = body.pricePerLiter !== undefined ? parseFloat(body.pricePerLiter) : currentValues.price_per_liter;

          if (newLiters && newPricePerLiter && body.amount === undefined) {
            const calculatedAmount = newLiters * newPricePerLiter;
            updateFields.push(`amount = $${paramCount}`);
            values.push(calculatedAmount);
            paramCount++;
          }
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(parseInt(req.params.id)); // Add ID at the end

        const result = await query(`
          UPDATE fuel
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount}
          RETURNING *, date::text as date
        `, values);

        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Fuel record not found' });
        }

        const fuel = result.rows[0];
        const transformedFuel = {
          id: fuel.id,
          date: fuel.date,
          liters: parseFloat(fuel.liters),
          pricePerLiter: parseFloat(fuel.price_per_liter),
          amount: parseFloat(fuel.amount),
          plateNumber: fuel.plate_number,
          poNumber: fuel.po_number,
          product: fuel.product,
          gasStation: fuel.gas_station,
          status: fuel.status,
          notes: fuel.notes,
          createdAt: fuel.created_at,
          updatedAt: fuel.updated_at
        };

        console.log('Updated fuel record:', fuel.id);
        res.json(transformedFuel);
      } catch (error) {
        console.error('Error updating fuel record:', error);
        res.status(500).json({ error: 'Failed to update fuel record' });
      }
    });

    app.delete('/api/fuel/:id', async (req, res) => {
      try {
        const result = await query('DELETE FROM fuel WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Fuel record not found' });
        }

        console.log('Deleted fuel record:', result.rows[0].id);
        res.json({ message: 'Fuel record deleted successfully' });
      } catch (error) {
        console.error('Error deleting fuel record:', error);
        res.status(500).json({ error: 'Failed to delete fuel record' });
      }
    });

    // Bulk fuel insert endpoint for efficient large imports
    app.post('/api/fuel/bulk', jsonParser, async (req, res) => {
      try {
        const body = req.body;

        if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
          return res.status(400).json({ error: 'Request body must contain a non-empty entries array' });
        }

        console.log(`🚀 Starting bulk fuel import: ${body.entries.length} entries`);

        const results = {
          total: body.entries.length,
          inserted: 0,
          failed: 0,
          errors: [],
          insertedIds: []
        };

        // Process entries in batches to avoid database timeout issues
        const BATCH_SIZE = 50; // Process in reasonable chunks
        const batches = [];

        for (let i = 0; i < body.entries.length; i += BATCH_SIZE) {
          batches.push(body.entries.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
          console.log(`📦 Processing batch of ${batch.length} entries...`);

          // Prepare batch insert query
          const values = [];
          const placeholders = [];
          let paramIndex = 1;
          const validEntries = [];

          for (const entry of batch) {
            try {
              // Validate required fields
              if (!entry.date || !entry.liters || !entry.pricePerLiter) {
                results.errors.push({
                  rowData: JSON.stringify(entry),
                  error: 'Missing required fields: date, liters, and pricePerLiter'
                });
                results.failed++;
                continue;
              }

              // Calculate amount if not provided
              let amount = parseFloat(entry.amount || 0);
              if (!amount || amount <= 0) {
                const liters = parseFloat(entry.liters);
                const price = parseFloat(entry.pricePerLiter);
                if (liters > 0 && price > 0) {
                  amount = liters * price;
                } else {
                  results.errors.push({
                    rowData: JSON.stringify(entry),
                    error: 'Cannot calculate amount: invalid liters or price_per_liter'
                  });
                  results.failed++;
                  continue;
                }
              }

              // Parse date safely (similar to single insert)
              if (entry.date) {
                const dateStr = entry.date.trim();

                // Check if already YYYY-MM-DD format - leave alone
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                  // Format: MM/DD/YYYY or DD/MM/YYYY
                  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                  if (slashMatch) {
                    const year = parseInt(slashMatch[3]);
                    const month = parseInt(slashMatch[2]); // DD/MM/YYYY preferred
                    const day = parseInt(slashMatch[1]);

                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2050) {
                      entry.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    }
                  }

                  // Format: "Sep 4, 25"
                  const alphaMatch = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*,\s*|\s+)(\d{4}|\d{2})$/);
                  if (alphaMatch && !entry.date.includes('-')) {
                    const monthName = alphaMatch[1].toLowerCase();
                    const day = parseInt(alphaMatch[2]);
                    const yearStr = alphaMatch[3];

                    let year = parseInt(yearStr);
                    if (year < 100) {
                      year = year >= 60 ? year + 1900 : year + 2000;
                    }

                    const monthMap = {
                      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
                    };

                    const month = monthMap[monthName.substring(0, 3).toLowerCase()];
                    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2050) {
                      entry.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    }
                  }
                }
              }

              // Add to valid entries array
              validEntries.push({
                date: entry.date,
                liters: parseFloat(entry.liters),
                pricePerLiter: parseFloat(entry.pricePerLiter),
                amount: parseFloat(amount),
                plateNumber: entry.plateNumber || null,
                poNumber: entry.poNumber || null,
                product: entry.product || 'Diesel',
                gasStation: entry.gasStation || null,
                notes: entry.notes || null
              });

              // Build placeholders and values for batch insert
              placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8})`);
              values.push(validEntries[validEntries.length - 1].date);
              values.push(validEntries[validEntries.length - 1].liters);
              values.push(validEntries[validEntries.length - 1].pricePerLiter);
              values.push(validEntries[validEntries.length - 1].amount);
              values.push(validEntries[validEntries.length - 1].plateNumber);
              values.push(validEntries[validEntries.length - 1].poNumber);
              values.push(validEntries[validEntries.length - 1].product);
              values.push(validEntries[validEntries.length - 1].gasStation);
              values.push(validEntries[validEntries.length - 1].notes);
              paramIndex += 9;

            } catch (entryError) {
              console.error('Error processing entry:', entry, entryError);
              results.errors.push({
                rowData: JSON.stringify(entry),
                error: entryError.message || 'Processing error'
              });
              results.failed++;
            }
          }

          // Execute batch insert if there are valid entries
          if (validEntries.length > 0) {
            try {
              const queryStr = `
                INSERT INTO fuel (date, liters, price_per_liter, amount, plate_number, po_number, product, gas_station, notes)
                VALUES ${placeholders.join(', ')}
                RETURNING id
              `;

              console.log(`🎯 Executing batch insert: ${validEntries.length} entries`);
              const batchResult = await query(queryStr, values);

              results.inserted += validEntries.length;
              results.insertedIds.push(...batchResult.rows.map(row => row.id));

              console.log(`✅ Batch inserted ${validEntries.length} entries, IDs:`, batchResult.rows.map(r => r.id).join(', '));

            } catch (batchError) {
              console.error('Batch insert error:', batchError);
              results.failed += validEntries.length;
              results.errors.push({
                batch: `${validEntries.length} entries`,
                error: `Batch insert failed: ${batchError.message}`
              });
            }
          }
        }

        console.log(`🎉 Bulk fuel import completed: ${results.inserted}/${results.total} inserted, ${results.failed} failed`);

        res.json({
          message: `Successfully imported ${results.inserted}/${results.total} fuel entries`,
          inserted: results.inserted,
          failed: results.failed,
          errors: results.errors.slice(0, 10), // Limit error output
          insertedIds: results.insertedIds
        });

      } catch (error) {
        console.error('Error in bulk fuel import:', error);
        res.status(500).json({
          error: 'Bulk fuel import failed',
          details: error.message
        });
      }
    });



    // ============================================================================
    // MAINTENANCE SYSTEM API ENDPOINTS
    // ============================================================================

// Maintenance Schedules API endpoints
app.get('/api/maintenance/schedules', async (req, res) => {
  try {
    const { vehicle_id, status, category } = req.query;
    let queryStr = 'SELECT * FROM maintenance_schedules WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (status) {
      queryStr += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (category) {
      queryStr += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    queryStr += ' ORDER BY next_due_date ASC, created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
  }
});

app.get('/api/maintenance/schedules/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM maintenance_schedules WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedule' });
  }
});

app.post('/api/maintenance/schedules', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    // Calculate next due date based on schedule type
    let nextDueDate = null;
    let nextDueMileage = null;

    if (body.scheduleType === 'time_based') {
      const now = new Date();
      if (body.frequencyUnit === 'days') {
        nextDueDate = new Date(now.getTime() + (body.frequencyValue * 24 * 60 * 60 * 1000));
      } else if (body.frequencyUnit === 'weeks') {
        nextDueDate = new Date(now.getTime() + (body.frequencyValue * 7 * 24 * 60 * 60 * 1000));
      } else if (body.frequencyUnit === 'months') {
        nextDueDate = new Date(now.getFullYear(), now.getMonth() + body.frequencyValue, now.getDate());
      } else if (body.frequencyUnit === 'years') {
        nextDueDate = new Date(now.getFullYear() + body.frequencyValue, now.getMonth(), now.getDate());
      }
    }

    const result = await query(`
      INSERT INTO maintenance_schedules (
        vehicle_id, maintenance_type, category, schedule_type, frequency_value, frequency_unit,
        reminder_days, last_completed_date, last_mileage_serviced, next_due_date, next_due_mileage, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      body.vehicleId,
      body.maintenanceType,
      body.category,
      body.scheduleType,
      body.frequencyValue,
      body.frequencyUnit,
      body.reminderDays || 7,
      body.lastCompletedDate,
      body.lastMileageServiced,
      nextDueDate?.toISOString().split('T')[0],
      nextDueMileage,
      body.status || 'active',
      body.notes
    ]);

    console.log('Created maintenance schedule:', body.maintenanceType);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to create maintenance schedule' });
  }
});

app.put('/api/maintenance/schedules/:id', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    // Build dynamic update query - only update fields that are provided
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

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(parseInt(req.params.id)); // Add ID at the end

    const result = await query(`
      UPDATE maintenance_schedules
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }

    console.log('Updated maintenance schedule:', result.rows[0].maintenance_type);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to update maintenance schedule' });
  }
});

app.delete('/api/maintenance/schedules/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM maintenance_schedules WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    console.log('Deleted maintenance schedule:', result.rows[0].maintenance_type);
    res.json({ message: 'Maintenance schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to delete maintenance schedule' });
  }
});

// Vehicle Documents API endpoints
app.get('/api/maintenance/documents', async (req, res) => {
  try {
    const { vehicle_id, document_type } = req.query;
    let queryStr = 'SELECT * FROM vehicle_documents WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (document_type) {
      queryStr += ` AND document_type = $${paramCount}`;
      params.push(document_type);
      paramCount++;
    }

    queryStr += ' ORDER BY expiry_date ASC, created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicle documents:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle documents' });
  }
});

app.get('/api/maintenance/documents/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicle_documents WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle document:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle document' });
  }
});

app.post('/api/maintenance/documents', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO vehicle_documents (
        vehicle_id, document_type, document_number, issue_date, expiry_date,
        issuing_authority, cost, document_file_path, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.vehicleId,
      body.documentType,
      body.documentNumber,
      body.issueDate,
      body.expiryDate,
      body.issuingAuthority,
      body.cost ? parseFloat(body.cost) : null,
      body.documentFilePath,
      body.notes
    ]);

    console.log('Created vehicle document:', body.documentType);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle document:', error);
    res.status(500).json({ error: 'Failed to create vehicle document' });
  }
});

app.put('/api/maintenance/documents/:id', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE vehicle_documents
      SET vehicle_id = $1, document_type = $2, document_number = $3, issue_date = $4,
          expiry_date = $5, issuing_authority = $6, cost = $7, document_file_path = $8,
          notes = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      body.vehicleId,
      body.documentType,
      body.documentNumber,
      body.issueDate,
      body.expiryDate,
      body.issuingAuthority,
      body.cost ? parseFloat(body.cost) : null,
      body.documentFilePath,
      body.notes,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }

    console.log('Updated vehicle document:', body.documentType);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle document:', error);
    res.status(500).json({ error: 'Failed to update vehicle document' });
  }
});

app.delete('/api/maintenance/documents/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM vehicle_documents WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle document not found' });
    }
    console.log('Deleted vehicle document:', result.rows[0].document_type);
    res.json({ message: 'Vehicle document deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle document:', error);
    res.status(500).json({ error: 'Failed to delete vehicle document' });
  }
});

// Notification Preferences API endpoints
app.get('/api/maintenance/notifications/preferences', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notification_preferences WHERE is_active = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

app.post('/api/maintenance/notifications/preferences', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO notification_preferences (
        user_id, maintenance_type, reminder_days, notification_methods, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.userId,
      body.maintenanceType,
      body.reminderDays || 7,
      JSON.stringify(body.notificationMethods || ['in_app']),
      body.isActive !== false
    ]);

    console.log('Created notification preference:', body.maintenanceType);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification preference:', error);
    res.status(500).json({ error: 'Failed to create notification preference' });
  }
});

app.put('/api/maintenance/notifications/preferences/:id', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE notification_preferences
      SET user_id = $1, maintenance_type = $2, reminder_days = $3,
          notification_methods = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      body.userId,
      body.maintenanceType,
      body.reminderDays || 7,
      JSON.stringify(body.notificationMethods || ['in_app']),
      body.isActive !== false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification preference not found' });
    }

    console.log('Updated notification preference:', body.maintenanceType);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating notification preference:', error);
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

// Notification History API endpoints
app.get('/api/maintenance/notifications/history', async (req, res) => {
  try {
    const { vehicle_id, status, limit = 50 } = req.query;
    let queryStr = 'SELECT * FROM notification_history WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vehicle_id) {
      queryStr += ` AND vehicle_id = $${paramCount}`;
      params.push(parseInt(vehicle_id));
      paramCount++;
    }

    if (status) {
      queryStr += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    queryStr += ` ORDER BY sent_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// User Contacts API endpoints
app.get('/api/maintenance/contacts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM user_contacts WHERE verified = true ORDER BY is_primary DESC, created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user contacts:', error);
    res.status(500).json({ error: 'Failed to fetch user contacts' });
  }
});

app.post('/api/maintenance/contacts', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      INSERT INTO user_contacts (
        user_id, contact_type, contact_value, is_primary, verified, verification_code
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      body.userId,
      body.contactType,
      body.contactValue,
      body.isPrimary || false,
      body.verified || false,
      body.verificationCode || Math.random().toString(36).substring(2, 8).toUpperCase()
    ]);

    console.log('Created user contact:', body.contactType);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user contact:', error);
    res.status(500).json({ error: 'Failed to create user contact' });
  }
});

app.put('/api/maintenance/contacts/:id', jsonParser, async (req, res) => {
  try {
    const body = req.body;

    const result = await query(`
      UPDATE user_contacts
      SET user_id = $1, contact_type = $2, contact_value = $3, is_primary = $4,
          verified = $5, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      body.userId,
      body.contactType,
      body.contactValue,
      body.isPrimary || false,
      body.verified || false,
      parseInt(req.params.id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User contact not found' });
    }

    console.log('Updated user contact:', body.contactType);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user contact:', error);
    res.status(500).json({ error: 'Failed to update user contact' });
  }
});

// Maintenance Dashboard API endpoint
app.get('/api/maintenance/dashboard', async (req, res) => {
  try {
    // Get maintenance statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_schedules,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_schedules,
        COUNT(CASE WHEN next_due_date <= CURRENT_DATE + INTERVAL '7 days' AND status = 'active' THEN 1 END) as due_soon,
        COUNT(CASE WHEN next_due_date < CURRENT_DATE AND status = 'active' THEN 1 END) as overdue,
        COUNT(CASE WHEN last_completed_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as completed_this_month
      FROM maintenance_schedules
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Get upcoming maintenance (next 30 days)
    const upcomingQuery = `
      SELECT ms.*, v.plate_number, v.name as vehicle_name
      FROM maintenance_schedules ms
      JOIN vehicles v ON ms.vehicle_id = v.id
      WHERE ms.status = 'active'
        AND ms.next_due_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY ms.next_due_date ASC
      LIMIT 10
    `;

    const upcomingResult = await query(upcomingQuery);

    // Get expiring documents (next 30 days)
    const expiringQuery = `
      SELECT vd.*, v.plate_number, v.name as vehicle_name
      FROM vehicle_documents vd
      JOIN vehicles v ON vd.vehicle_id = v.id
      WHERE vd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY vd.expiry_date ASC
      LIMIT 10
    `;

    const expiringResult = await query(expiringQuery);

    res.json({
      stats: {
        totalSchedules: parseInt(stats.total_schedules),
        activeSchedules: parseInt(stats.active_schedules),
        dueSoon: parseInt(stats.due_soon),
        overdue: parseInt(stats.overdue),
        completedThisMonth: parseInt(stats.completed_this_month)
      },
      upcomingMaintenance: upcomingResult.rows,
      expiringDocuments: expiringResult.rows
    });
  } catch (error) {
    console.error('Error fetching maintenance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance dashboard' });
  }
});

// ============================================================================
// Export the serverless handler
module.exports = app;
module.exports.handler = serverless(app);
