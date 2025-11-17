<template>
  <div class="dashboard-charts">
    <!-- Filters Section -->
    <v-row class="mb-6">
      <v-col cols="12" md="6" lg="4">
        <v-card variant="outlined" class="pa-4">
          <v-select
            v-model="filterPeriod"
            @update:model-value="updateFilter"
            :items="filterOptions"
            label="Report Period"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-calendar-filter"
            hide-details
            class="mb-0"
          />
        </v-card>
      </v-col>
    </v-row>

      <!-- Enhanced Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🚛</div>
          <div class="stat-info">
            <div class="stat-value">{{ filteredTrips.length }}</div>
            <div class="stat-label">Total Trips</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">{{ activeEmployees }}</div>
            <div class="stat-label">Active Employees</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-value">{{ completedTrips }}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
        <div class="stat-card profit-card">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-value">₱{{ formatCurrency(filteredRevenue) }}</div>
            <div class="stat-label">{{ revenueLabel }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <div class="stat-value">{{ filteredBags }}</div>
            <div class="stat-label">Total Bags</div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        <!-- Monthly Trips Chart -->
        <div class="chart-card">
          <h3>📈 {{ tripChartTitle }}</h3>
          <div class="chart-container">
            <Line :data="monthlyTripsData" :options="lineOptions" />
          </div>
        </div>

        <!-- Destination Distribution -->
        <div class="chart-card">
          <h3>🗺️ Top Destinations</h3>
          <div class="chart-container">
            <Bar :data="destinationData" :options="barOptions" />
          </div>
        </div>

        <!-- Revenue Chart -->
        <div class="chart-card">
          <h3>💰 {{ revenueChartTitle }}</h3>
          <div class="chart-container">
            <Line :data="revenueData" :options="revenueOptions" />
          </div>
        </div>

        <!-- Truck Performance -->
        <div class="chart-card">
          <h3>🚚 Truck Performance</h3>
          <div class="chart-container">
            <Doughnut :data="truckPerformanceData" :options="doughnutOptions" />
          </div>
        </div>
      </div>

      <!-- Recent Trips -->
      <div class="recent-trips">
        <h3>Recent Trips</h3>
        <div v-if="recentTripsData.length > 0" class="recent-list">
          <div
            v-for="trip in recentTripsData"
            :key="trip.id"
            class="recent-item"
          >
            <div class="trip-code">TRP{{ String(trip.id).padStart(3, '0') }}</div>
            <div class="trip-details">
              <span>{{ trip.truckPlate }} - {{ trip.farmName ? trip.farmName.slice(0, 30) : 'Unknown' }}...</span>
              <small>{{ trip.status }}</small>
            </div>
            <div class="trip-date">{{ formatDate(trip.date) }}</div>
          </div>
        </div>
        <div v-else class="no-data">
          No trips recorded yet.
        </div>
      </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Filter state
const filterPeriod = ref('all')

// Filter options for Vuetify select
const filterOptions = [
  { title: 'All Time', value: 'all' },
  { title: 'This Week', value: 'weekly' },
  { title: 'This Month', value: 'monthly' },
  { title: 'This Year', value: 'yearly' }
]

// Local data
const trips = ref([])
const employees = ref([])
const isLoading = ref(true)
const error = ref(null)

// Fetch data function
const fetchDashboardData = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Use optimized endpoint that includes pre-calculated rates
    const [tripsRes, employeesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/trips/calculated?limit=all`),
      axios.get(`${API_BASE_URL}/employees`)
    ])

    // Data is already processed by the API with pre-calculated rates
    trips.value = tripsRes.data.trips || []
    employees.value = employeesRes.data
  } catch (err) {
    console.error('Error fetching dashboard data:', err)
    error.value = 'Failed to load dashboard data. Please check if the backend server is running.'
  } finally {
    isLoading.value = false
  }
}

// Total counts (unchanging)
const activeEmployees = computed(() => employees.value.length)
const completedTrips = computed(() => trips.value.filter(t => t.status === 'Completed').length)

// Filtered data based on selected filters
const getDateRange = (filter) => {
  const now = new Date()
  let startDate

  switch (filter) {
    case 'weekly':
      // Calculate Monday of current week
      const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Days to subtract to get to Monday
      startDate = new Date(now)
      startDate.setDate(now.getDate() - daysToSubtract)
      startDate.setHours(0, 0, 0, 0) // Set to start of Monday
      break
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      return null // no filter
  }

  return startDate
}

const filteredTrips = computed(() => {
  if (filterPeriod.value === 'all') {
    return trips.value
  }

  const startDate = getDateRange(filterPeriod.value)
  return trips.value.filter(trip => {
    const tripDate = new Date(trip.date)
    return tripDate >= startDate
  })
})

const filteredRevenue = computed(() => {
  return filteredTrips.value.reduce((sum, trip) => {
    return sum + (trip._total || 0)
  }, 0)
})

const filteredBags = computed(() => {
  return filteredTrips.value.reduce((sum, trip) => sum + (trip.numberOfBags || 0), 0)
})

const revenueLabel = computed(() => {
  switch (filterPeriod.value) {
    case 'all': return 'TOTAL REVENUE'
    case 'weekly': return 'THIS WEEK'
    case 'monthly': return 'THIS MONTH'
    case 'yearly': return 'THIS YEAR'
    default: return 'TOTAL REVENUE'
  }
})

const tripChartTitle = computed(() => {
  switch (filterPeriod.value) {
    case 'weekly': return 'Daily Trip Performance'
    case 'monthly': return 'Daily Trip Performance'
    case 'yearly': return 'Monthly Trip Performance'
    default: return 'Monthly Trip Performance'
  }
})

const revenueChartTitle = computed(() => {
  switch (filterPeriod.value) {
    case 'weekly': return 'Daily Revenue'
    case 'monthly': return 'Daily Revenue'
    case 'yearly': return 'Monthly Revenue'
    default: return 'Monthly Revenue'
  }
})

const updateFilter = () => {
  // Just updates the computed properties
}

const recentTripsData = computed(() => {
  return [...trips.value].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
})

// Initialize data
onMounted(() => {
  fetchDashboardData()
})

const monthlyTripsData = computed(() => {
  const isDaily = filterPeriod.value === 'weekly' || filterPeriod.value === 'monthly'
  const data = {}

  filteredTrips.value.forEach(trip => {
    const date = new Date(trip.date)
    let key

    if (isDaily) {
      // Group by day for weekly/monthly filters
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else {
      // Group by month for all/yearly filters
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    data[key] = (data[key] || 0) + 1
  })

  return {
    labels: Object.keys(data).sort().map(key => {
      if (isDaily) {
        const [year, month, day] = key.split('-')
        return new Date(year, month - 1, day).toLocaleString('default', { month: 'short', day: 'numeric' })
      } else {
        const [year, month] = key.split('-')
        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
      }
    }),
    datasets: [{
      label: 'Trips',
      data: Object.keys(data).sort().map(key => data[key]),
      borderColor: '#667eea',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

const destinationData = computed(() => {
  const destinations = {}
  filteredTrips.value.forEach(trip => {
    const dest = trip.destination || 'Unknown'
    destinations[dest] = (destinations[dest] || 0) + 1
  })

  const sorted = Object.entries(destinations)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)

  return {
    labels: sorted.map(([dest]) => dest),
    datasets: [{
      label: 'Trips',
      data: sorted.map(([, count]) => count),
      backgroundColor: [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#f5576c',
        '#4ecdc4',
        '#44a08d',
        '#f39c12',
        '#e74c3c',
        '#9b59b6',
        '#3498db'
      ]
    }]
  }
})

const revenueData = computed(() => {
  const isDaily = filterPeriod.value === 'weekly' || filterPeriod.value === 'monthly'
  const data = {}

  filteredTrips.value.forEach(trip => {
    const date = new Date(trip.date)
    let key

    if (isDaily) {
      // Group by day for weekly/monthly filters
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } else {
      // Group by month for all/yearly filters
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    const revenue = trip._total || 0
    data[key] = (data[key] || 0) + revenue
  })

  return {
    labels: Object.keys(data).sort().map(key => {
      if (isDaily) {
        const [year, month, day] = key.split('-')
        return new Date(year, month - 1, day).toLocaleString('default', { month: 'short', day: 'numeric' })
      } else {
        const [year, month] = key.split('-')
        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
      }
    }),
    datasets: [{
      label: 'Revenue (₱)',
      data: Object.keys(data).sort().map(key => data[key]),
      borderColor: '#27ae60',
      backgroundColor: 'rgba(39, 174, 96, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

const truckPerformanceData = computed(() => {
  const trucks = {}
  filteredTrips.value.forEach(trip => {
    const truck = trip.truckPlate || 'Unknown'
    trucks[truck] = (trucks[truck] || 0) + 1
  })

  return {
    labels: Object.keys(trucks),
    datasets: [{
      data: Object.values(trucks),
      backgroundColor: [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#f5576c',
        '#4ecdc4',
        '#44a08d',
        '#f39c12'
      ]
    }]
  }
})

const calculateTripRate = (trip) => {
  // Simple calculation based on destination and bags
  // In a real app, you'd reference the rates.json data
  const baseRate = 50 // fallback
  const perBagRate = 2
  return trip.numberOfBags * perBagRate + baseRate
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    },
    x: {
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    }
  }
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    },
    x: {
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    }
  }
}

const revenueOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context) => `₱${formatCurrency(context.parsed.y)}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.05)'
      },
      ticks: {
        callback: (value) => `₱${formatCurrency(value)}`
      }
    }
  }
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        usePointStyle: true
      }
    }
  }
}
</script>

