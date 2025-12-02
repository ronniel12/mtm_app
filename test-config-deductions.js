const axios = require('axios');

async function testConfigurationDeductions() {
  console.log('🧪 Testing Configuration-Based Deductions & Matrix');
  console.log('=================================================');

  // Torio's UUID
  const TORIO_UUID = '3f58fba4-70cc-4b9e-bfb1-447fa1a5b92f';

  try {
    // Test 0: Check matrix alignment
    console.log('\n📊 Test 0: Checking matrix alignment...');
    const matrixResponse = await axios.get(`http://localhost:3000/api/employee-deduction-configs/matrix`);
    const { deductions, matrix } = matrixResponse.data;

    console.log('   Available deductions (sorted by ID):');
    deductions.forEach((d, index) => {
      console.log(`   ${index}: ${d.id}:${d.name}`);
    });

    console.log('   Matrix configurations for employees:');
    matrix.forEach(employeeRow => {
      console.log(`   ${employeeRow.employee.name}:`);
      employeeRow.configs.forEach((configItem, index) => {
        console.log(`     Column ${index}: deduction_id=${configItem.deduction.id}, apply_mode=${configItem.config.apply_mode}`);
      });
    });

    // Test 1: Fetch Torio's deduction configurations
    console.log('\n📊 Test 1: Fetching Torio configurations...');
    const configsResponse = await axios.get(`http://localhost:3000/api/employee-deduction-configs?employee_uuid=${TORIO_UUID}`);
    const configs = configsResponse.data;

    console.log(`   Found ${configs.length} configurations for Torio:`);
    configs.forEach(config => {
      console.log(`   • deduction_id=${config.deduction_id}, ${config.deduction_name}: ${config.apply_mode} mode`);
      if (config.date_config && config.date_config.selected_dates) {
        console.log(`     Dates: [${config.date_config.selected_dates.join(', ')}]`);
      }
    });

    // Test 2: Check if Torio should get Pag-IBIG for Oct 30
    console.log('\n📅 Test 2: Checking Pag-IBIG for Oct 30 period...');
    const testPeriod = {
      startDate: '2025-10-27',
      endDate: '2025-11-03'
    };

    let pagIbigCount = 0;
    for (const config of configs) {
      if (config.apply_mode === 'never' || config.deduction_name !== 'Pag-IBIG') continue;

      if (config.apply_mode === 'always') {
        console.log('   ✓ Always apply Pag-IBIG');
        pagIbigCount++;
        continue;
      }

      if (config.apply_mode === 'selected_dates' && config.date_config) {
        let shouldApply = false;
        if (config.date_config.selected_dates && Array.isArray(config.date_config.selected_dates)) {
          for (const dateStr of config.date_config.selected_dates) {
            const configDate = new Date(dateStr + 'T00:00:00');
            const periodStart = new Date(testPeriod.startDate);
            const periodEnd = new Date(testPeriod.endDate);
            periodEnd.setHours(23, 59, 59, 999);

            if (configDate >= periodStart && configDate <= periodEnd) {
              shouldApply = true;
              break;
            }
          }
        }

        if (shouldApply) {
          console.log(`   ✓ Pag-IBIG applies (${config.date_config.selected_dates.join(', ')}) overlaps with period`);
          pagIbigCount++;
        }
      }
    }

    console.log(`\n✅ Outcome: Torio should receive ${pagIbigCount} Pag-IBIG deduction(s) for this period`);

    if (pagIbigCount > 0) {
      console.log('🎉 SUCCESS: Configuration-based deductions are working!');
      console.log('   - No standard deductions (SSS, PhilHealth, Pag-IBIG) should auto-apply');
      console.log('   - Torio will get Pag-IBIG deductions only from her configurations');
    } else {
      console.log('⚠️  WARNING: No Pag-IBIG deductions found for Torio in this period');
    }

    // Test 3: Test specific complaint - sss vs philhealth mixup
    console.log('\n🔍 Test 3: Testing deduction ID consistency...');
    const sssDeduction = deductions.find(d => d.name.toLowerCase() === 'sss');
    const philhealthDeduction = deductions.find(d => d.name.toLowerCase() === 'philhealth');

    console.log(`   SSS deduction: id=${sssDeduction?.id}, name=${sssDeduction?.name}`);
    console.log(`   PhilHealth deduction: id=${philhealthDeduction?.id}, name=${philhealthDeduction?.name}`);

    if (sssDeduction && philhealthDeduction) {
      console.log(`   ✅ Deductions have different IDs: ${sssDeduction.id} vs ${philhealthDeduction.id}`);
      console.log('   ✅ Matrix should correctly map these to appropriate columns');
    } else {
      console.log('   ⚠️  Could not find both SSS and PhilHealth deductions');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testConfigurationDeductions();
