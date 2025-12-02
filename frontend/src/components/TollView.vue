<template>
  <div class="toll-view">
    <div class="view-header">
      <h2>🛤️ Toll Management</h2>
      <p>Track toll fees for trips and manage expenses</p>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      Loading toll data...
    </div>

    <div v-else-if="trips.length === 0" class="no-data">
      No trips available for toll tracking
    </div>

    <!-- Toll Controls - Moved outside table container for proper sticky behavior -->
    <div
      class="toll-controls"
      :style="{ left: tollControlsPosition.x + 'px', top: tollControlsPosition.y + 'px' }"
      @mousedown="startTollControlsDrag"
      @touchstart="startTollControlsDrag"
    >
      <div class="control-group">
        <button @click="calculateTollsForTrips()" class="btn-calculate-selected">
          Calculate All Tolls
        </button>
        <button @click="checkForDuplicates(trips)" class="btn-calculate-selected" style="background: #17a2b8;">
          Check for Duplicates
        </button>
      </div>
    </div>

    <div class="toll-table-container">
      <table class="toll-table">
       <thead>
         <tr>
           <th class="checkbox-column">
             <input
               type="checkbox"
               :checked="allSelected"
               @change="toggleSelectAll"
               class="header-checkbox"
             />
             <button
               v-if="calculatingSelected"
               @click="isPaused ? resumeCalculation() : stopCalculation()"
               class="btn-stop-resume"
               :title="isPaused ? 'Resume calculation' : 'Stop calculation'"
             >
               {{ isPaused ? '▶️' : '⏹️' }}
             </button>
           </th>
           <th class="date-header">Date</th>
           <th>Invoice #</th>
           <th>Plate #</th>
           <th>Origin</th>
           <th>Full Destination</th>
           <th>Computed Toll Fee</th>
           <th>Roundtrip</th>
           <th>Actual Toll</th>
           <th>Variance</th>
         </tr>
       </thead>
        <tbody>
          <tr
            v-for="trip in trips"
            :key="trip.id"
            class="toll-row"
          >
            <td class="checkbox-column">
              <input
                type="checkbox"
                :checked="selectedTrips.includes(trip.id)"
                @change="toggleTripSelection(trip.id)"
                class="row-checkbox"
              />
            </td>
            <td class="date-cell">{{ formatDate(trip.date) }}</td>
            <td class="invoice-cell">{{ trip.invoiceNumber }}</td>
            <td class="plate-cell">{{ trip.truckPlate }}</td>
            <td class="origin-cell">{{ trip.origin }}</td>
            <td class="destination-cell">{{ trip.fullDestination || buildFullAddress(trip) }}</td>
            <td class="computed-cell">
              <div class="toll-amount">
                <div v-if="trip._allRoutes && trip._allRoutes.length > 1" class="route-selector">
                  <select
                    :value="trip._selectedRouteIndex || 0"
                    @change="selectRouteForTrip(trip.id, parseInt($event.target.value))"
                    class="route-select"
                  >
                    <option
                      v-for="(route, index) in trip._allRoutes"
                      :key="index"
                      :value="index"
                    >
                      Route {{ index + 1 }}: ₱{{ route.toll }} ({{ Math.round(route.distance / 1000) }}km, {{ Math.round(route.duration / 60) }}min)
                    </option>
                  </select>
                </div>
                <div v-else>
                  <span v-if="trip.computedToll !== undefined && trip.computedToll > 0">₱{{ trip.computedToll }}</span>
                  <span v-else-if="trip._computedToll !== undefined">₱{{ trip._computedToll }}</span>
                  <span v-else-if="trip._calculatingToll" class="loading-toll">Calculating...</span>
                  <span v-else-if="trip._tollError" class="error-toll" title="trip._tollError">Error</span>
                  <span v-else class="no-toll">--</span>
                </div>
              </div>
            </td>
            <td class="roundtrip-cell">
              <div class="toll-amount">
                ₱<input
                  type="number"
                  step="0.01"
                  min="0"
                  :value="trip.roundtripToll || (trip._computedToll ? (trip._computedToll * 2).toFixed(2) : '')"
                  @input="updateRoundtripToll(trip.id, $event.target.value)"
                  @blur="saveRoundtripToll(trip.id)"
                  class="toll-input-inline"
                  placeholder="Auto: 2x computed"
                />
              </div>
            </td>
            <td class="actual-cell">
              <div class="toll-amount">
                ₱<input
                  type="number"
                  step="0.01"
                  min="0"
                  :value="trip.actualTollExpense || ''"
                  @input="updateActualToll(trip.id, $event.target.value)"
                  @paste="handleTollPaste($event, trip.id, 'actual')"
                  @blur="saveActualToll(trip.id)"
                  class="toll-input-inline"
                  placeholder="Actual Toll"
                />
              </div>
            </td>
            <td class="variance-cell">
              <span
                v-if="trip.roundtripToll !== undefined && trip.actualTollExpense"
                :class="getVarianceClass(trip.roundtripToll, trip.actualTollExpense)"
              >
                ₱{{ calculateVariance(trip.roundtripToll, trip.actualTollExpense) }}
              </span>
              <span v-else class="no-variance">--</span>
            </td>
          </tr>
        </tbody>
      </table>
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
            v-for="page in visiblePages"
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

    <!-- Draggable Duplicate Confirmation Notifications -->
    <div
      v-if="pendingConfirmations.length > 0"
      class="duplicate-notifications"
      :style="{ left: modalPosition.x + 'px', top: modalPosition.y + 'px' }"
    >
      <!-- Draggable Header -->
      <div
        class="modal-header"
        @mousedown="startDrag"
        @touchstart="startDrag"
      >
        <h4>🚨 Duplicate Trip Alerts ({{ pendingConfirmations.length }})</h4>
      </div>

      <!-- Sticky Action Buttons -->
      <div class="sticky-actions">
        <button @click="mergeAllDuplicates" class="btn-merge-all-sticky" title="Merge All as Single Trips">
          🔗 Merge All
        </button>
        <button @click="keepAllSeparate" class="btn-separate-all-sticky" title="Keep All Separate">
          ✖️ Keep Separate
        </button>
        <button @click="dismissAllAlerts" class="btn-dismiss-all-sticky" title="Dismiss All Alerts">
          ✕ Dismiss All
        </button>
        <button @click="closeAllModals" class="btn-close-sticky" title="Close Modal">
          ×
        </button>
      </div>

      <div v-for="group in pendingConfirmations" :key="group.id" class="duplicate-alert">
        <div class="alert-content">
          <h4>🚨 Potential Duplicate Trips Detected</h4>
          <p>{{ group.trips.length }} trips with same date and destination found.</p>

          <!-- Group Summary -->
          <div class="group-summary">
            <div class="summary-row">
              <strong>Date:</strong> {{ formatDate(group.trips[0].date) }}
            </div>
            <div class="summary-row">
              <strong>Destination:</strong> {{ extractTollDestination(group.trips[0]) }}
            </div>
            <div class="summary-row">
              <strong>Total Bags:</strong> {{ group.trips.reduce((sum, trip) => sum + (trip.numberOfBags || 0), 0) }}
            </div>
          </div>

          <!-- Trip Details -->
          <div class="trip-details-container">
            <div class="trip-details-header">
              <span>Invoice #</span>
              <span>Farm Name</span>
              <span>Truck Plate</span>
              <span>Bags</span>
            </div>
            <div class="trip-details-list">
              <div v-for="trip in group.trips" :key="trip.id" class="trip-detail-item">
                <span class="invoice">{{ trip.invoiceNumber }}</span>
                <span class="farm" :title="trip.farmName">{{ trip.farmName || 'N/A' }}</span>
                <span class="plate">{{ trip.truckPlate }}</span>
                <span class="bags">{{ trip.numberOfBags || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="alert-actions">
            <button @click="mergeDuplicates(group)" class="btn-merge">
              Merge as Single Trip
            </button>
            <button @click="keepSeparate(group)" class="btn-separate">
              Keep Separate
            </button>
            <button @click="dismissAlert(group)" class="btn-dismiss">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Section -->
    <div v-if="trips.length > 0" class="toll-summary">
      <h3>Toll Summary</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Total Computed One Way Toll:</span>
          <span class="summary-value">₱{{ totalComputedTolls }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Roundtrip Toll:</span>
          <span class="summary-value">₱{{ totalRoundtripTolls }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Actual Expenses:</span>
          <span class="summary-value">₱{{ totalActualExpenses }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Variance:</span>
          <span class="summary-value" :class="totalVarianceClass">₱{{ totalVariance }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Trips with Data:</span>
          <span class="summary-value">{{ tripsWithData }}/{{ trips.length }}</span>
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
const loading = ref(false)
const selectedTrips = ref([])
const calculatingSelected = ref(false)
const isPaused = ref(false)
const isStopped = ref(false)
const serverWasUnavailable = ref(false)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)
const totalTrips = ref(0)
const totalPages = ref(0)

// Duplicate detection state
const duplicateGroups = ref([])
const pendingConfirmations = ref([])
const confirmedDuplicates = ref(new Set())

// Draggable modal state
const modalPosition = ref({ x: window.innerWidth - 470, y: 20 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// Draggable toll controls state
const tollControlsPosition = ref({ x: window.innerWidth / 2, y: 140 })
const isDraggingTollControls = ref(false)
const tollControlsDragOffset = ref({ x: 0, y: 0 })

// Fetch trips data with pagination
const fetchTrips = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE_URL}/trips/calculated?page=${currentPage.value}&limit=${pageSize.value}`)
    // Map database snake_case fields to camelCase for component use
    trips.value = response.data.trips.map(trip => ({
      ...trip,
      truckPlate: trip.truck_plate || trip.truckPlate,
      invoiceNumber: trip.invoice_number || trip.invoiceNumber,
      numberOfBags: trip.number_of_bags || trip.numberOfBags,
      fullDestination: trip.full_destination || trip.fullDestination || trip.destination
    }))

    // Update pagination metadata
    totalTrips.value = response.data.pagination.total
    totalPages.value = response.data.pagination.totalPages

    // Don't calculate tolls automatically on load
  } catch (error) {
    console.error('Error fetching trips:', error)
  } finally {
    loading.value = false
  }
}

// Calculate tolls for all trips using external API
const calculateTollsForTrips = async () => {
  // First check for duplicates
  checkForDuplicates(trips.value);

  // Calculate tolls only for trips that aren't pending confirmation
  const tripsToCalculate = trips.value.filter(trip =>
    !trip.duplicateStatus || trip.duplicateStatus === 'separate'
  );

  for (const trip of tripsToCalculate) {
    await calculateTollForTrip(trip);
  }
}

// Calculate toll for a single trip
const calculateTollForTrip = async (trip) => {
  if (!trip.origin || !trip.fullDestination) return

  trip._calculatingToll = true
  try {
    // Extract town and province for better geocoding
    const destination = extractTollDestination(trip)
    const town = extractTownForTollMatching(trip)

    // Call external toll API - replace with actual API endpoint
    const response = await axios.post(`${API_BASE_URL}/tolls/calculate`, {
      origin: trip.origin,
      destination: destination,
      town: town, // Send town name for plaza matching
      date: trip.date,
      vehicleClass: trip.vehicleClass || '2'
    })

    // Store all routes
    trip._allRoutes = response.data.routes || []

    // Default to the fastest route, or first route with tolls if no fastest route
    if (!trip._selectedRouteIndex && trip._allRoutes.length > 1) {
      // First try to find the fastest route
      const fastestRouteIndex = trip._allRoutes.findIndex(route => route.optimization === 'fastest');
      if (fastestRouteIndex !== -1) {
        trip._selectedRouteIndex = fastestRouteIndex;
      } else {
        // Fallback to first route with tolls
        const tollRouteIndex = trip._allRoutes.findIndex(route => route.toll > 0);
        trip._selectedRouteIndex = tollRouteIndex !== -1 ? tollRouteIndex : 0;
      }
    } else {
      trip._selectedRouteIndex = trip._selectedRouteIndex || 0;
    }

    // Set the computed toll to the selected route
    const selectedRoute = trip._allRoutes[trip._selectedRouteIndex] || trip._allRoutes[0]
    trip._computedToll = selectedRoute ? selectedRoute.toll : 0

    // Automatically save the computed toll to the database
    if (trip._computedToll > 0) {
      saveComputedToll(trip.id)

      // Also automatically set and save the roundtrip toll (2x computed toll)
      trip.roundtripToll = trip._computedToll * 2
      saveRoundtripToll(trip.id)
    }
  } catch (error) {
    console.error('Error calculating toll for trip:', trip.id, error)
    // If server is unavailable, stop the entire calculation process and clear selections
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || !error.response) {
      isStopped.value = true
      isPaused.value = false
      serverWasUnavailable.value = true
      selectedTrips.value = [] // Clear all selections when server is down
    }
    // Don't set _computedToll when there's an error - let it remain undefined
    // so the error state is properly displayed
    trip._tollError = error.response?.data?.error || 'Failed to calculate toll'
    trip._allRoutes = []
  } finally {
    trip._calculatingToll = false
  }
}

// Recalculate toll for a specific trip
const recalculateToll = async (trip) => {
  await calculateTollForTrip(trip)
}

// Helper function to clean currency input values
const cleanCurrencyInput = (value) => {
  if (!value) return ''

  let cleaned = value.toString()
    .replace(/[₱$€£¥₹₽₩₦₨₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '') // Remove currency symbols
    .replace(/\s+/g, '') // Remove extra spaces
    .trim()

  // Handle different number formats
  // If there's a comma and a period, assume comma is thousands separator and period is decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Remove commas (thousands separators)
    cleaned = cleaned.replace(/,/g, '')
  }
  // If there's only a comma at the end (European decimal), convert to period
  else if (cleaned.includes(',') && !cleaned.includes('.') && cleaned.split(',')[1] && cleaned.split(',')[1].length <= 2) {
    cleaned = cleaned.replace(',', '.')
  }
  // If there's only commas (thousands separators), remove them
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '')
  }

  return cleaned
}

// Update roundtrip toll
const updateRoundtripToll = (tripId, value) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (trip) {
    const cleanedValue = cleanCurrencyInput(value)
    trip.roundtripToll = parseFloat(cleanedValue) || 0
  }
}

// Save computed toll to backend
const saveComputedToll = async (tripId) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (!trip || trip._computedToll === undefined) return

  try {
    await axios.put(`${API_BASE_URL}/trips/${tripId}`, {
      computedToll: trip._computedToll
    })
  } catch (error) {
    console.error('Error saving computed toll:', error)
  }
}

// Save roundtrip toll to backend
const saveRoundtripToll = async (tripId) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (!trip) return

  try {
    await axios.put(`${API_BASE_URL}/trips/${tripId}`, {
      roundtripToll: trip.roundtripToll
    })
    // Show success feedback
  } catch (error) {
    console.error('Error saving roundtrip toll:', error)
    // Could add user notification here
  }
}



// Handle paste events for toll inputs to properly parse currency values
const handleTollPaste = (event, tripId, field) => {
  event.preventDefault() // Prevent default paste behavior

  // Get the raw clipboard data
  const clipboardData = event.clipboardData || window.clipboardData
  const pastedText = clipboardData.getData('text')

  // Clean the pasted value
  const cleanedValue = cleanCurrencyInput(pastedText)
  const numericValue = parseFloat(cleanedValue) || 0

  // Update the trip data
  const trip = trips.value.find(t => t.id === tripId)
  if (trip) {
    if (field === 'actual') {
      trip.actualTollExpense = numericValue
      // Auto-save
      saveActualToll(tripId)
    } else if (field === 'roundtrip') {
      trip.roundtripToll = numericValue
      // Auto-save
      saveRoundtripToll(tripId)
    }
  }

  // Update the input field value
  event.target.value = numericValue
}

// Update actual toll expense
const updateActualToll = (tripId, value) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (trip) {
    const cleanedValue = cleanCurrencyInput(value)
    trip.actualTollExpense = parseFloat(cleanedValue) || 0
  }
}

// Save actual toll expense to backend
const saveActualToll = async (tripId) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (!trip) return

  try {
    await axios.put(`${API_BASE_URL}/trips/${tripId}`, {
      actualTollExpense: trip.actualTollExpense
    })
    // Show success feedback
  } catch (error) {
    console.error('Error saving actual toll expense:', error)
    // Could add user notification here
  }
}

// Update vehicle class
const updateVehicleClass = async (tripId, vehicleClass) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (!trip) return

  const oldClass = trip.vehicleClass
  trip.vehicleClass = vehicleClass

  try {
    await axios.put(`${API_BASE_URL}/trips/${tripId}`, {
      vehicleClass: vehicleClass
    })
    // Recalculate toll when vehicle class changes
    await calculateTollForTrip(trip)
  } catch (error) {
    console.error('Error saving vehicle class:', error)
    // Revert on error
    trip.vehicleClass = oldClass
  }
}

// Select route for a trip
const selectRouteForTrip = (tripId, routeIndex) => {
  const trip = trips.value.find(t => t.id === tripId)
  if (!trip || !trip._allRoutes || !trip._allRoutes[routeIndex]) return

  trip._selectedRouteIndex = routeIndex
  trip._computedToll = trip._allRoutes[routeIndex].toll

  // Save the computed toll to database
  saveComputedToll(tripId)
}

// Calculate variance between actual and roundtrip toll
const calculateVariance = (roundtrip, actual) => {
  const variance = parseFloat(actual) - parseFloat(roundtrip)
  return Math.abs(variance).toFixed(2)
}

// Get variance class for styling
const getVarianceClass = (roundtrip, actual) => {
  const variance = parseFloat(actual) - parseFloat(roundtrip)
  if (variance < 0) return 'variance-savings' // Actual < roundtrip = bright green (savings)
  if (variance > 0) return 'variance-overrun' // Actual > roundtrip = red (overrun)
  return 'variance-zero'
}


// Computed properties for summary
const totalComputedTolls = computed(() => {
  return trips.value.reduce((sum, trip) => sum + (parseFloat(trip.computedToll) || parseFloat(trip._computedToll) || 0), 0).toFixed(2)
})

const totalActualExpenses = computed(() => {
  return trips.value.reduce((sum, trip) => sum + (parseFloat(trip.actualTollExpense) || 0), 0).toFixed(2)
})

const totalRoundtripTolls = computed(() => {
  return trips.value.reduce((sum, trip) => sum + (parseFloat(trip.roundtripToll) || 0), 0).toFixed(2)
})

const totalVariance = computed(() => {
  return trips.value.reduce((sum, trip) => {
    const roundtrip = parseFloat(trip.roundtripToll) || 0
    const actual = parseFloat(trip.actualTollExpense) || 0
    if (roundtrip && actual) {
      return sum + (actual - roundtrip)
    }
    return sum
  }, 0).toFixed(2)
})

const totalVarianceClass = computed(() => {
  const variance = parseFloat(totalVariance.value)
  if (variance > 0) return 'variance-overrun' // Cost overrun = red
  if (variance < 0) return 'variance-savings' // Cost savings = green
  return 'variance-zero'
})

const tripsWithData = computed(() => {
  return trips.value.filter(trip => (trip.computedToll || trip._computedToll) || trip.actualTollExpense).length
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

// Selection functionality
const allSelected = computed(() => {
  return trips.value.length > 0 && selectedTrips.value.length === trips.value.length
})

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedTrips.value = []
  } else {
    selectedTrips.value = trips.value.map(trip => trip.id)
    // Auto-calculate tolls when all are selected (only if server wasn't previously unavailable)
    if (!serverWasUnavailable.value) {
      calculateSelectedTolls()
    }
  }
}

const toggleTripSelection = (tripId) => {
  const index = selectedTrips.value.indexOf(tripId)
  if (index > -1) {
    selectedTrips.value.splice(index, 1)
  } else {
    selectedTrips.value.push(tripId)
  }
  // Auto-calculate tolls when selection changes (only if server wasn't previously unavailable)
  if (selectedTrips.value.length > 0 && !serverWasUnavailable.value) {
    calculateSelectedTolls()
  }
}

const calculateSelectedTolls = async () => {
  if (selectedTrips.value.length === 0 || isStopped.value) return

  calculatingSelected.value = true
  isPaused.value = false
  isStopped.value = false

  try {
    // Calculate tolls for selected trips
    for (const tripId of selectedTrips.value) {
      // Check if calculation was stopped or paused
      if (isStopped.value) break
      if (isPaused.value) {
        // Wait until resumed
        while (isPaused.value && !isStopped.value) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        if (isStopped.value) break
      }

      const trip = trips.value.find(t => t.id === tripId)
      if (trip) {
        await calculateTollForTrip(trip)
      }
    }
  } catch (error) {
    console.error('Error calculating selected tolls:', error)
  } finally {
    calculatingSelected.value = false
    isPaused.value = false
  }
}

// Stop calculation
const stopCalculation = () => {
  isStopped.value = true
  isPaused.value = false
}

// Resume calculation
const resumeCalculation = () => {
  isPaused.value = false
}

// Helper functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

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

  // For trips with destination in "Town - Province" format
  if (trip.destination && trip.destination.includes(' - ')) {
    const parts = trip.destination.split(' - ')
    if (parts.length === 2) {
      const town = parts[0].trim()
      const province = parts[1].trim()
      return `${town}, ${province}`
    }
  }

  // Fallback to simple destination or farmName as-is
  return trip.destination || trip.farmName || ''
}

// Extract town and province for toll calculation (OSRM-friendly)
const extractTollDestination = (trip) => {
  if (!trip) return ''

  // For trips with destination in "Town - Province" format, use as-is
  if (trip.destination && trip.destination.includes(' - ')) {
    const parts = trip.destination.split(' - ')
    if (parts.length === 2) {
      const town = parts[0].trim()
      const province = parts[1].trim()
      return `${town}, ${province}`
    }
  }

  // Try to extract from farm data
  const farmData = getFarmData(trip.farmName)
  if (farmData && farmData.town && farmData.province) {
    return `${farmData.town}, ${farmData.province}`
  }

  // For trips where farmName is like "Town - Province" format
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

// Extract just the town name for toll plaza matching
const extractTownForTollMatching = (trip) => {
  if (!trip) return ''

  // Get the full destination first
  const fullDestination = extractTollDestination(trip)

  if (fullDestination.includes(', ')) {
    const parts = fullDestination.split(', ')
    if (parts.length >= 1) {
      return parts[0].trim()
    }
  }

  // From destination field "Town - Province"
  if (trip.destination && trip.destination.includes(' - ')) {
    const parts = trip.destination.split(' - ')
    if (parts.length >= 1) {
      return parts[0].trim()
    }
  }

  // From farm data
  const farmData = getFarmData(trip.farmName)
  if (farmData && farmData.town) {
    return farmData.town
  }

  // From farmName "Town - Province"
  if (trip.farmName && trip.farmName.includes(' - ')) {
    const parts = trip.farmName.split(' - ')
    if (parts.length >= 1) {
      return parts[0].trim()
    }
  }

  return ''
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
    { name: 'Mark Jason Poultry Farm D', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasen, Brgy. Upper Bilolo' },
    { name: 'Mark Jason Poultry Farm E', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasen, Brgy. Upper Bilolo' },
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
    { name: 'Chic2chic Corp.', town: 'Tubao', province: 'La Union', barangay: 'Brgy. Lloren' },
    { name: 'Galilee Poultry Farm', town: 'Umingan', province: 'Pangasinan', barangay: 'Capas' },
    { name: 'G.O.T Farm A', town: 'Calasiao', province: 'Pangasinan', barangay: 'Macabito' },
    { name: 'BTR Farms Inc', town: 'Sta. Cruz', province: 'Zambales', barangay: 'Mabiongbiong, Guinabon' },
    { name: 'Mark Jason Poultry Farm D', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasen, Brgy. Upper Bilolo' },
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
    { name: 'Mark Jason Poultry Farm E', town: 'Orion', province: 'Bataan', barangay: 'Sitio Kataasen, Brgy. Upper Bilolo' },
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

onMounted(() => {
  fetchTrips()
})

// Duplicate detection functions
const detectPotentialDuplicates = (trips) => {
  const groups = [];
  const processed = new Set();

  trips.forEach((trip, index) => {
    if (processed.has(index)) return;

    const group = [trip];
    const tripDestination = extractTollDestination(trip);

    // Find ALL trips with same date and destination first
    trips.forEach((otherTrip, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;

      const otherDestination = extractTollDestination(otherTrip);
      const sameDate = trip.date === otherTrip.date;
      const sameDestination = tripDestination === otherDestination;

      if (sameDate && sameDestination) {
        group.push(otherTrip);
        processed.add(otherIndex);
      }
    });

    // Check if ANY trip in the group has < 250 bags
    const hasSmallLoadInGroup = group.some(t => (t.numberOfBags || 0) < 250);

    if (group.length > 1 && hasSmallLoadInGroup) {
      groups.push(group);
    }
    processed.add(index);
  });

  return groups;
};

const checkForDuplicates = (trips) => {
  const potentialGroups = detectPotentialDuplicates(trips);

  potentialGroups.forEach((group, index) => {
    const groupId = `group_${Date.now()}_${index}`;
    pendingConfirmations.value.push({
      id: groupId,
      trips: group,
      status: 'pending'
    });

    // Mark trips as pending confirmation
    group.forEach(trip => {
      trip.duplicateStatus = 'pending';
      trip.duplicateGroupId = groupId;
    });
  });
};

const mergeDuplicates = (group) => {
  // Mark as merged
  confirmedDuplicates.value.add(group.id);

  // Calculate toll once for the group
  const primaryTrip = group.trips[0];
  calculateTollForTrip(primaryTrip);

  // Mark other trips as merged
  group.trips.forEach((trip, index) => {
    if (index === 0) {
      trip.duplicateStatus = 'primary';
    } else {
      trip.duplicateStatus = 'merged';
      trip._computedToll = primaryTrip._computedToll; // Copy toll
    }
  });

  // Remove from pending
  pendingConfirmations.value = pendingConfirmations.value.filter(g => g.id !== group.id);
};

const keepSeparate = (group) => {
  // Mark all as separate
  group.trips.forEach(trip => {
    trip.duplicateStatus = 'separate';
    calculateTollForTrip(trip); // Calculate individually
  });

  // Remove from pending
  pendingConfirmations.value = pendingConfirmations.value.filter(g => g.id !== group.id);
};

const dismissAlert = (group) => {
  // Just remove from pending without action
  group.trips.forEach(trip => {
    trip.duplicateStatus = null;
    trip.duplicateGroupId = null;
  });

  pendingConfirmations.value = pendingConfirmations.value.filter(g => g.id !== group.id);
};

const closeAllModals = () => {
  // Close all duplicate modals by clearing pending confirmations
  pendingConfirmations.value.forEach(group => {
    group.trips.forEach(trip => {
      trip.duplicateStatus = null;
      trip.duplicateGroupId = null;
    });
  });
  pendingConfirmations.value = [];
};

// Drag functionality
const startDrag = (event) => {
  isDragging.value = true;
  const rect = event.target.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - modalPosition.value.x,
    y: event.clientY - modalPosition.value.y
  };

  // Add global event listeners
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', stopDrag);

  event.preventDefault();
};

const drag = (event) => {
  if (!isDragging.value) return;

  const clientX = event.clientX || (event.touches && event.touches[0].clientX);
  const clientY = event.clientY || (event.touches && event.touches[0].clientY);

  if (clientX && clientY) {
    modalPosition.value = {
      x: Math.max(0, Math.min(window.innerWidth - 470, clientX - dragOffset.value.x)),
      y: Math.max(0, Math.min(window.innerHeight - 100, clientY - dragOffset.value.y))
    };
  }

  event.preventDefault();
};

const stopDrag = () => {
  isDragging.value = false;

  // Remove global event listeners
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
};

// Toll controls drag functionality
const startTollControlsDrag = (event) => {
  isDraggingTollControls.value = true;

  // Handle both mouse and touch events
  const clientX = event.clientX || (event.touches && event.touches[0].clientX);
  const clientY = event.clientY || (event.touches && event.touches[0].clientY);

  tollControlsDragOffset.value = {
    x: clientX - tollControlsPosition.value.x,
    y: clientY - tollControlsPosition.value.y
  };

  // Add global event listeners
  document.addEventListener('mousemove', dragTollControls);
  document.addEventListener('mouseup', stopTollControlsDrag);
  document.addEventListener('touchmove', dragTollControls, { passive: false });
  document.addEventListener('touchend', stopTollControlsDrag);

  event.preventDefault();
};

const dragTollControls = (event) => {
  if (!isDraggingTollControls.value) return;

  const clientX = event.clientX || (event.touches && event.touches[0].clientX);
  const clientY = event.clientY || (event.touches && event.touches[0].clientY);

  if (clientX && clientY) {
    // Allow dragging to viewport edges with minimal padding
    tollControlsPosition.value = {
      x: Math.max(0, Math.min(window.innerWidth - 50, clientX - tollControlsDragOffset.value.x)),
      y: Math.max(0, Math.min(window.innerHeight - 50, clientY - tollControlsDragOffset.value.y))
    };
  }

  event.preventDefault();
};

const stopTollControlsDrag = () => {
  isDraggingTollControls.value = false;

  // Remove global event listeners
  document.removeEventListener('mousemove', dragTollControls);
  document.removeEventListener('mouseup', stopTollControlsDrag);
  document.removeEventListener('touchmove', dragTollControls);
  document.removeEventListener('touchend', stopTollControlsDrag);
};

// Dismiss all alerts
const dismissAllAlerts = () => {
  pendingConfirmations.value.forEach(group => {
    group.trips.forEach(trip => {
      trip.duplicateStatus = null;
      trip.duplicateGroupId = null;
    });
  });
  pendingConfirmations.value = [];
};

// Merge all duplicate groups as single trips
const mergeAllDuplicates = () => {
  pendingConfirmations.value.forEach(group => {
    mergeDuplicates(group);
  });
};

// Keep all duplicate groups as separate trips
const keepAllSeparate = () => {
  pendingConfirmations.value.forEach(group => {
    keepSeparate(group);
  });
};

// Pagination functions
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
    fetchTrips();
  }
};

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchTrips();
  }
};

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    fetchTrips();
  }
};

// Helper functions for duplicate status
const getTripRowClass = (trip) => {
  if (trip.duplicateStatus === 'pending') return 'row-pending-duplicate';
  if (trip.duplicateStatus === 'merged') return 'row-merged';
  return '';
};

const getDuplicateBadgeClass = (status) => {
  return `duplicate-${status}`;
};

const getDuplicateIcon = (status) => {
  switch (status) {
    case 'pending': return '❓';
    case 'primary': return '🎯';
    case 'merged': return '🔗';
    case 'separate': return '✖️';
    default: return '';
  }
};

const getDuplicateTooltip = (trip) => {
  switch (trip.duplicateStatus) {
    case 'pending': return 'Pending duplicate confirmation';
    case 'primary': return 'Primary trip in merged group';
    case 'merged': return 'Merged with primary trip';
    case 'separate': return 'Confirmed as separate trip';
    default: return '';
  }
};
</script>

<style scoped>
.toll-view {
  width: 100%;
}

.view-header {
  margin-bottom: 2rem;
}

.view-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.8rem;
}

.view-header p {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.toll-table-container {
  overflow-x: auto;
  margin-bottom: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.toll-table {
  width: 100%;
  min-width: 1400px;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  font-size: 0.85rem;
}

.toll-table th {
  background: #f8f9fa;
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}

.toll-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid #dee2e6;
  vertical-align: middle;
}

.toll-row {
  transition: background-color 0.2s;
}

.toll-row:hover {
  background: #f8f9fa;
}

.date-cell, .invoice-cell, .plate-cell {
  min-width: 100px;
  white-space: nowrap;
}

.origin-cell, .destination-cell {
  min-width: 200px;
  max-width: 250px;
  word-wrap: break-word;
}

.computed-cell, .actual-cell, .variance-cell {
  min-width: 120px;
  text-align: center;
}

.vehicle-class-cell {
  min-width: 120px;
  text-align: center;
}

.actions-cell {
  min-width: 80px;
  text-align: center;
}

.toll-amount {
  font-weight: 600;
  color: #28a745;
}

.loading-toll {
  color: #ffc107;
  font-style: italic;
}

.error-toll {
  color: #dc3545;
  font-weight: 600;
  cursor: help;
}

.no-toll {
  color: #6c757d;
}

.toll-input {
  width: 100px;
  padding: 0.25rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
  font-size: 0.8rem;
}

.toll-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.toll-input-inline {
  border: none;
  background: transparent;
  padding: 0;
  width: 70px;
  text-align: right;
  font-weight: 600;
  color: #28a745;
  white-space: nowrap;
}

.toll-input-inline:focus {
  outline: none;
  background: rgba(0, 123, 255, 0.1);
  border-radius: 2px;
}

.variance-savings {
  color: #28a745;
  font-weight: 600;
  background: rgba(40, 167, 69, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.variance-overrun {
  color: #dc3545;
  font-weight: 600;
  background: rgba(220, 53, 69, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.variance-zero {
  color: #6c757d;
  font-weight: 600;
}

.no-variance {
  color: #6c757d;
}

.vehicle-class-select {
  width: 100%;
  padding: 0.25rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.8rem;
  background: white;
}

.vehicle-class-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.btn-recalc {
  background: transparent;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-recalc:hover:not(:disabled) {
  background: #e3f2fd;
}

.btn-recalc:disabled {
  color: #6c757d;
  cursor: not-allowed;
}

.btn-recalc svg {
  width: 16px;
  height: 16px;
}

.toll-summary {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 1.5rem;
}

.toll-summary h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.4rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.summary-label {
  font-weight: 600;
  color: #666;
}

.summary-value {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.summary-value.variance-positive {
  color: #dc3545;
}

.summary-value.variance-negative {
  color: #28a745;
}

.summary-value.variance-zero {
  color: #6c757d;
}

/* Toll Controls */
.toll-controls {
  background: transparent;
  padding: 0.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  box-shadow: none;
  position: fixed;
  top: 140px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(25% - 25px);
  cursor: move;
  user-select: none;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
}

.select-all-checkbox,
.header-checkbox,
.row-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-column {
  width: 50px;
  text-align: center;
  position: relative;
}

.checkbox-column,
.date-cell,
.date-header {
  position: sticky;
  background: white;
  z-index: 2;
}

.checkbox-column {
  left: 0;
  border-right: 2px solid #dee2e6;
}

.date-cell,
.date-header {
  left: 50px;
  border-right: 1px solid #dee2e6;
}

.btn-stop-resume {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  margin-left: 0.5rem;
}

.btn-stop-resume:hover {
  background: rgba(0, 0, 0, 0.1);
}

.btn-calculate-selected {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-calculate-selected:hover:not(:disabled) {
  background: #0056b3;
}

.btn-calculate-selected:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Route Selector */
.route-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.route-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.75rem;
  background: white;
  color: #333;
  min-width: 120px;
}

.route-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

/* Duplicate Detection Styles */
.duplicate-notifications {
  position: absolute;
  z-index: 1000;
  max-width: 450px;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.modal-header {
  background: #856404;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px 8px 0 0;
  cursor: move;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-dismiss-all, .btn-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-dismiss-all:hover, .btn-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Sticky Actions */
.sticky-actions {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff3cd;
  border-bottom: 1px solid #ffeaa7;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: -1rem -1rem 1rem -1rem;
}

.btn-merge-all-sticky, .btn-separate-all-sticky, .btn-dismiss-all-sticky, .btn-close-sticky {
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-merge-all-sticky {
  background: #28a745;
}

.btn-merge-all-sticky:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.btn-separate-all-sticky {
  background: #007bff;
}

.btn-separate-all-sticky:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.btn-dismiss-all-sticky {
  background: #dc3545;
}

.btn-dismiss-all-sticky:hover {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.btn-close-sticky {
  background: #6c757d;
}

.btn-close-sticky:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.duplicate-alert {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  max-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.alert-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.alert-content h4 {
  margin: 0 0 0.5rem 0;
  color: #856404;
  flex-shrink: 0;
}

.group-summary {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
  flex-shrink: 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.85rem;
}

.trip-details-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 0.5rem 0;
}

.trip-details-header {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 0.5fr;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  font-weight: 600;
  font-size: 0.8rem;
  color: #495057;
  flex-shrink: 0;
}

.trip-details-list {
  flex: 1;
  overflow-y: auto;
  max-height: 200px;
}

.trip-detail-item {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 0.5fr;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid #f8f9fa;
  font-size: 0.8rem;
  align-items: center;
}

.trip-detail-item .invoice {
  font-weight: 500;
  color: #007bff;
}

.trip-detail-item .farm {
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-detail-item .plate {
  color: #6c757d;
}

.trip-detail-item .bags {
  text-align: center;
  font-weight: 600;
  color: #28a745;
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-shrink: 0;
}

.btn-merge, .btn-separate, .btn-dismiss {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-merge {
  background: #28a745;
  color: white;
}

.btn-separate {
  background: #007bff;
  color: white;
}

.btn-dismiss {
  background: #6c757d;
  color: white;
}

.row-pending-duplicate {
  background: #fff3cd !important;
}

.row-merged {
  background: #d1ecf1 !important;
}

.duplicate-pending {
  background: #ffc107;
  color: #212529;
}

.duplicate-primary {
  background: #28a745;
  color: white;
}

.duplicate-merged {
  background: #17a2b8;
  color: white;
}

.duplicate-separate {
  background: #6c757d;
  color: white;
}

.duplicate-badge {
  padding: 0.25rem;
  border-radius: 50%;
  display: inline-block;
  width: 20px;
  height: 20px;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1;
}

/* Pagination Styles */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.pagination-info {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
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
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.pagination-btn:disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  border-color: #dee2e6;
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
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  transition: all 0.2s;
}

.page-number:hover:not(.active) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.page-number.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .pagination-container {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    padding: 0.75rem;
  }

  .pagination-info {
    text-align: center;
    font-size: 0.8rem;
  }

  .pagination-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .page-numbers {
    order: 2;
    justify-content: center;
  }

  .pagination-btn {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    min-width: auto;
  }

  .page-number {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
    min-width: 35px;
  }
}
</style>