<style scoped>
.dashboard-charts {
  width: 100%;
  margin-top: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.profit-card {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  color: white;
}

.stat-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.profit-card .stat-icon {
  opacity: 0.8;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.profit-card .stat-value {
  color: white;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.profit-card .stat-label {
  color: rgba(255,255,255,0.8);
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 2rem;
}

.chart-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 1.5rem;
}

.chart-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.chart-container {
  height: 300px;
  position: relative;
}

.recent-trips {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 1.5rem;
}

.recent-trips h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #333;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  justify-content: space-between;
}

.trip-code {
  font-weight: bold;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.trip-details {
  flex: 1;
  padding: 0 1rem;
}

.trip-details span {
  display: block;
  font-weight: 500;
  color: #333;
}

.trip-details small {
  color: #666;
  font-size: 0.8rem;
}

.trip-date {
  color: #666;
  font-size: 0.85rem;
  text-align: right;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.filters-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

/* Extra small devices (phones, < 576px) */
@media (max-width: 575.98px) {
  .dashboard-charts {
    margin-top: 0.5rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .charts-section {
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .chart-card {
    padding: 1rem;
  }

  .chart-container {
    height: 200px;
  }

  .recent-trips {
    padding: 1rem;
  }

  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .trip-details {
    padding: 0 0.5rem;
  }
}

/* Small devices (phones, 576px and up) */
@media (min-width: 576px) and (max-width: 767.98px) {
  .dashboard-charts {
    margin-top: 1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .charts-section {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  .chart-container {
    height: 250px;
  }

  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .trip-date {
    align-self: flex-end;
  }
}

/* Medium devices (tablets, 768px and up) */
@media (min-width: 768px) and (max-width: 991.98px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .charts-section {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-container {
    height: 280px;
  }
}

/* Large devices (desktops, 992px and up) */
@media (min-width: 992px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .charts-section {
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  }
}
</style>
