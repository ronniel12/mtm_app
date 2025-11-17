const { query } = require('./lib/db');

async function updateFoodAllowance() {
  try {
    console.log('🍽️ Updating food allowance for existing trips (450 per day, only one per date)...');

    // First check if food_allowance column exists
    const columnCheck = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'trips' AND column_name = 'food_allowance'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('❌ food_allowance column does not exist. Adding it first...');
      await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS food_allowance DECIMAL(10,2) DEFAULT 0');
      console.log('✅ food_allowance column added successfully');
    }

    // Get all unique dates that have trips
    const datesResult = await query(`
      SELECT DISTINCT date FROM trips ORDER BY date
    `);

    console.log(`📅 Found ${datesResult.rows.length} unique dates with trips`);

    let totalUpdated = 0;

    // For each date, find the earliest trip and give it 450 food allowance
    for (const dateRow of datesResult.rows) {
      const date = dateRow.date;

      // Find the earliest trip for this date
      const earliestTripResult = await query(`
        SELECT id, tracking_number, created_at
        FROM trips
        WHERE date = $1
        ORDER BY created_at ASC
        LIMIT 1
      `, [date]);

      if (earliestTripResult.rows.length > 0) {
        const trip = earliestTripResult.rows[0];

        // Update this trip with 450 food allowance (only if it doesn't already have it)
        await query(`
          UPDATE trips
          SET food_allowance = CASE
            WHEN food_allowance > 0 THEN food_allowance  -- Keep existing value if > 0
            ELSE 450.00  -- Set to 450 if 0 or NULL
          END
          WHERE id = $1
        `, [trip.id]);

        console.log(`✅ Updated trip ${trip.tracking_number} (${date}) - food allowance set to 450`);
        totalUpdated++;
      }
    }

    // Show summary
    console.log(`\n📊 Summary:`);
    console.log(`   - Total dates processed: ${datesResult.rows.length}`);
    console.log(`   - Trips updated with 450 food allowance: ${totalUpdated}`);
    console.log(`   - Each day's first trip got the allowance`);

    // Show current food allowance distribution
    const allowanceCheck = await query(`
      SELECT
        COUNT(*) as total_trips,
        COUNT(CASE WHEN food_allowance > 0 THEN 1 END) as trips_with_allowance,
        SUM(food_allowance) as total_allowance
      FROM trips
    `);

    const { total_trips, trips_with_allowance, total_allowance } = allowanceCheck.rows[0];

    console.log(`\n💰 Current food allowance status:`);
    console.log(`   - Total trips: ${total_trips}`);
    console.log(`   - Trips with food allowance: ${trips_with_allowance}`);
    console.log(`   - Total food allowance: ${total_allowance || 0}`);

  } catch (error) {
    console.error('❌ Error updating food allowance:', error);
    throw error;
  }
}

// Run the update if this file is executed directly
if (require.main === module) {
  updateFoodAllowance()
    .then(() => {
      console.log('\n✅ Food allowance update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Food allowance update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateFoodAllowance };
