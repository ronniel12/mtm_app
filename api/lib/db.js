const { Pool } = require('pg');
require('dotenv').config();

// Use environment variable with fallback for local development
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_HGRviFJ96Vkq@ep-frosty-firefly-ahljyrnl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }, // Always use SSL for both local and production
  max: 3, // Allow more concurrent connections for parallel requests
  min: 0, // No minimum connections for serverless
  idleTimeoutMillis: 30000, // Longer timeout for connection reuse
  connectionTimeoutMillis: 30000, // Longer connection timeout
  acquireTimeoutMillis: 30000, // Allow more time for acquiring connections
  maxUses: 7500, // Reset connections periodically
  timezone: 'UTC', // Force UTC timezone to prevent date conversion issues
  allowExitOnIdle: true, // Allow exiting when idle in serverless
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

module.exports = {
  pool,
  query
};
