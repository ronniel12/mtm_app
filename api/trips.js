const { query } = require('./lib/db');
const NodeCache = require('node-cache');

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

module.exports = async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { startDate, endDate, page = 1, limit: limitParam } = req.query;
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
        page: parseInt(page),
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
};
