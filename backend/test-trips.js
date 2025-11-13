const { query } = require('./db');

async function testTripsQuery() {
  try {
    console.log('Testing trips query...');

    // Test basic query
    const result = await query('SELECT id, date, tracking_number FROM trips LIMIT 5');
    console.log('Sample trips data:');
    result.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.date}, Tracking: ${row.tracking_number}`);
    });

    // Test date filtering
    const startDate = '2024-01-01';
    const endDate = '2024-12-31';
    console.log(`\nTesting date filter: ${startDate} to ${endDate}`);

    const filteredResult = await query('SELECT COUNT(*) as count FROM trips WHERE date >= $1 AND date <= $2', [startDate, endDate]);
    console.log(`Trips in date range: ${filteredResult.rows[0].count}`);

    // Test with actual data
    const actualFiltered = await query('SELECT id, date, tracking_number FROM trips WHERE date >= $1 AND date <= $2 ORDER BY date LIMIT 5', [startDate, endDate]);
    console.log('Filtered trips:');
    actualFiltered.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.date}, Tracking: ${row.tracking_number}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testTripsQuery();