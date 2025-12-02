<template>
  <div class="trip-form">
    <h3>{{ isEditing ? 'Edit Trip' : 'Add New Trip' }}</h3>

    <form @submit.prevent="submitForm" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label for="date">Date</label>
          <input
            id="date"
            v-model="formData.date"
            type="date"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="truckPlate">Truck Plate</label>
          <input
            id="truckPlate"
            v-model="formData.truckPlate"
            type="text"
            required
            class="form-input"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="invoiceNumber">Invoice Number</label>
          <input
            id="invoiceNumber"
            v-model="formData.invoiceNumber"
            type="text"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="origin">Origin</label>
          <input
            id="origin"
            v-model="formData.origin"
            type="text"
            required
            class="form-input"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="farmName">Farm Name</label>
          <div class="autocomplete-container">
            <input
              id="farmName"
              v-model="formData.farmName"
              type="text"
              required
              class="form-input"
              @input="onFarmInput"
              @focus="showFarmSuggestions = true"
              @blur="hideFarmSuggestions"
              placeholder="Start typing for existing farms..."
              autocomplete="off"
            />
            <div v-if="showFarmSuggestions && farmSuggestions.length > 0" class="suggestions-dropdown">
              <div
                v-for="(farm, index) in farmSuggestions.slice(0, 8)"
                :key="farm.value"
                :class="['suggestion-item', { highlighted: index === highlightedFarmIndex }]"f
                @mousedown="selectFarm(farm)"
                @mouseenter="highlightedFarmIndex = index"
              >
                {{ farm.display }}
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="destination">Town-City/Province</label>
          <div class="autocomplete-container">
            <input
              id="destination"
              v-model="formData.destination"
              type="text"
              required
              class="form-input"
              @input="onDestinationInput"
              @focus="showSuggestions = true"
              @blur="hideSuggestions"
              placeholder="Start typing for suggestions..."
              autocomplete="off"
            />
            <div v-if="showSuggestions && filteredSuggestions.length > 0" class="suggestions-dropdown">
              <div
                v-for="(suggestion, index) in filteredSuggestions.slice(0, 8)"
                :key="suggestion.value"
                :class="['suggestion-item', { highlighted: index === highlightedIndex }]"
                @mousedown="selectSuggestion(suggestion)"
                @mouseenter="highlightedIndex = index"
              >
                {{ suggestion.display }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="driver">Driver</label>
          <select
            id="driver"
            v-model="formData.driver"
            required
            class="form-input"
          >
            <option value="">Select Driver</option>
            <option
              v-for="employee in employees"
              :key="employee.uuid"
              :value="employee.uuid"
            >
              {{ employee.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="helper">Helper</label>
          <select
            id="helper"
            v-model="formData.helper"
            class="form-input"
          >
            <option value="">Select Helper (Optional)</option>
            <option
              v-for="employee in employees"
              :key="employee.uuid"
              :value="employee.uuid"
            >
              {{ employee.name }}
            </option>
          </select>
          <div v-if="formData.driver && formData.helper && formData.driver === formData.helper" class="same-employee-warning">
            ⚠️ Same employee selected for both roles. This person will work double-duty!
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="numberOfBags">Number of Bags</label>
          <input
            id="numberOfBags"
            v-model.number="formData.numberOfBags"
            type="number"
            min="1"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="foodAllowance">Food Allowance</label>
          <input
            id="foodAllowance"
            v-model="displayFoodAllowance"
            type="text"
            readonly
            class="form-input"
            placeholder="Calculated automatically per day"
          />
        </div>
      </div>



      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="btn-cancel">
          Cancel
        </button>
        <button type="submit" :disabled="loading" class="btn-submit">
          {{ loading ? 'Saving...' : (isEditing ? 'Update Trip' : 'Create Trip') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'
import { useDataRefresh } from '../composables/useDataRefresh'

// Initialize global refresh system
const { triggerRefresh } = useDataRefresh()

const props = defineProps({
  editTrip: {
    type: Object,
    default: null
  }
})



const emit = defineEmits(['tripAdded', 'cancel'])

const loading = ref(false)
const isEditing = ref(false)
const employees = ref([])
const allRates = ref([])
const showFarmSuggestions = ref(false)
const highlightedFarmIndex = ref(-1)
const allFarms = ref([])
const showSuggestions = ref(false)
const highlightedIndex = ref(-1)

const formData = reactive({
  date: '',
  truckPlate: 'NGU 9174',
  invoiceNumber: '',
  origin: 'Dampol 2nd A, Pulilan Bulacan',
  farmName: '',
  destination: '',
  rateLookupKey: '',
  driver: 'MTM Driver',
  helper: '',
  numberOfBags: 1,
  status: 'Completed'
})

const fetchPersonnel = async () => {
  try {
    const [employeesRes, ratesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/employees`),
      axios.get(`${API_BASE_URL}/rates`)
    ])
    employees.value = employeesRes.data
    allRates.value = ratesRes.data
  } catch (error) {
    console.error('Error fetching data:', error)
    // Fallback to basic data - using employees structure
    employees.value = [
      { uuid: 'fallback-drivers', name: 'Juan dela Cruz' },
      { uuid: 'fallback-helpers', name: 'Pedro Santos' },
      { uuid: 'fallback-helpers2', name: 'Maria Garcia' }
    ]
    allRates.value = []
  }
}

const loadFarms = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/trips/suggestions`)
    allFarms.value = response.data.farms || []
  } catch (error) {
    console.error('Error loading farm data:', error)
    allFarms.value = []
  }
}

onMounted(() => {
  fetchPersonnel()
  loadFarms()
})

const resetForm = () => {
  Object.assign(formData, {
    date: '',
    truckPlate: 'NGU 9174',
    invoiceNumber: '',
    origin: 'Dampol 2nd A, Pulilan Bulacan',
    farmName: '',
    destination: '',
    rateLookupKey: '',
    driver: 'MTM Driver',
    helper: '',
    numberOfBags: 1,
    status: 'Completed'
  })
}

const submitForm = async () => {
  loading.value = true
  try {
    const data = { ...formData }

    // Always construct fullDestination from farmName + destination
    if (data.farmName && data.destination) {
      const destinationParts = data.destination.split(' - ')
      if (destinationParts.length === 2) {
        data.fullDestination = `${data.farmName}, ${destinationParts[0]}, ${destinationParts[1]}`
      }
    }


    if (isEditing.value && props.editTrip) {
      await axios.put(`${API_BASE_URL}/trips/${props.editTrip.id}`, data)
      alert('Trip updated successfully!')
    } else {
      await axios.post(`${API_BASE_URL}/trips`, data)
      alert('Trip added successfully!')
    }

    // 📡 TRIGGER GLOBAL REFRESH: Notify all trip-related components to refresh
    triggerRefresh('trips')

    emit('tripAdded')
    resetForm()
  } catch (error) {
    console.error('Error saving trip:', error)
    alert('Error saving trip. Please try again.')
  } finally {
    loading.value = false
  }
}

// Watch for edit trip prop changes
watch(() => props.editTrip, async (newTrip) => {
  if (newTrip) {
    // Ensure farm data is loaded before populating form
    if (allFarms.value.length === 0) {
      await loadFarms()
    }

    // Populate form data
    Object.assign(formData, {
      date: formatDateForInput(newTrip.date), // Properly format date for HTML date input
      truckPlate: newTrip.truckPlate || 'NGU 9174',
      invoiceNumber: newTrip.invoiceNumber || '',
      origin: newTrip.origin || 'Dampol 2nd A, Pulilan Bulacan',
      destination: newTrip.destination || '',
      fullDestination: newTrip.fullDestination || '',
      rateLookupKey: newTrip.rateLookupKey || '',
      driver: newTrip.driver || 'MTM Driver',
      helper: newTrip.helper || '',
      numberOfBags: newTrip.numberOfBags || 1,
      status: newTrip.status || 'Completed'
    })

    // Set farm name after a small delay to avoid autocomplete interference
    await new Promise(resolve => setTimeout(resolve, 10))
    formData.farmName = newTrip.farm_name || newTrip.farmName || ''

    isEditing.value = true
  } else {
    resetForm()
    isEditing.value = false
  }
}, { immediate: true })

// Watch for destination changes to auto-populate rateLookupKey
watch(() => formData.destination, (newDestination) => {
  if (newDestination) {
    const parts = newDestination.split(' - ')
    if (parts.length === 2) {
      formData.rateLookupKey = newDestination
    }
  }
})

// Farm autocomplete functionality
const farmSuggestions = computed(() => {
  if (!formData.farmName || !allFarms.value.length) return []

  const input = formData.farmName.toLowerCase().trim()
  if (!input) return []

  // Filter farm names that contain the input
  return allFarms.value.filter(farm =>
    farm.name.toLowerCase().includes(input)
  ).map(farm => ({
    display: `${farm.name} (${farm.town} - ${farm.province})`,
    value: farm.name,
    town: farm.town,
    province: farm.province,
    farm: farm
  }))
})

const onFarmInput = () => {
  showFarmSuggestions.value = true
  highlightedFarmIndex.value = -1

  // Close suggestions if no matches and input is empty
  if (!formData.farmName.trim() || farmSuggestions.value.length === 0) {
    // Keep suggestions open for potential results
    return
  }
}

const selectFarm = (farm) => {
  // The farm object has: name, town, province, fullAddress
  const selectedFarm = farm.farm // Original farm object from farm list

  formData.farmName = selectedFarm.name
  formData.destination = `${selectedFarm.town} - ${selectedFarm.province}`
  formData.fullDestination = selectedFarm.fullAddress || `${selectedFarm.name}, ${selectedFarm.town}, ${selectedFarm.province}`
  formData.rateLookupKey = `${selectedFarm.town} - ${selectedFarm.province}`
  showFarmSuggestions.value = false
}

const hideFarmSuggestions = () => {
  // Delay hiding to allow click events on suggestions
  setTimeout(() => {
    showFarmSuggestions.value = false
    highlightedFarmIndex.value = -1
  }, 150)
}

// Town-City/Province autocomplete functionality
const filteredSuggestions = computed(() => {
  if (!formData.destination || !allRates.value.length) return []

  const input = formData.destination.toLowerCase().trim()
  if (!input) return []

  const suggestions = []

  // Create unique combinations of town - province
  allRates.value.forEach(rate => {
    if (rate.town && rate.province) {
      const display = `${rate.town} - ${rate.province}`
      const value = display

      if (display.toLowerCase().includes(input) ||
          rate.town.toLowerCase().includes(input) ||
          rate.province.toLowerCase().includes(input)) {

        if (!suggestions.some(s => s.value === value)) {
          suggestions.push({ display, value })
        }
      }
    }
  })

  // Sort by best matches: exact town matches first, then province matches
  return suggestions.sort((a, b) => {
    const aTown = a.display.split(' - ')[0].toLowerCase()
    const bTown = b.display.split(' - ')[0].toLowerCase()
    const aProvince = a.display.split(' - ')[1].toLowerCase()
    const bProvince = b.display.split(' - ')[1].toLowerCase()

    // Exact town match gets priority
    if (aTown === input && bTown !== input) return -1
    if (bTown === input && aTown !== input) return 1

    // Province match gets secondary priority
    if (aProvince.includes(input) && !bProvince.includes(input)) return -1
    if (bProvince.includes(input) && !aProvince.includes(input)) return 1

    return a.display.localeCompare(b.display)
  })
})

const onDestinationInput = () => {
  showSuggestions.value = true
  highlightedIndex.value = -1

  // Close suggestions if no matches and input is empty
  if (!formData.destination.trim() || filteredSuggestions.value.length === 0) {
    // Keep suggestions open for potential results
    return
  }
}

const selectSuggestion = (suggestion) => {
  formData.destination = suggestion.value
  formData.rateLookupKey = suggestion.value
  showSuggestions.value = false
}

const hideSuggestions = () => {
  // Delay hiding to allow click events on suggestions
  setTimeout(() => {
    showSuggestions.value = false
    highlightedIndex.value = -1
  }, 150)
}

// Helper function to format date for HTML date input (YYYY-MM-DD) - timezone-neutral
const formatDateForInput = (dateString) => {
  if (!dateString) return ''

  try {
    // Parse YYYY-MM-DD format manually and create UTC date at noon to prevent timezone shifting
    const parts = dateString.split('-')
    if (parts.length === 3) {
      // Create date at noon UTC: Year, Month-1, Day, Hour=12, Min=0, Sec=0, MS=0
      // This prevents timezone conversion issues when populating the date input field
      const utcDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0, 0))

      // Extract date components in UTC to maintain timezone neutrality
      const year = utcDate.getUTCFullYear()
      const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(utcDate.getUTCDate()).padStart(2, '0')

      return `${year}-${month}-${day}`
    }

    return ''
  } catch (error) {
    console.error('Error formatting date for input:', error)
    return ''
  }
}

// Computed property to display food allowance (read-only)
const displayFoodAllowance = computed(() => {
  return '₱450.00 (per day) - Calculated automatically'
})


</script>

<style scoped>
.trip-form {
  width: 100%;
}

.trip-form h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.btn-cancel:hover {
  background: #5a6268;
}

.btn-submit {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #0056b3;
}

.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.autocomplete-container {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.highlighted {
  background: #f8f9fa;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
