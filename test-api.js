const axios = require('axios');

// Test API endpoints
async function testAPI() {
  const baseUrl = 'http://localhost:3000';

  try {
    console.log('🧪 Testing MTM Serverless App API endpoints...\n');

    // Test 1: Get trips
    console.log('1. Testing GET /api/trips');
    try {
      const tripsResponse = await axios.get(`${baseUrl}/api/trips`, {
        timeout: 10000,
        params: { startDate: '2025-01-01', endDate: '2025-12-31', limit: 5 }
      });
      console.log('✅ Success - Trips endpoint working');
      console.log(`   HTTP ${tripsResponse.status}: Found ${tripsResponse.data.trips?.length || 0} trips, total: ${tripsResponse.data.pagination?.total || 0}`);
    } catch (error) {
      console.log('❌ Error - Trips endpoint failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response?.status) console.log('   HTTP status:', error.response.status);
      if (error.response?.data) console.log('   Response:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Test 2: Get employees
    console.log('\n2. Testing GET /api/employees');
    try {
      const employeesResponse = await axios.get(`${baseUrl}/api/employees`, { timeout: 10000 });
      console.log('✅ Success - Employees endpoint working');
      console.log(`   HTTP ${employeesResponse.status}: Found ${employeesResponse.data.length} employees`);
    } catch (error) {
      console.log('❌ Error - Employees endpoint failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response?.status) console.log('   HTTP status:', error.response.status);
      if (error.response?.data) console.log('   Response:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Test 3: Get rates
    console.log('\n3. Testing GET /api/rates');
    try {
      const ratesResponse = await axios.get(`${baseUrl}/api/rates`, { timeout: 10000 });
      console.log('✅ Success - Rates endpoint working');
      console.log(`   HTTP ${ratesResponse.status}: Found ${ratesResponse.data.length} rates`);
    } catch (error) {
      console.log('❌ Error - Rates endpoint failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response?.status) console.log('   HTTP status:', error.response.status);
      if (error.response?.data) console.log('   Response:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Test 4: Get payslips
    console.log('\n4. Testing GET /api/payslips');
    try {
      const payslipsResponse = await axios.get(`${baseUrl}/api/payslips`, {
        timeout: 10000,
        params: { limit: 5 }
      });
      console.log('✅ Success - Payslips endpoint working');
      console.log(`   HTTP ${payslipsResponse.status}: Found ${payslipsResponse.data.payslips?.length || 0} payslips`);
    } catch (error) {
      console.log('❌ Error - Payslips endpoint failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response?.status) console.log('   HTTP status:', error.response.status);
      if (error.response?.data) console.log('   Response:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Test 5: Get billings
    console.log('\n5. Testing GET /api/billings');
    try {
      const billingsResponse = await axios.get(`${baseUrl}/api/billings`, {
        timeout: 10000,
        params: { limit: 5 }
      });
      console.log('✅ Success - Billings endpoint working');
      console.log(`   HTTP ${billingsResponse.status}: Found ${billingsResponse.data.billings?.length || 0} billings`);
    } catch (error) {
      console.log('❌ Error - Billings endpoint failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response?.status) console.log('   HTTP status:', error.response.status);
      if (error.response?.data) console.log('   Response:', JSON.stringify(error.response.data).substring(0, 200));
    }

    console.log('\n🎯 ========== Backend API Testing Complete ==========');
    console.log('📱 Next: Test frontend at http://localhost:3000');

  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
