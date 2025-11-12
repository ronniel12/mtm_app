const { query } = require('./db');

async function createTables() {
  try {
    console.log('Creating database tables...');

    // Create trips table
    await query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        tracking_number VARCHAR(50) UNIQUE NOT NULL,
        date DATE NOT NULL,
        truck_plate VARCHAR(20),
        invoice_number VARCHAR(100),
        origin TEXT,
        farm_name TEXT,
        destination TEXT,
        full_destination TEXT,
        rate_lookup_key TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        estimated_delivery DATE,
        driver TEXT,
        helper TEXT,
        number_of_bags INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create employees table
    await query(`
      CREATE TABLE IF NOT EXISTS employees (
        uuid VARCHAR(36) PRIMARY KEY,
        name TEXT NOT NULL,
        phone VARCHAR(20),
        license_number VARCHAR(50),
        pagibig_number VARCHAR(20),
        sss_number VARCHAR(20),
        philhealth_number VARCHAR(20),
        address TEXT,
        cash_advance DECIMAL(10,2) DEFAULT 0,
        loans DECIMAL(10,2) DEFAULT 0,
        auto_deduct_cash_advance BOOLEAN DEFAULT true,
        auto_deduct_loans BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rates table
    await query(`
      CREATE TABLE IF NOT EXISTS rates (
        id SERIAL PRIMARY KEY,
        origin VARCHAR(100),
        province VARCHAR(100),
        town VARCHAR(100),
        rate DECIMAL(10,2),
        new_rates DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);



    // Create billings table
    await query(`
      CREATE TABLE IF NOT EXISTS billings (
        id VARCHAR(50) PRIMARY KEY,
        billing_number VARCHAR(100),
        period_start DATE,
        period_end DATE,
        client_name TEXT,
        client_address TEXT,
        client_city TEXT,
        client_zip_code VARCHAR(10),
        client_tin VARCHAR(20),
        trips JSONB,
        totals JSONB,
        prepared_by TEXT,
        payment_status VARCHAR(50) DEFAULT 'pending',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to existing billings table
    try {
      await query(`ALTER TABLE billings ADD COLUMN IF NOT EXISTS client_city TEXT`);
      await query(`ALTER TABLE billings ADD COLUMN IF NOT EXISTS client_zip_code VARCHAR(10)`);
      console.log('✅ Added missing client_city and client_zip_code columns to billings table');
    } catch (error) {
      console.log('ℹ️ Columns may already exist or error adding them:', error.message);
    }

    // Create payslips table
    await query(`
      CREATE TABLE IF NOT EXISTS payslips (
        id VARCHAR(50) PRIMARY KEY,
        payslip_number VARCHAR(100),
        employee_uuid VARCHAR(36) REFERENCES employees(uuid),
        period_start DATE,
        period_end DATE,
        gross_pay DECIMAL(10,2),
        deductions DECIMAL(10,2),
        net_pay DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSONB
      )
    `);

    // Create deductions table
    await query(`
      CREATE TABLE IF NOT EXISTS deductions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50),
        value DECIMAL(10,2),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create vehicles table
    await query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        plate_number VARCHAR(20) UNIQUE NOT NULL,
        vehicle_class VARCHAR(20) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create expenses table
    await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        vehicle VARCHAR(20),
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add file attachment columns to existing expenses table
    try {
      await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_filename TEXT`);
      await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_original_name TEXT`);
      await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_mimetype VARCHAR(100)`);
      await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_size INTEGER`);
      await query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_data BYTEA`);
      console.log('✅ Added file attachment columns to expenses table');
    } catch (error) {
      console.log('ℹ️ File attachment columns may already exist:', error.message);
    }

    // ============================================================================
    // MAINTENANCE SYSTEM TABLES
    // ============================================================================

    // Create maintenance_schedules table
    await query(`
      CREATE TABLE IF NOT EXISTS maintenance_schedules (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        maintenance_type VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL, -- preventive, documentation, safety
        schedule_type VARCHAR(50) NOT NULL, -- time_based, mileage_based, document_based
        frequency_value INTEGER NOT NULL,
        frequency_unit VARCHAR(20) NOT NULL, -- days, weeks, months, years, km, miles
        reminder_days INTEGER DEFAULT 7,
        last_completed_date DATE,
        last_mileage_serviced INTEGER,
        next_due_date DATE,
        next_due_mileage INTEGER,
        status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to existing maintenance_schedules table
    try {
      await query(`ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS last_mileage_serviced INTEGER`);
      console.log('✅ Added missing last_mileage_serviced column to maintenance_schedules table');
    } catch (error) {
      console.log('ℹ️ Column may already exist or error adding it:', error.message);
    }

    // Create vehicle_documents table
    await query(`
      CREATE TABLE IF NOT EXISTS vehicle_documents (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        document_type VARCHAR(100) NOT NULL, -- registration, insurance, permit, etc.
        document_number VARCHAR(100),
        issue_date DATE,
        expiry_date DATE NOT NULL,
        issuing_authority VARCHAR(200),
        cost DECIMAL(10,2),
        document_file_path TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notification_preferences table
    await query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, -- Will be updated when user system is implemented
        maintenance_type VARCHAR(100), -- specific type or 'all'
        reminder_days INTEGER DEFAULT 7,
        notification_methods TEXT, -- JSON array: ['sms', 'whatsapp', 'in_app', 'push']
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notification_history table
    await query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        maintenance_schedule_id INTEGER REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
        notification_type VARCHAR(50) NOT NULL, -- reminder, overdue, completed
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_method VARCHAR(20) NOT NULL, -- sms, whatsapp, facebook, viber, in_app, push
        status VARCHAR(20) DEFAULT 'sent', -- sent, failed, pending
        message_content TEXT,
        recipient_contact TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_contacts table for messaging
    await query(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, -- Will be updated when user system is implemented
        contact_type VARCHAR(20) NOT NULL, -- phone, whatsapp, facebook, viber
        contact_value TEXT NOT NULL, -- phone number, messenger ID, etc.
        is_primary BOOLEAN DEFAULT false,
        verified BOOLEAN DEFAULT false,
        verification_code VARCHAR(10),
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Maintenance system tables created successfully!');

    // Create indexes for better performance
    console.log('Creating database indexes...');

    // Trips table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_helper ON trips(helper)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_farm_name ON trips(farm_name)');
    await query('CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination)');

    // Billings table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_billings_created_date ON billings(created_date DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_billings_payment_status ON billings(payment_status)');
    await query('CREATE INDEX IF NOT EXISTS idx_billings_client_name ON billings(client_name)');
    await query('CREATE INDEX IF NOT EXISTS idx_billings_period_start ON billings(period_start)');
    await query('CREATE INDEX IF NOT EXISTS idx_billings_period_end ON billings(period_end)');

    // Rates table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_rates_origin_province_town ON rates(origin, province, town)');
    await query('CREATE INDEX IF NOT EXISTS idx_rates_origin ON rates(origin)');
    await query('CREATE INDEX IF NOT EXISTS idx_rates_province ON rates(province)');
    await query('CREATE INDEX IF NOT EXISTS idx_rates_town ON rates(town)');

    // Employees table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name)');
    await query('CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC)');

    // Payslips table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_payslips_created_date ON payslips(created_date DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_payslips_employee_uuid ON payslips(employee_uuid)');
    await query('CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status)');

    // Deductions table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_deductions_created_at ON deductions(created_at DESC)');

    // Vehicles table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number)');
    await query('CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_class ON vehicles(vehicle_class)');
    await query('CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC)');

    // Expenses table indexes
    await query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
    await query('CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle)');
    await query('CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC)');

    // Maintenance system indexes
    await query('CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_vehicle_id ON maintenance_schedules(vehicle_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_type ON maintenance_schedules(maintenance_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_due ON maintenance_schedules(next_due_date)');
    await query('CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_status ON maintenance_schedules(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_created_at ON maintenance_schedules(created_at DESC)');

    await query('CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON vehicle_documents(vehicle_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_vehicle_documents_type ON vehicle_documents(document_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON vehicle_documents(expiry_date)');
    await query('CREATE INDEX IF NOT EXISTS idx_vehicle_documents_created_at ON vehicle_documents(created_at DESC)');

    await query('CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_type ON notification_preferences(user_id, maintenance_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_notification_preferences_active ON notification_preferences(is_active)');

    await query('CREATE INDEX IF NOT EXISTS idx_notification_history_vehicle ON notification_history(vehicle_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_notification_history_schedule ON notification_history(maintenance_schedule_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status)');

    await query('CREATE INDEX IF NOT EXISTS idx_user_contacts_user_type ON user_contacts(user_id, contact_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_user_contacts_primary ON user_contacts(is_primary)');
    await query('CREATE INDEX IF NOT EXISTS idx_user_contacts_verified ON user_contacts(verified)');

    console.log('✅ All maintenance system indexes created successfully!');
    console.log('All tables and indexes created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('Database migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createTables };
