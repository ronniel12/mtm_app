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

    if (req.method === 'GET') {
      // Check cache first
      const cacheKey = 'employees:all';
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        console.log('✅ Serving employees from cache');
        return res.json(cachedResult);
      }

      const result = await query('SELECT * FROM employees ORDER BY created_at DESC');

      // Cache the result
      cache.set(cacheKey, result.rows);

      console.log('✅ Fetched employees from database:', result.rows.length);

      res.json(result.rows);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};
