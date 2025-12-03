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

// NOTE: Remove global JSON body parsing for Vercel serverless compatibility
// Body parsing will be handled per-endpoint as needed
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.post('/api/trips', async (req, res) => {
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

app.put('/api/trips/:id', async (req, res) => {
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

app.post('/api/employees', async (req, res) => {
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

app.put('/api/employees/:uuid', async (req, res) => {
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

// Employee PIN management endpoints
app.put('/api/employees/:uuid/pin', async (req, res) => {
  try {
    const { pin } = req.body;

    // Validate 4-digit PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Check if PIN is already used by another employee
    const existingResult = await query('SELECT uuid FROM employees WHERE access_pin = $1 AND uuid != $2', [pin, req.params.uuid]);
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'This PIN is already in use by another employee' });
    }

    const result = await query(`
      UPDATE employees
      SET access_pin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $2
      RETURNING *
    `, [pin, req.params.uuid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Clear employees cache
    cache.del('employees:all');

    console.log('Updated employee PIN for:', result.rows[0].name);
    res.json({ message: 'PIN updated successfully', employee: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee PIN:', error);
    res.status(500).json({ error: 'Failed to update employee PIN' });
  }
});

// Employee payslips access via PIN
app.get('/api/employee/:pin/payslips', async (req, res) => {
  try {
    const { pin } = req.params;

    // Validate PIN format
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Find employee by PIN
    const employeeResult = await query('SELECT * FROM employees WHERE access_pin = $1', [pin]);
    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or invalid PIN' });
    }

    const employee = employeeResult.rows[0];

    // Get all payslips for this employee with period data
    const payslipsResult = await query(`
      SELECT *, period_start::text as period_start, period_end::text as period_end FROM payslips
      WHERE employee_uuid = $1
      ORDER BY created_date DESC
    `, [employee.uuid]);

    // Process payslips with Blob URLs if available
    const processedPayslips = payslipsResult.rows.map(payslip => {
      let details = {};
      try {
        // JSONB is already parsed by pg, so use directly
        details = payslip.details || {};
      } catch (parseError) {
        console.warn(`Failed to parse payslip details for ${payslip.id}:`, parseError.message);
        details = {};
      }

      // Build comprehensive deductions array including employee-specific deductions
      let comprehensiveDeductions = details.deductions ? [...details.deductions] : [];

      // Add employee-specific deductions if not already included
      // Cash Advance (if auto-deduct is enabled and amount > 0)
      if (employee.cash_advance && employee.cash_advance > 0 && employee.auto_deduct_cash_advance) {
        const cashAdvanceDeduction = {
          name: 'Cash Advance',
          type: 'employee',
          calculatedAmount: parseFloat(employee.cash_advance),
          isEmployeeSpecific: true
        };
        comprehensiveDeductions.push(cashAdvanceDeduction);
      }

      // Loans (if auto-deduct is enabled and amount > 0)
      if (employee.loans && employee.loans > 0 && employee.auto_deduct_loans) {
        const loanDeduction = {
          name: 'Loans',
          type: 'employee',
          calculatedAmount: parseFloat(employee.loans),
          isEmployeeSpecific: true
        };
        comprehensiveDeductions.push(loanDeduction);
      }

      // Recalculate total deductions from comprehensive list
      const totalCalculatedDeductions = comprehensiveDeductions.reduce((sum, deduction) =>
        sum + (parseFloat(deduction.calculatedAmount) || 0), 0
      );
      const recalculatedNetPay = (parseFloat(payslip.gross_pay) || 0) - totalCalculatedDeductions;

      // Format period properly for display with database fallback
      let formattedPeriod = 'N/A';

      // First try to use period from details JSON if available
      if (details.period && details.period.periodText) {
        formattedPeriod = details.period.periodText;
      }
      else if (details.period && details.period.startDate && details.period.endDate) {
        const start = new Date(details.period.startDate).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const end = new Date(details.period.endDate).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        formattedPeriod = `${start} to ${end}`;
      }
      else if (typeof details.period === 'string') {
        formattedPeriod = details.period;
      }
      // Fall back to database period_start/period_end fields
      else if (payslip.period_start && payslip.period_end) {
        const start = new Date(payslip.period_start).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const end = new Date(payslip.period_end).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        formattedPeriod = `${start} to ${end}`;
      }

      return {
        id: payslip.id,
        payslipNumber: payslip.payslip_number,
        employeeName: employee.name,
        period: formattedPeriod,
        grossPay: payslip.gross_pay,
        deductions: comprehensiveDeductions,
        totalDeductions: totalCalculatedDeductions,
        netPay: Math.max(0, recalculatedNetPay), // Ensure net pay can't be negative
        createdDate: payslip.created_date,
        status: payslip.status,
        blobUrl: details.blobUrl || null, // Add Blob URL directly to top level
        // Include trip summary and other details for employee view
        trips: details.trips || [],
        totals: details.totals || {}
      };
    });

    res.json({
      employee: {
        name: employee.name,
        id: employee.uuid
      },
      payslips: processedPayslips
    });
  } catch (error) {
    console.error('Error fetching employee payslips:', error);
    res.status(500).json({ error: 'Failed to fetch payslips' });
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

// Helper function to parse deduction IDs that may be custom (e.g., "custom-123456789") or numeric
function parseDeductionId(idParam) {
  // Handle custom IDs like "custom-1764607349817"
  if (typeof idParam === 'string' && idParam.startsWith('custom-')) {
    const timestamp = idParam.substring(7); // Remove "custom-" prefix
    const parsedTimestamp = parseInt(timestamp);
    if (!isNaN(parsedTimestamp)) {
      // For custom IDs, we can't directly match a numeric ID, so we'll return the original
      // This is mainly for error handling purposes
      return { type: 'custom', value: idParam, timestamp: parsedTimestamp };
    }
  }

  // Handle regular numeric IDs
  if (!isNaN(parseInt(idParam))) {
    return { type: 'numeric', value: parseInt(idParam) };
  }

  // If neither, return string value for lookup
  return { type: 'string', value: idParam };
}

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
    console.log('🔍 POST /api/deductions - Request body:', JSON.stringify(req.body, null, 2));

    // Body is already parsed by global JSON middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      console.log('❌ POST /api/deductions - Request body is empty');
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

app.put('/api/deductions/:id', async (req, res) => {
  try {
    console.log('🔍 PUT /api/deductions - Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 PUT /api/deductions - ID:', req.params.id);

    // Body is already parsed by global JSON middleware
    const body = req.body;

    // Validate required fields
    if (!body) {
      console.log('❌ PUT /api/deductions - Request body is empty');
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Parse the deduction ID - handles both custom IDs and numeric IDs
    const idInfo = parseDeductionId(req.params.id);

    // Build query parameters based on ID type
    let querySql, queryParams;

    if (idInfo.type === 'numeric') {
      // Standard update by numeric ID
      querySql = `
        UPDATE deductions
        SET name = $2, type = $3, value = $4, is_default = $5::boolean, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      queryParams = [
        idInfo.value,                    // $1: ID
        body.name,                       // $2: name
        body.type,                       // $3: type
        parseFloat(body.value),          // $4: value
        !!body.isDefault                 // $5: is_default (boolean)
      ];

      console.log('📝 Standard numeric ID update - Params:', {
        id: idInfo.value,
        name: body.name,
        type: body.type,
        value: parseFloat(body.value),
        isDefault: !!body.isDefault
      });

    } else if (idInfo.type === 'custom') {
      // Custom ID fallback - update by name (frontend may not have database ID yet)
      querySql = `
        UPDATE deductions
        SET name = $2, type = $3, value = $4, is_default = $5::boolean, updated_at = CURRENT_TIMESTAMP
        WHERE name = $1
        RETURNING *
      `;
      queryParams = [
        body.name,                       // $1: name for WHERE clause
        body.name,                       // $2: name value (no-op)
        body.type,                       // $3: type
        parseFloat(body.value),          // $4: value
        !!body.isDefault                 // $5: is_default (boolean)
      ];

      console.log('⚠️ Custom ID detected, updating by name:', {
        customId: idInfo.value,
        lookupName: body.name,
        updateName: body.name,
        type: body.type,
        value: parseFloat(body.value),
        isDefault: !!body.isDefault
      });

    } else {
      // Invalid ID format
      console.log('❌ Invalid ID format detected');
      return res.status(400).json({
        error: 'Invalid deduction ID format',
        message: 'Please refresh the page and try again'
      });
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      console.log('❌ PUT /api/deductions - No deduction found with given criteria');
      return res.status(404).json({ message: 'Deduction not found' });
    }

    console.log('✅ Updated deduction successfully:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating deduction:', error);
    res.status(500).json({ error: 'Failed to update deduction' });
  }
});

app.delete('/api/deductions/:id', async (req, res) => {
  try {
    console.log('🗑️ DELETE /api/deductions - ID parameter:', req.params.id);

    // Parse the deduction ID - handles both custom IDs and numeric IDs
    const idInfo = parseDeductionId(req.params.id);

    console.log('🔍 Parsed ID info:', {
      originalParam: req.params.id,
      parsedType: idInfo.type,
      parsedValue: idInfo.value,
      parsedValueType: typeof idInfo.value
    });

    let querySql, queryParams;
    let identifier = idInfo.value;

    if (idInfo.type === 'numeric') {
      // Execute DELETE for numeric IDs
      console.log('📝 DELETE /api/deductions - Executing delete for numeric ID:', idInfo.value);
      querySql = 'DELETE FROM deductions WHERE id = $1 RETURNING *';
      queryParams = [idInfo.value];
    } else if (idInfo.type === 'custom') {
      // For custom IDs, we can try to find by creating timestamp if needed
      // Extract timestamp from custom ID for potential fallback lookup
      const timestamp = idInfo.timestamp;
      if (timestamp) {
        // Try to find by name if recent creation (within last 5 minutes)
        const searchTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
        console.log('🔍 DELETE /api/deductions - Attempting fallback deletion for custom ID:', idInfo.value);

        // Get the deduction list and try to find a matching one (simple fallback)
        const deductionList = await query('SELECT * FROM deductions ORDER BY created_at DESC LIMIT 10');

        // If there's only one deduction, or find the first one that might match, delete it
        // This is a fallback for frontend issues - not ideal but pragmatic
        for (const deduction of deductionList.rows) {
          if (deduction.created_at) {
            const createdTime = new Date(deduction.created_at).getTime();
            if (createdTime >= searchTime.getTime() - 10000 && createdTime <= timestamp + 10000) { // Within 10 seconds
              console.log('⚠️ DELETE /api/deductions - Fallback delete by ID for recent deduction:', deduction.id);
              querySql = 'DELETE FROM deductions WHERE id = $1 RETURNING *';
              queryParams = [deduction.id];
              identifier = `fallback:${deduction.id}`;
              break;
            }
          }
        }

        if (!querySql) {
          console.log('❌ DELETE /api/deductions - Could not resolve custom ID for deletion:', idInfo.value);
          return res.status(400).json({
            message: 'Could not resolve deduction ID for deletion. Please refresh the page and try again.',
            hint: 'Custom frontend IDs cannot be reliably used for deletion. Use the database ID instead.'
          });
        }
      } else {
        console.log('❌ DELETE /api/deductions - Invalid custom ID format:', idInfo.value);
        return res.status(400).json({
          message: 'Invalid custom ID format for deletion'
        });
      }
    } else {
      // Fallback for invalid ID format
      console.log('❌ DELETE /api/deductions - Unknown ID format:', idInfo);
      return res.status(400).json({
        message: 'Invalid ID format for deletion'
      });
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      console.log('❌ DELETE /api/deductions - No deduction found with identifier:', identifier);
      return res.status(404).json({ message: 'Deduction not found' });
    }

    console.log('✅ DELETE /api/deductions - Successfully deleted deduction:', result.rows[0].name);
    res.json({ message: 'Deduction deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting deduction:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 200) // Limit stack trace
    });

    res.status(500).json({
      error: 'Failed to delete deduction',
      details: error.message
    });
  }
});

app.get('/api/employee-deduction-configs', async (req, res) => {
  try {
    const { employee_uuid, deduction_id } = req.query;
    let queryStr = 'SELECT * FROM employee_deduction_configs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (employee_uuid) {
      queryStr += ` AND employee_uuid = $${paramCount}`;
      params.push(employee_uuid);
      paramCount++;
    }

    if (deduction_id) {
      queryStr += ` AND deduction_id = $${paramCount}`;
      params.push(parseInt(deduction_id));
      paramCount++;
    }

    queryStr += ' ORDER BY created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employee deduction configs:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction configs' });
  }
});

app.get('/api/employee-deduction-configs/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM employee_deduction_configs WHERE employee_uuid = $1 AND deduction_id = $2',
      [req.params.employee_uuid, parseInt(req.params.deduction_id)]
    );

    if (result.rows.length === 0) {
      return res.json({ apply_mode: 'never', date_config: null });
    }

    const config = result.rows[0];
    // Parse JSON date_config if exists
    if (config.date_config) {
      try {
        config.date_config = JSON.parse(config.date_config);
      } catch (e) {
        config.date_config = null;
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching employee deduction config:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction config' });
  }
});

app.post('/api/employee-deduction-configs', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body || !body.employee_uuid || !body.deduction_id) {
      return res.status(400).json({ error: 'employee_uuid and deduction_id are required' });
    }

    const result = await query(`INSERT INTO employee_deduction_configs
      (employee_uuid, deduction_id, apply_mode, date_config)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_uuid, deduction_id)
      DO UPDATE SET
        apply_mode = EXCLUDED.apply_mode,
        date_config = EXCLUDED.date_config,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`, [
      body.employee_uuid,
      parseInt(body.deduction_id),
      body.apply_mode || 'never',
      body.date_config ? JSON.stringify(body.date_config) : null
    ]);

    const config = result.rows[0];
    //  is already is alreadyspaesdd by bg library ap JSONB library as JSONB
    // No additional parsing needed

    console.log('Created/Updated employee deduction config:', body.employee_uuid, 'deduction:', body.deduction_id);
    res.status(201).json(config);
  } catch (error) {
    console.error('Error creating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to create employee deduction config' });
  }
});

app.put('/api/employee-deduction-configs/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const result = await query(`UPDATE employee_deduction_configs
      SET apply_mode = $1, date_config = $2, updated_at = CURRENT_TIMESTAMP
      WHERE employee_uuid = $3 AND deduction_id = $4
      RETURNING *`, [
      body.apply_mode || 'never',
      body.date_config ? JSON.stringify(body.date_config) : null,
      req.params.employee_uuid,
      parseInt(req.params.deduction_id)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }

    const config = result.rows[0];
    // Parse JSON date_config for response
    if (config.date_config) {
      try {
        config.date_config = JSON.parse(config.date_config);
      } catch (e) {
        config.date_config = null;
      }
    }

    console.log('Updated employee deduction config:', req.params.employee_uuid, 'deduction:', req.params.deduction_id);
    res.json(config);
  } catch (error) {
    console.error('Error updating employee deduction config:', error);
    res.status(500).json({ error: 'Failed to update employee deduction config' });
  }
});

app.delete('/api/employee-deduction-configs/:employee_uuid/:deduction_id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM employee_deduction_configs WHERE employee_uuid = $1 AND deduction_id = $2 RETURNING *',
      [req.params.employee_uuid, parseInt(req.params.deduction_id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Employee deduction config not found' });
    }
    console.log('Deleted employee deduction config for employee:', req.params.employee_uuid, 'deduction:', req.params.deduction_id);
    res.json({ message: 'Employee deduction config deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee deduction config:', error);
    res.status(500).json({ error: 'Failed to delete employee deduction config' });
  }
});

// Helper endpoint to get matrix data for UI (employees × deductions with configs)
app.get('/api/employee-deduction-configs/matrix', async (req, res) => {
  try {
    // Get all employees - sort by name for consistent ordering
    const employeesResult = await query('SELECT uuid, name FROM employees ORDER BY name');

    // Get all deductions - sort by ID for consistent ordering and to match UI expectations
    const deductionsResult = await query('SELECT id, name, type, value FROM deductions ORDER BY id ASC');

    // Get all configs
    const configsResult = await query('SELECT * FROM employee_deduction_configs');

    // Build matrix structure with guaranteed sorting
    const employees = employeesResult.rows;
    const deductions = deductionsResult.rows;
    const configs = configsResult.rows;

    // Debug: log deductions for troubleshooting
    console.log('Matrix deductions (ID order):', deductions.map(d => `${d.id}:${d.name}`));

    // Create config lookup map for quick access
    const configMap = new Map();
    configs.forEach(config => {
      // Ensure deduction_id is parsed as number for consistency
      const key = `${config.employee_uuid}-${parseInt(config.deduction_id)}`;
      configMap.set(key, config);
    });

    // Build matrix with explicit deduction ID mapping
    const matrix = employees.map(employee => ({
      employee: employee,
      configs: deductions.map(deduction => ({
        deduction: deduction,
        config: configMap.get(`${employee.uuid}-${deduction.id}`) || {
          apply_mode: 'never',
          date_config: null
        }
      }))
    }));

    res.json({
      employees: employees,
      deductions: deductions, // This is used for table headers in UI
      matrix: matrix // This contains configs for each cell
    });
  } catch (error) {
    console.error('Error fetching employee deduction matrix:', error);
    res.status(500).json({ error: 'Failed to fetch employee deduction matrix' });
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

app.put('/api/drivers/:id', async (req, res) => {
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

app.post('/api/helpers', async (req, res) => {
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

app.put('/api/helpers/:id', async (req, res) => {
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

// PDF download endpoint for payslips
app.get('/api/payslips/:id/download', async (req, res) => {
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

app.post('/api/payslips', async (req, res) => {
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
      console.log('📄 Generating PDF synchronously for payslip:', body.payslipNumber);
      pdfResult = await PDFService.generateAndUploadPDF(body);
      console.log('✅ PDF generated:', pdfResult.pdfGenerated ? pdfResult.blobUrl : 'Failed');
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

    console.log('Created new payslip:', body.payslipNumber);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payslip:', error);
    res.status(500).json({ error: 'Failed to create payslip', details: error.message });
  }
});

app.put('/api/payslips/:id', async (req, res) => {
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

// Generate PDF for employee payslips on-demand
app.post('/api/payslips/generate-pdf', async (req, res) => {
  try {
    const payslipData = req.body;

    console.log('📥 Received payslip data for PDF generation:', {
      hasData: !!payslipData,
      payslipNumber: payslipData?.payslipNumber,
      keys: payslipData ? Object.keys(payslipData) : [],
      sampleFields: payslipData ? {
        employeeName: payslipData.employeeName,
        period: payslipData.period,
        grossPay: payslipData.grossPay
      } : null
    });

    if (!payslipData || !payslipData.payslipNumber) {
      console.log('❌ Validation failed - missing payslipData or payslipNumber');
      return res.status(400).json({
        error: 'Invalid payslip data provided',
        received: {
          hasData: !!payslipData,
          payslipNumber: payslipData?.payslipNumber
        }
      });
    }

    console.log('🔧 Generating PDF for employee payslip:', payslipData.payslipNumber);

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

    console.log('📄 PDF buffer type:', typeof pdfBuffer, 'size:', pdfBuffer?.length);

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

app.post('/api/billings', async (req, res) => {
  try {
    // Serverless environments need raw body parsing
    let body;
    if (req.body && typeof req.body === 'object') {
      // If body is already parsed, use it
      body = req.body;
    } else {
      // Parse raw body for serverless environments
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      try {
        body = JSON.parse(raw);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    }

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
      console.log('📄 Generating PDF synchronously for billing:', body.billingNumber);
      pdfResult = await PDFService.generateAndUploadBillingPDF(body);
      console.log('✅ PDF generated:', pdfResult.pdfGenerated ? pdfResult.blobUrl : 'Failed');
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
      finalTimestamp,
      JSON.stringify(billingDetails)
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

// PDF download endpoint for billings - Note: Billings don't permanently store PDF URLs
app.get('/api/billings/:id/download', async (req, res) => {
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

app.put('/api/vehicles/:id', async (req, res) => {
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
app.post('/api/rates', async (req, res) => {
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

app.put('/api/rates/:origin/:province/:town', async (req, res) => {
  try {
    const { originalOrigin, originalProvince, originalTown, ...updateData } = req.body;

    // Decode URL parameters and use as fallback for WHERE clause
    const originWhere = decodeURIComponent(req.params.origin);
    const provinceWhere = decodeURIComponent(req.params.province);
    const townWhere = decodeURIComponent(req.params.town);

    console.log('PUT /api/rates - Decoded WHERE parameters:', {
      origin: originWhere,
      province: provinceWhere,
      town: townWhere
    });

    console.log('PUT /api/rates - Request body updateData:', JSON.stringify(updateData, null, 2));
    console.log('PUT /api/rates - req.body:', JSON.stringify(req.body, null, 2));

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
      originWhere,
      provinceWhere,
      townWhere
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
    // Decode URL parameters properly
    const originWhere = decodeURIComponent(req.params.origin);
    const provinceWhere = decodeURIComponent(req.params.province);
    const townWhere = decodeURIComponent(req.params.town);

    console.log('DELETE /api/rates - Decoded WHERE parameters:', {
      origin: originWhere,
      province: provinceWhere,
      town: townWhere
    });

    const result = await query('DELETE FROM rates WHERE origin = $1 AND province = $2 AND town = $3 RETURNING *', [
      originWhere,
      provinceWhere,
      townWhere
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }
    console.log('Deleted rate:', originWhere, provinceWhere, townWhere);
    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate:', error);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// Expenses API endpoints
app.get('/api/expenses', async (req, res) => {
  try {
    console.log('🔍 GET /api/expenses - Fetching all expenses...')

    const result = await query('SELECT * FROM expenses ORDER BY created_at DESC');

    console.log(`✅ GET /api/expenses - Found ${result.rows.length} expenses in database`)

    if (result.rows.length > 0) {
      console.log('📊 GET /api/expenses - Sample expenses:', result.rows.slice(0, 2).map(e => ({
        id: e.id,
        date: e.date,
        category: e.category,
        description: e.description,
        amount: e.amount
      })));
    } else {
      console.log('📊 GET /api/expenses - No expenses found in database')
    }

    // Transform dates to ensure they're returned in the user's local timezone
    const transformedExpenses = result.rows.map(expense => ({
      ...expense,
      date: expense.date ? new Date(expense.date).toLocaleDateString('sv-SE') : null // YYYY-MM-DD format
    }));

    console.log('📤 GET /api/expenses - Returning transformed expenses')
    res.json(transformedExpenses);
  } catch (error) {
    console.error('❌ GET /api/expenses - Database error:', error)
    console.error('❌ GET /api/expenses - Error stack:', error.stack)
    res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
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

// Custom multer middleware for expenses (handles both FormData and JSON)
const uploadOptional = upload.fields([
  { name: 'receipt', maxCount: 1 }
]);


// Use regular JSON body parser for all expense routes (including creation)
app.post('/api/expenses', async (req, res) => {
  try {
    console.log('📦 Expense creation started - with file support');
    console.log('📋 Request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    });
    console.log('📄 Request body keys:', Object.keys(req.body || {}));

    // ✅ VALIDATION DEBUG: Log the entire request body at validation time
    console.log('🔍 VALIDATION DEBUG: Full req.body contents:');
    console.log('  typeof req.body:', typeof req.body);
    console.log('  req.body keys:', Object.keys(req.body || {}));
    console.log('  req.body values:', JSON.stringify(req.body, null, 2).substring(0, 1000) + '...');

    // Validate required fields are present in req.body
    const requiredFields = ['date', 'category', 'description', 'amount'];
    console.log('🔍 VALIDATION DEBUG: Checking required fields:', requiredFields);

    for (const field of requiredFields) {
      console.log(`🔍 VALIDATION DEBUG: checking field "${field}":`, {
        exists: !!req.body[field],
        value: req.body[field],
        type: typeof req.body[field]
      });
    }

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
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
      console.log('📎 Processing receipt file attachment');
      console.log('📎 File data:', {
        filename: req.body.receiptFile.filename,
        size: req.body.receiptFile.size,
        mimetype: req.body.receiptFile.mimetype
      });

      try {
        // Decode base64 data to Buffer
        receiptData = Buffer.from(req.body.receiptFile.data, 'base64');
        receiptFilename = req.body.receiptFile.filename;
        receiptOriginalName = req.body.receiptFile.filename; // Keep original name as-is
        receiptMimetype = req.body.receiptFile.mimetype;
        receiptSize = req.body.receiptFile.size;

        console.log('✅ Base64 file data decoded successfully');
        console.log('🗂️ Decoded file size:', receiptData.length, 'bytes');
        console.log('🗂️ Database fields set:', {
          receiptFilename,
          receiptOriginalName,
          receiptMimetype,
          receiptSize,
          receiptDataLength: receiptData.length
        });

      } catch (decodeError) {
        console.error('❌ Base64 decode error:', decodeError);
        return res.status(400).json({ error: 'Invalid file data provided' });
      }
    }

    // Duplicate validation removed - using validation from above

    console.log('✅ All required fields present:', {
      date: req.body.date,
      category: req.body.category,
      description: req.body.description,
      amount: req.body.amount
    });

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

    console.log('✅ Successfully created expense:', req.body.description);
    const createdExpense = result.rows[0];

    // Return the created expense with all receipt fields populated
    console.log('📤 Returning created expense with receipt info:', {
      id: createdExpense.id,
      hasReceipt: !!createdExpense.receipt_filename,
      receiptFilename: createdExpense.receipt_filename,
      receiptSize: createdExpense.receipt_size
    });

    return res.status(201).json(createdExpense);
  } catch (error) {
    console.error('❌ Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
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

    app.post('/api/fuel', async (req, res) => {
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

    app.put('/api/fuel/:id', async (req, res) => {
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
    app.post('/api/fuel/bulk', async (req, res) => {
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

app.post('/api/maintenance/schedules', async (req, res) => {
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

app.put('/api/maintenance/schedules/:id', async (req, res) => {
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

app.post('/api/maintenance/documents', async (req, res) => {
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

app.put('/api/maintenance/documents/:id', async (req, res) => {
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

app.post('/api/maintenance/notifications/preferences', async (req, res) => {
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

app.put('/api/maintenance/notifications/preferences/:id', async (req, res) => {
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

app.post('/api/maintenance/contacts', async (req, res) => {
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

app.put('/api/maintenance/contacts/:id', async (req, res) => {
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

// Test PDF generation and blob upload endpoint
app.post('/api/test/pdf', async (req, res) => {
  try {
    console.log('🧪 Starting PDF generation test with blob upload');

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

    console.log('📄 Testing PDF generation with mock data...');

    // Test the complete PDF workflow
    const pdfResult = await PDFService.generateAndUploadPDF(mockPayslipData);

    console.log('✅ PDF test completed - Results:', JSON.stringify(pdfResult, null, 2));

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
