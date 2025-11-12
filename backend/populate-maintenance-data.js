const { query } = require('./db');

async function populateMaintenanceData() {
  try {
    console.log('Starting maintenance data population...');

    // Get all maintenance schedules
    const schedulesResult = await query('SELECT * FROM maintenance_schedules');
    const schedules = schedulesResult.rows;

    console.log(`Found ${schedules.length} maintenance schedules to populate`);

    for (const schedule of schedules) {
      try {
        // Generate random data based on schedule type
        let updateData = {};

        if (schedule.schedule_type === 'time_based') {
          // Time-based schedule
          // Generate random last completed date (between 1-180 days ago)
          const daysAgo = Math.floor(Math.random() * 180) + 1;
          const lastCompletedDate = new Date();
          lastCompletedDate.setDate(lastCompletedDate.getDate() - daysAgo);

          // Generate random frequency (1-12 months, or 1-2 years)
          const frequencyUnits = ['months', 'years'];
          const randomUnit = frequencyUnits[Math.floor(Math.random() * frequencyUnits.length)];
          const frequencyValue = randomUnit === 'months' ?
            Math.floor(Math.random() * 12) + 1 : // 1-12 months
            Math.floor(Math.random() * 2) + 1;   // 1-2 years

          // Calculate next due date
          const nextDueDate = new Date(lastCompletedDate);
          if (randomUnit === 'months') {
            nextDueDate.setMonth(nextDueDate.getMonth() + frequencyValue);
          } else {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + frequencyValue);
          }

          // Generate random reminder days (1-30)
          const reminderDays = Math.floor(Math.random() * 30) + 1;

          updateData = {
            last_completed_date: lastCompletedDate.toISOString().split('T')[0],
            frequency_value: frequencyValue,
            frequency_unit: randomUnit,
            reminder_days: reminderDays,
            next_due_date: nextDueDate.toISOString().split('T')[0],
            last_mileage_serviced: null // Not used for time-based
          };

        } else if (schedule.schedule_type === 'mileage_based') {
          // Mileage-based schedule
          // Generate random last mileage serviced (0-80,000 km)
          const lastMileageServiced = Math.floor(Math.random() * 80000);

          // Generate random frequency based on typical maintenance intervals
          const mileageOptions = [
            { value: 5000, unit: 'km' },   // Tire checks
            { value: 8000, unit: 'km' },   // Oil changes
            { value: 10000, unit: 'km' },  // Brake inspections
            { value: 15000, unit: 'km' },  // Filters
            { value: 20000, unit: 'km' },  // Transmission
            { value: 30000, unit: 'km' },  // Major services
            { value: 60000, unit: 'km' }   // Timing belts
          ];

          const randomMileage = mileageOptions[Math.floor(Math.random() * mileageOptions.length)];

          // Calculate next due mileage
          const nextDueMileage = lastMileageServiced + randomMileage.value;

          // Generate random reminder distance (100-2000 km)
          const reminderDistance = Math.floor(Math.random() * 1900) + 100;

          updateData = {
            last_mileage_serviced: lastMileageServiced,
            frequency_value: randomMileage.value,
            frequency_unit: randomMileage.unit,
            reminder_days: reminderDistance, // This represents km for mileage-based
            next_due_mileage: nextDueMileage,
            last_completed_date: null // Not used for mileage-based
          };
        }

        // Update the schedule
        const updateFields = Object.keys(updateData).filter(key => updateData[key] !== null);
        const values = updateFields.map(key => updateData[key]);
        values.push(schedule.id);

        const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

        await query(`
          UPDATE maintenance_schedules
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${values.length}
        `, values);

        console.log(`Updated schedule ${schedule.id} (${schedule.maintenance_type}): ${JSON.stringify(updateData)}`);

      } catch (error) {
        console.error(`Error updating schedule ${schedule.id}:`, error);
      }
    }

    console.log('Maintenance data population completed!');

    // Verify the updates
    const updatedResult = await query('SELECT id, maintenance_type, schedule_type, frequency_value, frequency_unit, reminder_days, last_completed_date, last_mileage_serviced, next_due_date, next_due_mileage FROM maintenance_schedules LIMIT 5');
    console.log('Sample updated schedules:');
    console.log(JSON.stringify(updatedResult.rows, null, 2));

  } catch (error) {
    console.error('Error populating maintenance data:', error);
  }
}

// Run the population script
populateMaintenanceData();
