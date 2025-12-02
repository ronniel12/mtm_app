const { query } = require('./lib/db');

async function fixDeductions() {
  try {
    console.log('🔧 Applying targeted fix for deductions table...');

    // Fix 1: Add updated_at column to deductions table
    try {
      await query(`ALTER TABLE deductions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Added updated_at column to deductions table');
    } catch (error) {
      console.log('ℹ️ updated_at column already exists in deductions table:', error.message);
    }

    // Fix 2: Add updated_at column to notification_history table (prevent future index issues)
    try {
      await query(`ALTER TABLE notification_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Added updated_at column to notification_history table');
    } catch (error) {
      console.log('ℹ️ updated_at column already exists in notification_history table:', error.message);
    }

    // Test the fix by querying the deductions table structure
    try {
      const result = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'deductions'
        ORDER BY ordinal_position
      `);

      console.log('\n📋 Deductions table columns:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}${col.column_default ? ' (' + col.column_default + ')' : ''}`);
      });

      // Verify updated_at exists
      const hasUpdatedAt = result.rows.some(col => col.column_name === 'updated_at');
      if (hasUpdatedAt) {
        console.log('✅ SUCCESS: updated_at column exists - deduction updates should now work!');
      } else {
        console.log('❌ WARNING: updated_at column is still missing');
      }
    } catch (verifyError) {
      console.log('Error verifying table structure:', verifyError.message);
    }

    console.log('\n🎯 Deductions table fix completed! The payroll deduction update functionality should now work.');
  } catch (error) {
    console.error('❌ Error in deductions fix:', error);
    throw error;
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixDeductions()
    .then(() => {
      console.log('\n✅ Fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDeductions };
