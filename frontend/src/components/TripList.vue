<template>
  <div class="trip-list">
    <div class="list-header">
      <h2>🚚 MTM ENTERPRISE Trip Receipts</h2>
      <div class="filters">
        <select v-model="dateFilter" @change="filterTrips">
          <option value="">All Trips</option>
          <option value="week">Trips this Week</option>
          <option value="month">Trips this Month</option>
          <option value="year">Trips this Year</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading trips...</div>

    <div v-else-if="filteredTrips.length === 0" class="no-data">
      No trips found
    </div>

    <!-- Desktop Table View -->
    <div v-else class="trips-table-container desktop-only">
      <table class="trips-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Plate #</th>
            <th>Invoice #</th>
            <th>Origin</th>
            <th>Destination</th>
            <th>Bags</th>
            <th>Rate/Unit</th>
            <th>Total</th>
            <th>Driver</th>
            <th>Helper</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="trip in filteredTrips"
            :key="trip.id"
            class="trip-row"
            @click="selectTrip(trip)"
            :class="{ selected: selectedTrip && selectedTrip.id === trip.id }"
          >
            <td class="date-cell">{{ formatDate(trip.date) }}</td>
            <td class="plate-cell">{{ trip.truckPlate }}</td>
            <td class="invoice-cell">{{ trip.invoiceNumber }}</td>
            <td class="origin-cell">{{ trip.origin }}</td>
            <td class="destination-cell">
              <div class="route-cell">
                <span class="route-text">{{ trip.fullDestination }}</span>
              </div>
            </td>
            <td class="bags-cell">{{ trip.numberOfBags || 0 }}</td>
            <td class="rate-cell">
              <div class="rate-container">
                <span :class="{ 'rate-display': trip._rateFound, 'rate-warning': !trip._rateFound }">
                  {{ trip._rate ? `₱${trip._rate}` : trip._rateStatus || '--' }}
                </span>
              </div>
            </td>
            <td class="total-cell">
              <span class="total-amount">₱{{ trip._total || 0 }}</span>
            </td>
            <td class="driver-cell">{{ trip.driverName }}</td>
            <td class="helper-cell">{{ trip.helperName }}</td>
            <td class="actions-cell">
              <button @click.stop="editTrip(trip)" class="btn-edit" title="Edit Trip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button @click.stop="deleteTrip(trip.id)" class="btn-delete" title="Delete Trip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <path d="M8 10l4 4"/>
                  <path d="M12 10l4 4"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View - Compact Design -->
    <div class="trips-mobile-cards mobile-only">
      <div
        v-for="trip in filteredTrips"
        :key="trip.id"
        class="trip-card-compact"
        @click="selectTrip(trip)"
        :class="{ selected: selectedTrip && selectedTrip.id === trip.id }"
      >
        <!-- Compact Header -->
        <div class="card-header-compact">
          <div class="primary-info">
            <span class="invoice-compact">{{ trip.invoiceNumber }}</span>
            <span class="plate-compact">{{ trip.truckPlate }}</span>
            <span class="bags-compact">{{ trip.numberOfBags || 0 }} bags</span>
          </div>
          <div class="total-compact">₱{{ trip._total || 0 }}</div>
        </div>

        <!-- Route Info -->
        <div class="route-compact">
          <div class="route-from">{{ trip.origin }}</div>
          <div class="route-arrow">→</div>
          <div class="route-to">{{ trip.fullDestination }}</div>
        </div>

        <!-- Secondary Info -->
        <div class="secondary-info">
          <div class="crew-info">
            <span class="driver-compact">{{ trip.driverName }}</span>
            <span class="helper-compact" v-if="trip.helperName">• {{ trip.helperName }}</span>
          </div>
          <div class="rate-info">
            <span class="rate-compact" :class="{ 'rate-display': trip._rateFound, 'rate-warning': !trip._rateFound }">
              {{ trip._rate ? `₱${trip._rate}` : '--' }}
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="card-actions-compact">
          <button @click.stop="editTrip(trip)" class="btn-edit-compact" title="Edit Trip">
            ✏️
          </button>
          <button @click.stop="deleteTrip(trip.id)" class="btn-delete-compact" title="Delete Trip">
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="totalPages > 1" class="pagination-container">
      <div class="pagination-info">
        Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalTrips) }} of {{ totalTrips }} trips
      </div>
      <div class="pagination-controls">
        <button
          @click="goToPreviousPage"
          :disabled="currentPage === 1"
          class="pagination-btn"
        >
          ← Previous
        </button>

        <div class="page-numbers">
          <button
            v-for="page in visiblePages || []"
            :key="page"
            @click="goToPage(page)"
            :class="{ active: page === currentPage }"
            class="page-number"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="goToNextPage"
          :disabled="currentPage === totalPages"
          class="pagination-btn"
        >
          Next →
        </button>
      </div>
    </div>

    <div v-if="selectedTrip" class="trip-details">
      <h3>📋 Trip Details</h3>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Tracking Number:</span>
          <span class="detail-value">{{ selectedTrip.trackingNumber }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Driver:</span>
          <span class="detail-value">{{ getEmployeeNameByUuid(selectedTrip.driver) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Helper:</span>
          <span class="detail-value">{{ selectedTrip.helper ? getEmployeeNameByUuid(selectedTrip.helper) : 'Not assigned' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Current Location:</span>
          <span class="detail-value">{{ selectedTrip.origin }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">ETA:</span>
          <span class="detail-value">{{ formatDate(selectedTrip.estimatedDelivery) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'

const trips = ref([])
const dateFilter = ref('')
const selectedTrip = ref(null)
const loading = ref(false)
const employees = ref([])

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)
const totalTrips = ref(0)
const totalPages = ref(0)

const emit = defineEmits(['tripSelected', 'tripEdit'])

onMounted(() => {
  fetchData()
})

const fetchData = async () => {
  loading.value = true
  try {
    const [tripsResponse, employeesResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/trips/calculated?page=${currentPage.value}&limit=${pageSize.value}`),
      axios.get(`${API_BASE_URL}/employees`)
    ])

    // Data is already fully processed by the API with pre-calculated rates, names, and destinations
    trips.value = tripsResponse.data.trips

    // No additional frontend processing needed - API already provides:
    // - driverName, helperName (pre-resolved)
    // - fullDestination (pre-computed)
    // - _rate, _total, _rateFound, _rateStatus (pre-calculated)

    // Update pagination metadata
    totalTrips.value = tripsResponse.data.pagination.total
    totalPages.value = tripsResponse.data.pagination.totalPages

    employees.value = employeesResponse.data
    // No need to calculate rates - already done on backend
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    loading.value = false
  }
}

const fetchTrips = fetchData



const filteredTrips = computed(() => {
  let filtered = trips.value

  if (!dateFilter.value) {
    // Sort all trips by date (newest first) when no filter applied
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const now = new Date()
  let startDate

  switch (dateFilter.value) {
    case 'week':
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      return trips.value
  }

  filtered = trips.value.filter(trip => {
    const tripDate = new Date(trip.date)
    return tripDate >= startDate
  })

  // Sort filtered results by date (newest first)
  return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Pagination computed properties
const visiblePages = computed(() => {
  if (totalPages.value <= 1) return []

  const pages = []
  const maxVisiblePages = 5
  const halfVisible = Math.floor(maxVisiblePages / 2)

  let startPage = Math.max(1, currentPage.value - halfVisible)
  let endPage = Math.min(totalPages.value, startPage + maxVisiblePages - 1)

  // Adjust start page if we're near the end
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return pages
})

const filterTrips = () => {
  // Reset to first page when filter changes
  currentPage.value = 1
  fetchData()
}

// Pagination functions
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    fetchData()
  }
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchData()
  }
}

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    fetchData()
  }
}

const selectTrip = (trip) => {
  selectedTrip.value = trip
  emit('tripSelected', trip)
}

const editTrip = (trip) => {
  emit('tripEdit', trip)
}

const deleteTrip = async (tripId) => {
    if (confirm('Are you sure you want to delete this trip?')) {
      try {
        await axios.delete(`${API_BASE_URL}/trips/${tripId}`)
        await fetchTrips()
        // Clear selected trip if it was deleted
        if (selectedTrip.value && selectedTrip.value.id === tripId) {
          selectedTrip.value = null
        }
      } catch (error) {
        console.error('Error deleting trip:', error)
      }
    }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  // Database now stores timestamps in local timezone (UTC+2)
  // Display as-is without additional timezone conversion
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getEmployeeNameByUuid = (uuid) => {
  if (!uuid) return 'Not assigned'
  const employee = employees.value.find(emp => emp.uuid === uuid)
  return employee ? employee.name : 'Unknown Employee'
}

const extractProvince = (destination) => {
  if (!destination) return ''
  // Simple province extraction from destination string
  const provinces = ['La Union', 'Pangasinan', 'Nueva Ecija', 'Zambales', 'Tarlac', 'Batangas', 'Quezon', 'Abra']
  for (let province of provinces) {
    if (destination.toLowerCase().includes(province.toLowerCase())) {
      return province
    }
  }
  return ''
}



// Build full address from farm data and destination
const buildFullAddress = (trip) => {
  if (!trip) return ''

  // If we have a full destination, use it
  if (trip.fullDestination) return trip.fullDestination

  // For existing trips, try to build from farm data and destination
  const farmData = getFarmData(trip.farmName)
  if (farmData && farmData.name) {
    return `${farmData.name}, ${farmData.barangay}, ${farmData.town}, ${farmData.province}`
  }

  // For trips where farmName is like "Town - Province" format but not a recognized farm,
  // try to construct a reasonable display
  if (trip.farmName && trip.farmName.includes(' - ')) {
    const parts = trip.farmName.split(' - ')
    if (parts.length === 2) {
      const town = parts[0].trim()
      const province = parts[1].trim()
      return `${town}, ${province}`
    }
  }

  // Fallback to simple destination or farmName as-is
  return trip.destination || trip.farmName || ''
}

// Helper function to get farm data (simplified from TripForm)
const getFarmData = (farmName) => {
  if (!farmName) return null

    // Complete farm database from trips.csv - ALL unique farms from columns F-I (Farm, Barangay, Town, Province)
    // Generated from every row in the CSV file (2025-01 entries only)
    const farmList = [
    { name: 'Dulay Poultry Farm', town: 'Aringay', province: 'La Union', barangay: 'Sitio Tagaytay, San Juan West' },
    { name: 'Casem Roberto C', town: 'Luna', province: 'La Union', barangay: 'Brgy. Tallaoen' },
    { name: 'Chickenville Corp A', town: 'Bauang', province: 'La Union', barangay: 'Brgy. Pugo' },
    { name: 'Chickenville Corp B', town: 'Bauang', province: 'La Union', barangay: 'Brgy. Pugo' },
    { name: 'Jorisan Poultry Farm B', town: 'Caba', province: 'La Union', barangay: 'Brgy. Sobredellio' },
    { name: 'Jorisan Poultry Farm C', town: 'Caba', province: 'La Union', barangay: 'Brgy. Sobredellio' },
    { name: 'Grow-in Grace Poultry Farms', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Basixtrading Corp. A', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Basixtrading Corp. B', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Chic2chic Corp.', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'BMJJ Farm / Jimeno, Luisito S', town: 'San Jacinto', province: 'Pangasinan', barangay: 'Sta. Cruz' },
    { name: 'Malingas Multi Purpose Cooperative', town: 'Malasiqui', province: 'Pangasinan', barangay: 'Brgy. Aliaga' },
    { name: 'G.O.T Farms B', town: 'Calasiao', province: 'Pangasinan', barangay: 'Macabito' },
    { name: 'MES Poultry Farm', town: 'Pozzorubio', province: 'Pangasinan', barangay: 'Sitio Limansangan District 1' },
    { name: 'RICA IVY Poultry Farm', town: 'Bugallon', province: 'Pangasinan', barangay: 'Brgy. Pangascasan' },
    { name: 'RAP-RAP Farms', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Fulgosino' },
    { name: 'Yona Enterprises A/Tambot Arnulfo', town: 'Manaoag', province: 'Pangasinan', barangay: 'Brgy. Babasit' },
    { name: '8NE Poultry Farm', town: 'Urbiztondo', province: 'Pangasinan', barangay: 'Gueteb' },
    { name: 'Fezecal Farms B', town: 'Mapandan', province: 'Pangasinan', barangay: 'Firetree Avenue Sitio Hilltop, Brgy. Luyan' },
    { name: 'BMJJ Farm', town: 'San Jacinto', province: 'Pangasinan', barangay: 'Sta. Cruz' },
    { name: 'PCPINILI Poultry Farm', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'PCPINILI Poultry Farm PCP1', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'PCPINILI Poultry Farm PCP2', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'PCPINILI Poultry Farm PCP3', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'Drakes Chicken', town: 'Guimba', province: 'Nueva Ecija', barangay: 'Brgy. Manacsac' },
    { name: 'CLUCK and WADDLE Farm Corp. A', town: 'Cuyapo', province: 'Nueva Ecija', barangay: 'Brgy. Cabatuan' },
    { name: 'TECHNOFARM Agri Services B', town: 'Cabiao', province: 'Nueva Ecija', barangay: 'San Roque' },
    { name: 'Brotherbond Farm', town: 'General Tinio', province: 'Nueva Ecija', barangay: 'Brgy. Poblacion West' },
    { name: 'RMCH Poultry Farm H', town: 'San Juan', province: 'Batangas', barangay: 'Brgy. Sampiro' },
    { name: 'Sycast Corporation B', town: 'San Jose', province: 'Batangas', barangay: 'Brgy. Sabang' },
    { name: 'Sycast Corporation A', town: 'San Jose', province: 'Batangas', barangay: 'Brgy. Sabang' },
    { name: 'Golden JDF Farming Corporation E', town: 'San Juan', province: 'Batangas', barangay: 'Sitio Iglesia' },
    { name: 'White Feather Ranch Agri Industrial Corporation D', town: 'Rosario', province: 'Batangas', barangay: 'Brgy. Colongan' },
    { name: 'Pearls 3A C5', town: 'Lucban', province: 'Quezon', barangay: 'Brgy. Kulapi' },
    { name: 'JMR Poultry Farm C', town: 'San Antonio', province: 'Quezon', barangay: 'Brgy. Sintorisan' },
    { name: 'Pearl 2 C5', town: 'Lucban', province: 'Quezon', barangay: 'Brgy. Kulapi' },
    { name: 'Jacade Farms', town: 'Sariaya', province: 'Quezon', barangay: 'Sitio Bignay' },
    { name: 'Egeneration Agri Corp B', town: 'Sariaya', province: 'Quezon', barangay: 'Brgy. Concepcion Uno' },
    { name: 'BCVALLES Farm Corp.', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy Bangantalinga' },
    { name: 'BCVALLES Farm Corp. -BCV7', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy Bangantalinga' },
    { name: 'PSP2 Farm Management Services', town: 'Castillejos', province: 'Zambales', barangay: 'Sitio Mawao, San Pablo' },
    { name: 'HHAR Poultry Farm', town: 'Sta. Cruz', province: 'Zambales', barangay: 'Brgy. Guisguis' },
    { name: 'PARAISO Poultry Farm', town: 'Iba', province: 'Zambales', barangay: 'Dirita Baloguen' },
    { name: 'Perissos Farmland Inc.', town: 'San Ildefonso', province: 'Bulacan', barangay: 'Brgy. Mataas na Parang' },
    { name: 'Jads Poultry Farm', town: 'San Miguel', province: 'Bulacan', barangay: 'Tartaro' },
    { name: 'POLO Sibul Eco Farm Inc. B', town: 'San Miguel', province: 'Bulacan', barangay: 'Sitio Madlum Sibul' },
    { name: 'Sanchez Meneses Broiler Chicken Farm B', town: 'San Ildefonso', province: 'Bulacan', barangay: 'Sta. Catalina Maranda' },
    { name: 'Bambino Broiler Farm B', town: 'San Miguel', province: 'Bulacan', barangay: 'Sitio Makabaklay' },
    { name: 'Raquel Santiago Poultry and Pigge', town: 'Limay', province: 'Bataan', barangay: 'Sitio Anahao, Upper Tundol, Brgy. Reformisa' },
    { name: 'Mark Jason Poultry Farm D', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasan, Brgy. Upper Bilolo' },
    { name: 'Mark Jason Poultry Farm E', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasan, Brgy. Upper Bilolo' },
    { name: 'Reyes Farm', town: 'Balanga City', province: 'Bataan', barangay: 'Brgy. Munting Batangas' },
    { name: 'Lipat Bahay', town: 'Tarlac City', province: 'Tarlac', barangay: 'Tarlac City' },
    { name: 'Mayantoc Agro-Industrial Corporation D', town: 'Mayantoc', province: 'Tarlac', barangay: 'Brgy. Mamomit' },
    { name: 'Mayantoc Agro-Industrial Corporation C', town: 'Mayantoc', province: 'Tarlac', barangay: 'Brgy. Mamomit' },
    { name: 'Mayantoc Farm C', town: 'Mayantoc', province: 'Tarlac', barangay: 'Brgy. Mamomit' },
    { name: 'Mabilang Farm', town: 'Paniqui', province: 'Tarlac', barangay: 'Mabilang' },
    { name: 'AGG-CT Holdings & Management Corp.', town: 'Urbiztondo', province: 'Pangasinan', barangay: 'Brgy. Pasibi West' },
    { name: 'Jacade Farms', town: 'Sariaya', province: 'Quezon', barangay: 'Sitio Bignay, Brgy. Concepcion, Pinagbakuran' },
    { name: 'Halca Farm A', town: 'Caba', province: 'La Union', barangay: 'Brgy. Juan Cartas' },
    { name: 'R.A Dumuk & Family Corporation', town: 'Naguilian', province: 'La Union', barangay: 'Brgy. Ambaracao Sur' },
    { name: 'RGAA Farm', town: 'Mangatarem', province: 'Pangasinan', barangay: 'Brgy. Malabobo' },
    { name: 'Vertam Farms OPC A', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Ricos' },
    { name: 'Vertam Farms OPC B', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Ricos' },
    { name: 'Vertam Farms OPC C', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Ricos' },
    { name: 'Vertam Farms OPC D', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Ricos' },
    { name: 'Vertam Farms OPC E', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Ricos' },
    { name: 'Triple D Golden Farms B', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Sta. Rosa' },
    { name: 'MNC', town: 'Pugo', province: 'La Union', barangay: 'Brgy. Palina' },
    { name: 'PCPINILI Poultry Farm PCP1', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'PCPINILI Poultry Farm PCP2', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'PCPINILI Poultry Farm PCP3', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'Yona Enterprises A/Tambot Arnulfo', town: 'Manaoag', province: 'Pangasinan', barangay: 'Brgy. Babasit' },
    { name: 'RICA IVY Poultry Farm', town: 'Bugallon', province: 'Pangasinan', barangay: 'Brgy. Pangascasan' },
    { name: 'CLUCK and WADDLE Farm Corp. A', town: 'Cuyapo', province: 'Nueva Ecija', barangay: 'Brgy. Cabatuan' },
    { name: 'BCVALLES Farm Corp. -BCV7', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy Bangantalinga' },
    { name: 'BCVALLES Farm Corp.-BCV9', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy Bangantalinga' },
    { name: 'PCPINILI Poultry Farm PCP2', town: 'Munoz', province: 'Nueva Ecija', barangay: 'Brgy. Mangandingay' },
    { name: 'J.V.P. Farm A', town: 'Malasiqui', province: 'Pangasinan', barangay: 'Brgy. Lunec' },
    { name: 'Cluck and Waddle Farm Corp. B', town: 'Cuyapo', province: 'Nueva Ecija', barangay: 'Brgy. Cabatuan' },
    { name: 'JMP Farm B', town: 'Cuyapo', province: 'Nueva Ecija', barangay: 'Brgy. Sta. Cruz' },
    { name: 'Chic2Chic Corp.', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Galilee Poultry Farm', town: 'Umingan', province: 'Pangasinan', barangay: 'Capas' },
    { name: 'G.O.T Farm A', town: 'Calasiao', province: 'Pangasinan', barangay: 'Macabito' },
    { name: 'BTR Farms Inc', town: 'Sta. Cruz', province: 'Zambales', barangay: 'Mabiongbiong, Guinabon' },
    { name: 'Mark Jason Poultry Farm D', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasan, Brgy. Upper Bilolo' },
    { name: 'White Feather Ranch Agri Industrial Corporation D', town: 'Rosario', province: 'Batangas', barangay: 'Brgy. Colongan' },
    { name: 'JMR Poultry Farm D', town: 'San Antonio', province: 'Quezon', barangay: 'Brgy. Sintorisan' },
    { name: 'RAP RAP Farms', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Pulgosino' },
    { name: 'Halca Farm A', town: 'Caba', province: 'La Union', barangay: 'Brgy. Juan Cartas' },
    { name: 'GG Poultry Farm', town: 'Umingan', province: 'Pangasinan', barangay: 'Galilee' },
    { name: 'Jordan Valley Poultry Farm A', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Prado' },
    { name: 'BAXIX Trading Corp. B', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Cornerstone A Gro-Industrial Agricultural Corporation', town: 'Bautista', province: 'Pangasinan', barangay: 'Brgy. Pugo' },
    { name: 'Arkada Bird`s Nest Poultry Farm Corp. B', town: 'Pantabangan', province: 'Nueva Ecija', barangay: 'Brgy. Ganduz' },
    { name: 'Liors Poultry Farm B', town: 'Mangatarem', province: 'Pangasinan', barangay: 'Tococ Barikir' },
    { name: 'JPP Poultry Farm B', town: 'Bauang', province: 'La Union', barangay: 'Brgy. Pugo' },
    { name: 'R A Dumuk & Family Corporation', town: 'Naguilian', province: 'La Union', barangay: 'Brgy. Ambaracao Sur' },
    { name: 'Halca Farm B', town: 'Caba', province: 'La Union', barangay: 'Brgy. Juan Cartas' },
    { name: 'AGG-CT Holdings & Management Corp. B', town: 'Urbiztondo', province: 'Pangasinan', barangay: 'Brgy. Pasibi West' },
    { name: 'Horseman World Ventures Corporation A', town: 'Bugallon', province: 'Pangasinan', barangay: 'Salomague Sur' },
    { name: 'BCV5 C2', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy, Bangantalinga' },
    { name: '3NE Poultry Farm A', town: 'Urbiztondo', province: 'Pangasinan', barangay: 'Gueteb' },
    { name: 'BCVC C2', town: 'Iba', province: 'Zambales', barangay: 'Sitio Oploy Bangantuanga' },
    { name: 'IPSP2 4 C2', town: 'Castillejos', province: 'Zambales', barangay: 'Sitio Mawao, San Pablo' },
    { name: 'Mark Jason Poultry Farm E', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasan, Brgy. Upper Bilolo' },
    { name: 'PBF3 C1', town: 'Iba', province: 'Zambales', barangay: 'Brgy. Sta. Barbara' },
    { name: 'AGG-CT Holdings & Management Corp. B', town: 'Urbiztondo', province: 'Pangasinan', barangay: 'Brgy. Pasibi West' },
    { name: 'JMTR Tenant Broiler Chicken Farm A', town: 'Mangatarem', province: 'Pangasinan', barangay: 'Brgy. Cabaluyan 2nd' },
    { name: 'JMTR Tenant Broiler Chicken Farm B', town: 'Mangatarem', province: 'Pangasinan', barangay: 'Brgy. Cabaluyan 2nd' },
    { name: 'Triple D Golden Farms E', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Sta. Rosa' },
    { name: 'G.O.T. Farms B', town: 'Calasiao', province: 'Pangasinan', barangay: 'Macabito' },
    { name: 'Ohana Farm B', town: 'Bugallon', province: 'Pangasinan', barangay: 'Brgy. Laguit, Padilla' },
    { name: 'MKA Poultry Farm C', town: 'Bautista', province: 'Pangasinan', barangay: 'Brgy. Pugo' },
    { name: 'IPSP2 3 C2', town: 'Castillejos', province: 'Zambales', barangay: 'Sitio Mawao, San Pablo' },
    { name: 'PBF4 C1', town: 'Iba', province: 'Zambales', barangay: 'Brgy. Sta. Barbara' },
    { name: 'Cita`s Farm & Livestock Corporation B', town: 'Mangatarem', province: 'Pangasinan', barangay: 'Brgy. Sapang' },
    { name: 'Triple D Golden Farm (D)', town: 'Umingan', province: 'Pangasinan', barangay: 'Brgy. Sta. Rosa' },
    { name: 'Ohana Farm A', town: 'Bugallon', province: 'Pangasinan', barangay: 'Brgy. Laguit, Padilla' },
    { name: 'IPCadfarms', town: 'Urdaneta', province: 'Pangasinan', barangay: 'Sitio Alcapa' },
    { name: 'PBF2 C1', town: 'Iba', province: 'Zambales', barangay: 'Brgy. Sta. Barbara' }
  ]

  return farmList.find(farm =>
    farm.name.toLowerCase().includes(farmName.toLowerCase())
  )
}

// Clean up unused functions - calculations now handled in calculateRatesForTrips

defineExpose({
  fetchTrips
})
</script>

<style scoped>
.trip-list {
  width: 100%;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.list-header h2 {
  margin: 0;
  color: #333;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.shipments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.shipment-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.shipment-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-color: #667eea;
}

.card-header {
  margin-bottom: 1rem;
}

.tracking {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tracking-number {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

/* Enhanced table styles */
.trips-table-container {
  overflow-x: auto;
  margin-top: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.trips-table {
  width: 100%;
  min-width: 1200px;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  font-size: 0.85rem;
}

.trips-table th {
  background: #f8f9fa;
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}

.trips-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid #dee2e6;
  vertical-align: middle;
}

.trip-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.trip-row:hover {
  background: #f8f9fa;
}

.trip-row.selected {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

.bags-input {
  width: 60px;
  padding: 0.25rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  text-align: center;
  font-size: 0.8rem;
}

.rate-display, .total-amount {
  color: #28a745;
  font-weight: 600;
}

.rate-warning {
  color: #dc3545;
  font-style: italic;
  font-weight: 600;
}

.origin-cell, .destination-cell {
  min-width: 150px;
  max-width: 200px;
  word-wrap: break-word;
}

.invoice-cell {
  min-width: 120px;
  white-space: nowrap;
}

.plate-cell {
  min-width: 80px;
  white-space: nowrap;
}

.driver-cell, .helper-cell {
  min-width: 100px;
  max-width: 150px;
  word-wrap: break-word;
}

.total-cell {
  font-weight: bold;
}

.trip-details {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.detail-label {
  font-weight: 600;
  color: #666;
}

.detail-value {
  font-weight: 500;
  color: #333;
  text-align: right;
}

.btn-edit, .btn-delete {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit svg {
  color: #007bff;
  fill: none;
  stroke: #007bff;
}

.btn-edit:hover svg {
  color: #0056b3;
  stroke: #0056b3;
}

.btn-delete svg {
  color: #dc3545;
  fill: none;
  stroke: #dc3545;
}

.btn-delete:hover svg {
  color: #c82333;
  stroke: #c82333;
}

/* Status colors */
.status-label.pending {
  background: #fff3cd;
  color: #856404;
}

.status-label.in-transit {
  background: #cce5ff;
  color: #0066cc;
}

.status-label.completed {
  background: #d4edda;
  color: #155724;
}

.status-label {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
  min-width: 80px;
  text-align: center;
}

.card-body {
  margin-bottom: 1rem;
}

.route {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.location {
  flex: 1;
  text-align: center;
}

.location:not(:last-child) {
  margin-right: 0.5rem;
}

.label {
  font-size: 0.8rem;
  color: #666;
  display: block;
  margin-bottom: 4px;
}

.value {
  font-weight: 500;
  color: #333;
}

.arrow {
  color: #667eea;
  font-size: 1.2rem;
  margin: 0 1rem;
}

.details {
  margin-bottom: 1rem;
}

.detailsparty {
  margin-bottom: 0.5rem;
}

.meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #666;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.btn-edit {
  background: #ffc107;
  color: #212529;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #e0a800;
}

.btn-delete {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.btn-delete:hover {
  background: #c82333;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

/* Pagination styles */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.pagination-info {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  background: white;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
  margin: 0 0.5rem;
}

.page-number {
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  background: white;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  min-width: 40px;
  text-align: center;
  transition: all 0.2s;
}

.page-number:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.page-number.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

/* Mobile Card Styles */
.trips-mobile-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-top: 1rem;
}

/* Compact Mobile Card Design */
.trip-card-compact {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  position: relative;
}

.trip-card-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.trip-card-compact.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

/* Compact Header */
.card-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
}

.primary-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.invoice-compact {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.plate-compact {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}

.bags-compact {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 400;
}

.total-compact {
  font-size: 1.1rem;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
}

/* Route Information */
.route-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #fafafa;
  border-bottom: 1px solid #f1f5f9;
}

.route-from, .route-to {
  flex: 1;
  font-size: 0.85rem;
  color: #475569;
  font-weight: 500;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-from {
  text-align: left;
}

.route-to {
  text-align: right;
}

.route-arrow {
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 600;
  margin: 0 0.5rem;
  flex-shrink: 0;
}

/* Secondary Information */
.secondary-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
}

.crew-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #475569;
  font-weight: 500;
}

.driver-compact {
  color: #1e293b;
}

.helper-compact {
  color: #64748b;
}

.rate-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.rate-compact {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.rate-compact.rate-display {
  color: #059669;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.rate-compact.rate-warning {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

/* Compact Actions */
.card-actions-compact {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.trip-card-compact:hover .card-actions-compact {
  opacity: 1;
}

.btn-edit-compact, .btn-delete-compact {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-edit-compact {
  background: #fef3c7;
  color: #d97706;
}

.btn-edit-compact:hover {
  background: #fde68a;
  transform: scale(1.1);
}

.btn-delete-compact {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete-compact:hover {
  background: #fecaca;
  transform: scale(1.1);
}

/* Legacy Mobile Card Styles (keeping for reference) */
.trip-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}

.trip-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.trip-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.invoice-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.date {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-edit-mobile, .btn-delete-mobile {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s ease;
}

.btn-edit-mobile {
  background: #fef3c7;
  color: #d97706;
}

.btn-edit-mobile:hover {
  background: #fde68a;
  transform: scale(1.05);
}

.btn-delete-mobile {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete-mobile:hover {
  background: #fecaca;
  transform: scale(1.05);
}

.card-body {
  padding: 1.25rem;
}

.card-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.card-row:last-child {
  margin-bottom: 0;
}

.card-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-field.full-width {
  flex: 1 1 100%;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-value {
  font-size: 0.9rem;
  color: #1e293b;
  font-weight: 500;
  word-break: break-word;
}

.field-value.total-amount {
  color: #059669;
  font-weight: 700;
  font-size: 1rem;
}

.field-value.rate-display {
  color: #059669;
  font-weight: 600;
}

.field-value.rate-warning {
  color: #dc2626;
  font-style: italic;
}

/* Responsive Design */
@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }

  .list-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .filters {
    align-self: flex-start;
  }

  .pagination-container {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .pagination-controls {
    justify-content: center;
  }
}

@media (min-width: 769px) {
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }
}
</style>
