const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined. Check your environment configuration.');
    }

    const migrationPath = path.resolve(__dirname, '../api/migrations/add-admin-action-logs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    await client.query(sql);

    console.log('Auth migration applied successfully.');
    await client.end();
  } catch (error) {
    console.error('Failed to apply auth migration:', error);
    process.exit(1);
  }
})();
