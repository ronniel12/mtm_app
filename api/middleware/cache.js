// Cache middleware
const NodeCache = require('node-cache');

// Initialize cache (15 minutes TTL for reference data)
const cache = new NodeCache({ stdTTL: 900 });

// Cache keys for frequently accessed data
const CACHE_KEYS = {
  RATES: 'rates:all',
  EMPLOYEES: 'employees:all'
};

module.exports = { cache, CACHE_KEYS };
