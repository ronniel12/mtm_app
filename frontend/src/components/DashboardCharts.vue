<template>
  <div class="dashboard-charts">
    <div class="dashboard-content">
      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <label class="filter-label">Report Period:</label>
          <select v-model="filterPeriod" @change="updateFilter" class="filter-select">
            <option value="all">All Time</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="yearly">This Year</option>
          </select>
        </div>
      </div>

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
          <h3>📈 Monthly Trip Performance</h3>
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
          <h3>💰 Monthly Revenue</h3>
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
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

const props = defineProps({
  trips: {
    type: Array,
    default: () => []
  },
  employees: {
    type: Array,
    default: () => []
  }
})

// Total counts (unchanging)
const activeEmployees = computed(() => props.employees.length)
const completedTrips = computed(() => props.trips.filter(t => t.status === 'Completed').length)

// Filtered data based on selected filters
const getDateRange = (filter) => {
  const now = new Date()
  let startDate

  switch (filter) {
    case 'weekly':
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
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
    return props.trips
  }

  const startDate = getDateRange(filterPeriod.value)
  return props.trips.filter(trip => {
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

const updateFilter = () => {
  // Just updates the computed properties
}

const recentTripsData = computed(() => {
  return [...props.trips].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
})

const monthlyTripsData = computed(() => {
  const months = {}
  props.trips.forEach(trip => {
    const date = new Date(trip.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    months[monthKey] = (months[monthKey] || 0) + 1
  })

  return {
    labels: Object.keys(months).sort().map(key => {
      const [year, month] = key.split('-')
      return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    }),
    datasets: [{
      label: 'Trips',
      data: Object.keys(months).sort().map(key => months[key]),
      borderColor: '#667eea',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

const destinationData = computed(() => {
  const destinations = {}
  props.trips.forEach(trip => {
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
  const months = {}
  props.trips.forEach(trip => {
    const date = new Date(trip.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const revenue = trip._total || 0
    months[monthKey] = (months[monthKey] || 0) + revenue
  })

  return {
    labels: Object.keys(months).sort().map(key => {
      const [year, month] = key.split('-')
      return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    }),
    datasets: [{
      label: 'Revenue (₱)',
      data: Object.keys(months).sort().map(key => months[key]),
      borderColor: '#27ae60',
      backgroundColor: 'rgba(39, 174, 96, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

const truckPerformanceData = computed(() => {
  const trucks = {}
  props.trips.forEach(trip => {
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
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 2rem;
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

@media (max-width: 768px) {
  .filters-section {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .filter-group {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .charts-section {
    grid-template-columns: 1fr;
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
</style>
