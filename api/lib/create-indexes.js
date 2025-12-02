const { query } = require('./db');

// Database indexes for performance optimization
async function createIndexes() {
  try {
    console.log('Creating database indexes for performance optimization...');

    // Index for trips table - most frequently queried columns
    await query('CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date)');
    console.log('✓ Created index on trips(date)');

    await query('CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)');
    console.log('✓ Created index on trips(status)');

    await query('CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at)');
    console.log('✓ Created index on trips(created_at)');

    await query('CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination)');
    console.log('✓ Created index on trips(destination)');

    await query('CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver)');
    console.log('✓ Created index on trips(driver)');

    await query('CREATE INDEX IF NOT EXISTS idx_trips_helper ON trips(helper)');
    console.log('✓ Created index on trips(helper)');

    // Composite index for common queries
    await query('CREATE INDEX IF NOT EXISTS idx_trips_date_status ON trips(date, status)');
    console.log('✓ Created composite index on trips(date, status)');

    // Index for employees table
    await query('CREATE INDEX IF NOT EXISTS idx_employees_uuid ON employees(uuid)');
    console.log('✓ Created index on employees(uuid)');

    await query('CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at)');
    console.log('✓ Created index on employees(created_at)');

    // Index for rates table - for rate lookups
    await query('CREATE INDEX IF NOT EXISTS idx_rates_town_province ON rates(town, province)');
    console.log('✓ Created composite index on rates(town, province)');

    await query('CREATE INDEX IF NOT EXISTS idx_rates_origin ON rates(origin)');
    console.log('✓ Created index on rates(origin)');

    // Index for payslips table
    await query('CREATE INDEX IF NOT EXISTS idx_payslips_employee_uuid ON payslips(employee_uuid)');
    console.log('✓ Created index on payslips(employee_uuid)');

    await query('CREATE INDEX IF NOT EXISTS idx_payslips_created_date ON payslips(created_date)');
    console.log('✓ Created index on payslips(created_date)');

    // Index for billings table
    await query('CREATE INDEX IF NOT EXISTS idx_billings_created_date ON billings(created_date)');
    console.log('✓ Created index on billings(created_date)');

    await query('CREATE INDEX IF NOT EXISTS idx_billings_payment_status ON billings(payment_status)');
    console.log('✓ Created index on billings(payment_status)');

    console.log('\n✅ All database indexes created successfully!');
    console.log('\nPerformance improvements:');
    console.log('- Faster trip filtering and sorting');
    console.log('- Improved employee lookups');
    console.log('- Optimized rate calculations');
    console.log('- Better dashboard query performance');

  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

// Run the migration
createIndexes().then(() => {
  console.log('\n🎉 Database optimization complete!');
  process.exit(0);
});
