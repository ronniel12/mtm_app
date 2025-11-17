const { query } = require('./api/lib/db');

// Add test vehicle for testing fuel entries
async function addTestVehicle() {
  try {
    console.log('Adding test vehicle...');

    // Check if vehicle already exists
    const existing = await query(
      'SELECT * FROM vehicles WHERE plate_number = $1',
      ['TEST123']
    );

    if (existing.rows.length > 0) {
      console.log('Test vehicle already exists');
      return;
    }

    // Add test vehicle
    await query(`
      INSERT INTO vehicles (plate_number, vehicle_class, name)
      VALUES ($1, $2, $3)
    `, [
      'TEST123',
      'Truck',
      'Test Vehicle'
    ]);

    console.log('✅ Test vehicle added successfully');
  } catch (error) {
    console.error('❌ Error adding test vehicle:', error);
  }
}

addTestVehicle().then(() => process.exit(0));
