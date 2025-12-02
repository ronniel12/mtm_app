const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { cache, CACHE_KEYS } = require('../middleware/cache');

// Trips API endpoints - Trip suggestions API endpoint
router.get('/suggestions', async (req, res) => {
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

router.get('/', async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    let limit, offset;

    // Check if both startDate and endDate are provided and not empty
    if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
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
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    let result;
    if (limit === null) {
      // Fetch all records without pagination (with date filter)
      const queryStr = `SELECT * FROM trips ${whereClause} ORDER BY created_at DESC`;
      result = await query(queryStr, params);
    } else {
      // Get paginated results (with date filter)
      const queryStr = `SELECT * FROM trips ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      result = await query(queryStr, [...params, limit, offset]);
    }

    if (result.rows.length > 0) {
    } else {
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

// Optimized trips endpoint with pre-calculated rates and search
router.get('/calculated', async (req, res) => {
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

router.get('/:id', async (req, res) => {
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

router.post('/', async (req, res) => {
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

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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

module.exports = router;
