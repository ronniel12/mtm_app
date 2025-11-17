<template>
  <div class="billing-history">
    <div class="header-section">
      <h1 class="page-title">Billing History</h1>
      <p class="page-subtitle">View and manage all saved billing statements</p>
    </div>

    <div class="filters-section" v-if="billings.length > 0">
      <div class="filter-controls">
        <div class="filter-group">
          <label for="status-filter">Filter by Status:</label>
          <select id="status-filter" v-model="statusFilter" class="status-select" @change="filterBillings">
            <option value="all">All Status</option>
            <option value="pending">Pending Payment</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="search-input">Search Billings:</label>
          <input
            type="text"
            id="search-input"
            v-model="searchQuery"
            class="search-input"
            placeholder="Search by billing number, client, preparer, or date"
            @input="filterBillings"
          />
        </div>

        <div class="stats-info">
          <span class="stat-item">
            Total: <strong>{{ billings.length }}</strong>
          </span>
          <span class="stat-item">
            Pending: <strong>{{ billings.filter(b => b.paymentStatus === 'pending').length }}</strong>
          </span>
          <span class="stat-item">
            Paid: <strong>{{ billings.filter(b => b.paymentStatus === 'paid').length }}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- No Billings Message -->
    <div v-if="billings.length === 0" class="no-billings">
      <div class="no-billings-content">
        <h2>No Saved Billings</h2>
        <p>You haven't saved any billing statements yet.</p>
        <button @click="$emit('switch-to-create')" class="btn btn-primary">Create Billing Statement</button>
      </div>
    </div>

    <!-- Billings List -->
    <div v-else class="billings-grid">
      <div
        v-for="billing in filteredBillings"
        :key="billing.id"
        class="billing-card"
        :class="{ 'paid': billing.paymentStatus === 'paid', 'pending': billing.paymentStatus === 'pending' }"
      >
        <div class="billing-header">
          <div class="billing-status" :class="billing.paymentStatus">
            {{ billing.paymentStatus === 'paid' ? '✓ Paid' : '⏰ Pending' }}
          </div>
          <div class="billing-meta">
            <small>Created: {{ formatDate(billing.createdDate) }}</small>
          </div>
        </div>

        <div class="billing-details">
          <div class="billing-info-row">
            <span class="label">Period:</span>
            <span class="value">{{ billing.period.periodText }}</span>
          </div>

          <div class="billing-info-row">
            <span class="label">Billing Number:</span>
            <span class="value">{{ billing.billingNumber }}</span>
          </div>

          <div class="billing-info-row">
            <span class="label">Client:</span>
            <span class="value">{{ billing.client.name }}</span>
          </div>

          <div class="billing-info-row">
            <span class="label">Prepared by:</span>
            <span class="value">{{ billing.preparedBy }}</span>
          </div>

          <div class="billing-info-row">
            <span class="label">Total Trips:</span>
            <span class="value">{{ billing.trips.length }}</span>
          </div>

          <div class="billing-info-row">
            <span class="label">Total Bags:</span>
            <span class="value">{{ billing.totals.totalBags }}</span>
          </div>

          <div class="billing-info-row total-amount">
            <span class="label">Total Amount:</span>
            <span class="value">₱{{ formatCurrency(billing.totals.totalRevenue) }}</span>
          </div>
        </div>

        <div class="billing-actions">
          <button @click="viewBilling(billing)" class="btn btn-view">
            <i class="eye-icon">👁</i> View Details
          </button>
          <button @click="togglePaymentStatus(billing)" class="btn" :class="billing.paymentStatus === 'paid' ? 'btn-secondary' : 'btn-success'">
            {{ billing.paymentStatus === 'paid' ? 'Mark as Pending' : 'Mark as Paid' }}
          </button>
          <button @click="exportBilling(billing)" class="btn btn-export">
            <i class="export-icon">🖨</i> Print
          </button>
          <button @click="deleteBilling(billing)" class="btn btn-danger">
            <i class="delete-icon">🗑</i> Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Billing Details Modal -->
    <div v-if="selectedBilling" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedBilling.billingNumber }}</h2>
          <button @click="closeModal" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="billing-info-section">
            <h3>Billing Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Status:</label>
                <span :class="selectedBilling.paymentStatus">{{ selectedBilling.paymentStatus === 'paid' ? '✓ Paid' : '⏰ Pending' }}</span>
              </div>
              <div class="info-item">
                <label>Period:</label>
                <span>{{ selectedBilling.period.periodText }}</span>
              </div>
              <div class="info-item">
                <label>Created:</label>
                <span>{{ formatDate(selectedBilling.createdDate) }}</span>
              </div>
              <div class="info-item">
                <label>Prepared by:</label>
                <span>{{ selectedBilling.preparedBy }}</span>
              </div>
            </div>
          </div>

          <div class="client-info-section">
            <h3>Client Information</h3>
            <div class="client-details">
              <p><strong>{{ selectedBilling.client.name }}</strong></p>
              <p>{{ selectedBilling.client.address }}</p>
              <p>{{ selectedBilling.client.city }}, {{ selectedBilling.client.zipCode }}</p>
              <p>TIN: {{ selectedBilling.client.tin }}</p>
            </div>
          </div>

          <div class="trips-section">
            <h3>Trip Details ({{ selectedBilling.trips.length }} trips)</h3>
            <div class="trips-table-container">
              <table class="trips-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Plate</th>
                    <th>Invoice</th>
                    <th>Destination</th>
                    <th>Bags</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="trip in selectedBilling.trips" :key="trip.id">
                    <td>{{ formatDateShort(trip.date) }}</td>
                    <td>{{ trip.truckPlate }}</td>
                    <td>{{ trip.invoiceNumber }}</td>
                    <td>{{ trip.destination }}</td>
                    <td class="text-center">{{ trip.numberOfBags }}</td>
                    <td class="text-right">₱{{ formatCurrency(trip.rate) }}</td>
                    <td class="text-right">₱{{ formatCurrency(trip.total) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="4" class="text-left"><strong>TOTALS:</strong></td>
                    <td class="text-center"><strong>{{ selectedBilling.totals.totalBags }}</strong></td>
                    <td></td>
                    <td class="text-right"><strong>₱{{ formatCurrency(selectedBilling.totals.totalRevenue) }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="exportBilling(selectedBilling)" class="btn btn-primary">Print</button>
          <button @click="togglePaymentStatus(selectedBilling)" class="btn" :class="selectedBilling.paymentStatus === 'paid' ? 'btn-secondary' : 'btn-success'">
            {{ selectedBilling.paymentStatus === 'paid' ? 'Mark as Pending' : 'Mark as Paid' }}
          </button>
          <button @click="closeModal" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'
import { useDataRefresh } from '../composables/useDataRefresh'

// Initialize global refresh system
const { onRefresh } = useDataRefresh()

const billings = ref([])
const filteredBillings = ref([])
const statusFilter = ref('all')
const searchQuery = ref('')
const selectedBilling = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const totalBillings = ref(0)
const totalPages = ref(0)
const loading = ref(false)

// Methods
const formatDate = (dateString) => {
  if (!dateString) return ''
  // Database now stores timestamps in local timezone (UTC+2)
  // Display as-is without additional timezone conversion
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatDateShort = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Parse various date formats into a Date object
const parseDateFromInput = (dateInput) => {
  if (!dateInput || typeof dateInput !== 'string') return null

  const input = dateInput.trim().toLowerCase()

  // Try various date formats
  const formats = [
    // MM/DD/YYYY (11/1/2025)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // Month DD, YYYY (november 1, 2025, november 01, 2025)
    /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
    // DD Month YYYY (1 november 2025, 01 november 2025)
    /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/,
    // YYYY-MM-DD (2025-11-01)
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // Month YYYY (november 2025)
    /^([a-zA-Z]+)\s+(\d{4})$/
  ]

  const monthNames = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  }

  for (let i = 0; i < formats.length; i++) {
    const match = input.match(formats[i])
    if (match) {
      let year, month, day

      if (i === 0) { // MM/DD/YYYY
        month = parseInt(match[1]) - 1
        day = parseInt(match[2])
        year = parseInt(match[3])
      } else if (i === 1) { // Month DD, YYYY
        year = parseInt(match[3])
        const monthName = match[1].toLowerCase()
        month = monthNames[monthName]
        day = parseInt(match[2])
      } else if (i === 2) { // DD Month YYYY
        year = parseInt(match[3])
        const monthName = match[2].toLowerCase()
        month = monthNames[monthName]
        day = parseInt(match[1])
      } else if (i === 3) { // YYYY-MM-DD
        year = parseInt(match[1])
        month = parseInt(match[2]) - 1
        day = parseInt(match[3])
      } else if (i === 4) { // Month YYYY
        year = parseInt(match[2])
        const monthName = match[1].toLowerCase()
        month = monthNames[monthName]
        day = 1 // Default to first day for month-year searches
      }

      // Validate date ranges
      if (year >= 2000 && year <= 2030 &&
          month >= 0 && month <= 11) {
        if (i === 4) { // Month YYYY - return special object
          return { type: 'monthYear', year: year, month: month }
        } else if (day >= 1 && day <= 31) {
          const date = new Date(year, month, day)
          // Additional validation - check if date is actually valid
          if (date.getFullYear() === year &&
              date.getMonth() === month &&
              date.getDate() === day) {
            return date
          }
        }
      }
    }
  }

  return null
}

const fetchBillings = async (page = 1) => {
  try {
    loading.value = true
    // Try API first (server-side persistence)
    const response = await axios.get(`${API_BASE_URL}/billings?page=${page}&limit=${pageSize.value}`)
    if (response.status === 200) {
      const data = response.data
      if (data.billings && data.pagination) {
        // Paginated response
        billings.value = data.billings
        totalBillings.value = data.pagination.total
        totalPages.value = data.pagination.totalPages
        currentPage.value = data.pagination.page
      } else {
        // Fallback for non-paginated response
        billings.value = data
        totalBillings.value = data.length
        totalPages.value = 1
        currentPage.value = 1
      }
      filteredBillings.value = [...billings.value]
      console.log('Loaded billings from server:', billings.value.length, 'of', totalBillings.value)
      return
    }

  } catch (apiError) {
    console.warn('API not available, trying localStorage:', apiError.message)

    // Fallback to localStorage
    try {
      const localData = localStorage.getItem('billingHistory')
      if (localData) {
        billings.value = JSON.parse(localData)
        filteredBillings.value = [...billings.value]
        totalBillings.value = billings.value.length
        totalPages.value = 1
        currentPage.value = 1
        console.log('Loaded billings from localStorage:', billings.value.length)
        return
      }
    } catch (localError) {
      console.error('localStorage error:', localError)
    }

    // Last resort - empty array
    billings.value = []
    totalBillings.value = 0
    totalPages.value = 0
    currentPage.value = 1
  }

  filteredBillings.value = [...billings.value]
  loading.value = false
}

const filterBillings = () => {
  let filtered = [...billings.value]

  // Status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(billing =>
      billing.paymentStatus === statusFilter.value
    )
  }

  // Search filter (includes text and date search)
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(billing => {
      // Text search (existing functionality)
      const textMatch = billing.billingNumber.toLowerCase().includes(query) ||
                        billing.client.name.toLowerCase().includes(query) ||
                        billing.preparedBy.toLowerCase().includes(query)

      // Date search (new functionality)
      let dateMatch = false
      try {
        const searchDate = parseDateFromInput(searchQuery.value)
        if (searchDate) {
          if (searchDate.type === 'monthYear') {
            // Handle month-year searches (e.g., "november 2025")
            const periodStart = new Date(billing.period.startDate)
            const periodEnd = new Date(billing.period.endDate)
            // Check if the billing's period overlaps with the specified month/year
            const billingStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
            const billingEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0) // Last day of month
            const searchMonthStart = new Date(searchDate.year, searchDate.month, 1)
            const searchMonthEnd = new Date(searchDate.year, searchDate.month + 1, 0) // Last day of search month

            // Check for overlap between billing period and search month
            dateMatch = !(billingEnd < searchMonthStart || billingStart > searchMonthEnd)
          } else {
            // Handle specific date searches
            const periodStart = new Date(billing.period.startDate)
            const periodEnd = new Date(billing.period.endDate)
            dateMatch = searchDate >= periodStart && searchDate <= periodEnd
          }
        }
      } catch (e) {
        // Invalid date input, ignore date matching
      }

      // Return true if either text or date matches
      return textMatch || dateMatch
    })
  }

  filteredBillings.value = filtered
}

const viewBilling = (billing) => {
  selectedBilling.value = billing
}

const closeModal = () => {
  selectedBilling.value = null
}

const togglePaymentStatus = async (billing) => {
  const newStatus = billing.paymentStatus === 'paid' ? 'pending' : 'paid'

  try {
    // Try to update via API first
    const response = await axios.put(`${API_BASE_URL}/billings/${billing.id}`, {
      ...billing,
      paymentStatus: newStatus
    })

    if (response.status === 200) {
      // Update local data
      billing.paymentStatus = newStatus

      console.log('Updated billing status:', billing.id, newStatus)
      alert(`Billing ${billing.billingNumber} marked as ${newStatus === 'paid' ? 'Paid' : 'Pending'}`)
      return
    }

  } catch (apiError) {
    console.warn('API update failed, using localStorage:', apiError.message)
  }

  // Fallback: Update in localStorage
  try {
    billing.paymentStatus = newStatus
    const savedBillings = JSON.stringify(billings.value)
    localStorage.setItem('billingHistory', savedBillings)

    console.log('Updated billing status locally:', billing.id, newStatus)
    alert(`Billing ${billing.billingNumber} marked as ${newStatus === 'paid' ? 'Paid' : 'Pending'} (stored locally)`)

  } catch (localError) {
    console.error('Local storage update failed:', localError)
    alert('Status update failed completely. Please try again.')
  }

  // Close modal if open
  if (selectedBilling.value) {
    selectedBilling.value.paymentStatus = newStatus
  }
}

const deleteBilling = async (billing) => {
  const confirmed = confirm(`Are you sure you want to delete billing "${billing.billingNumber}"? This action cannot be undone.`)

  if (!confirmed) return

  try {
    // Try to delete via API first
    const response = await axios.delete(`${API_BASE_URL}/billings/${billing.id}`)
    if (response.status === 200) {
      // Remove from local arrays
      const index = billings.value.findIndex(b => b.id === billing.id)
      if (index !== -1) {
        billings.value.splice(index, 1)
        filterBillings()
      }

      console.log('Deleted billing:', billing.id)
      alert(`Billing "${billing.billingNumber}" has been deleted successfully.`)
      return
    }

  } catch (apiError) {
    console.warn('API delete failed, using localStorage:', apiError.message)
  }

  // Fallback: Delete from localStorage
  try {
    const index = billings.value.findIndex(b => b.id === billing.id)
    if (index !== -1) {
      billings.value.splice(index, 1)
      filterBillings()

      const savedBillings = JSON.stringify(billings.value)
      localStorage.setItem('billingHistory', savedBillings)

      console.log('Deleted billing locally:', billing.id)
      alert(`Billing "${billing.billingNumber}" has been deleted successfully (local storage only).`)
    }

  } catch (localError) {
    console.error('Local storage delete failed:', localError)
    alert('Delete failed completely. Please try again.')
  }
}

const exportBilling = (billing) => {
  // Create print-friendly version similar to printStatement function
  const billToInfo = `Premium Feeds Corp.
798 Maharlika Highway, Dampol 2nd A
Pulilan Bulacan, 3005
TIN #007-932-128-000
Business Style: 007-932-128-000`.replace(/\n/g, '<br>')

  const companyInfo = `MTM ENTERPRISE
0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan
TIN # 175-434-337-000
Mobile No. 09605638462 / Telegram No. +358-044-978-8592`.replace(/\n/g, '<br>')

  let tableHTML = `
<table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; margin-top: 20px;">
<thead>
<tr style="background: #f0f0f0;">
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">DATE</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">PLATE NUMBER</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">INVOICE NUMBER</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">DESTINATION</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">NUMBER OF BAGS</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">RATE PER BAG</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">TOTAL</th>
</tr>
</thead>
<tbody>`

  billing.trips.forEach((trip, index) => {
    const bgColor = index % 2 === 1 ? '#fafafa' : 'white'
    tableHTML += `
<tr style="background: ${bgColor};">
<td style="border: 1px solid #000; padding: 2px; text-align: center;">${formatDateShort(trip.date)}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center;">${trip.truckPlate}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center;">${trip.invoiceNumber}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center;">${trip.destination}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center;">${trip.numberOfBags}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: right;">₱${formatCurrency(trip.rate)}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: right;">₱${formatCurrency(trip.total)}</td>
</tr>`
  })

  tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td colspan="4" style="border: 2px solid #000; padding: 4px; text-align: left; font-size: 11px;">GRAND TOTAL:</td>
<td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 12px;">${billing.totals.totalBags}</td>
<td style="border: 2px solid #000; padding: 4px; text-align: center;"></td>
<td style="border: 2px solid #000; padding: 4px; text-align: right; font-size: 12px;">₱${formatCurrency(billing.totals.totalRevenue)}</td>
</tr>
</tbody>
</table>`

  const printContent = `
<!DOCTYPE html>
<html>
<head>
<title>Print Preview</title>
<style>
@media print {
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #000; padding: 0; }
  .no-print { display: none; }
  .company-name-print { font-size: 22px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 8px; }
  .company-details-print { font-size: 11px; text-align: center; line-height: 1.2; margin-bottom: 10px; }
  .billing-title-print { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0 12px 0; }
  .bill-to-print { margin-bottom: 8px; }
  .bill-to-title-print { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
  .bill-to-details-print { font-size: 10px; line-height: 1.2; margin-bottom: 6px; }
  .billing-info-print { font-size: 10px; margin-bottom: 8px; text-align: left; line-height: 1.3; }
  .prepared-by-print { margin-top: 8px; font-size: 12px; font-weight: bold; }
  @page { size: A4; margin: 15mm; }
}
</style>
</head>
<body>
<div style="border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px; text-align: center;">
<h1 class="company-name-print">MTM ENTERPRISE</h1>
<div class="company-details-print">
${companyInfo}
</div>
<h2 class="billing-title-print">BILLING STATEMENT</h2>
</div>

<div class="bill-to-print">
<strong class="bill-to-title-print">BILLED TO:</strong><br>
<div class="bill-to-details-print">
${billToInfo}
</div>
</div>

<div class="billing-info-print">
<strong>Billing Number:</strong> ${billing.billingNumber}<br>
<strong>Period Covered:</strong> ${billing.period.periodText}<br>
<strong>Date Generated:</strong> ${formatDate(billing.createdDate)}
</div>

${tableHTML}

<div class="prepared-by-print">
<strong>Prepared by:</strong> ${billing.preparedBy}
</div>
</body>
</html>`

  // Create print window
  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()

  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print()
  }
}



// 📡 Listen for billing creation/deletion events to refresh the list
onRefresh('billings', async () => {
  console.log('🔄 Billing refresh triggered - reloading billings...')
  await fetchBillings()
  console.log('✅ Billing history refreshed')
})

// Lifecycle
onMounted(async () => {
  await fetchBillings()
})
</script>

<style scoped>
.billing-history {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
}

.header-section {
  text-align: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
}

.filters-section {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 2rem;
}

.filter-controls {
  display: flex;
  gap: 2rem;
  align-items: end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: bold;
  font-size: 0.9rem;
  color: #374151;
}

.status-select,
.search-input {
  padding: 0.75rem;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.search-input {
  min-width: 300px;
}

.status-select:focus,
.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.stats-info {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.stat-item {
  font-size: 0.9rem;
  color: #6b7280;
}

.no-billings {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.no-billings-content {
  text-align: center;
}

.no-billings-content h2 {
  color: #6b7280;
  font-size: 1.5rem;
  margin: 0 0 1rem 0;
}

.no-billings-content p {
  color: #9ca3af;
  margin: 0 0 2rem 0;
}

.billings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.billing-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  transition: all 0.2s;
}

.billing-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.billing-card.paid {
  border-color: #059669;
  background: #f0fdf4;
}

.billing-card.pending {
  border-color: #d97706;
  background: #fffbeb;
}

.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 1rem;
}

.billing-number h3 {
  margin: 0 0 0.25rem 0;
  color: #1f2937;
  font-size: 1.25rem;
}

.billing-status {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.billing-status.paid {
  background: #dcfce7;
  color: #166534;
}

.billing-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.billing-meta {
  text-align: right;
}

.billing-meta small {
  color: #6b7280;
  font-size: 0.75rem;
}

.billing-details {
  margin-bottom: 1.5rem;
}

.billing-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.billing-info-row .label {
  font-weight: 500;
  color: #374151;
}

.billing-info-row .value {
  color: #1f2937;
  font-weight: 500;
}

.billing-number-text {
  font-weight: bold;
  color: #dc2626;
  font-size: 1rem;
  background-color: #fef2f2;
  padding: 4px 8px;
  border-radius: 4px;
  width: 100%;
  text-align: center;
  margin-bottom: 8px;
}

.billing-info-row.total-amount {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
  font-size: 1rem;
}

.billing-info-row.total-amount .value {
  color: #059669;
  font-weight: bold;
}

.billing-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  background: #f9fafb;
}

.btn-view {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.btn-view:hover {
  background: #dbeafe;
}

.btn-success {
  background: #dcfce7;
  border-color: #16a34a;
  color: #166534;
}

.btn-success:hover {
  background: #bbf7d0;
}

.btn-export {
  background: #fef3c7;
  border-color: #d97706;
  color: #92400e;
}

.btn-export:hover {
  background: #fde68a;
}

.btn-secondary {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-danger {
  background: #fef2f2;
  border-color: #dc2626;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fecaca;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
}

.billing-info-section,
.client-info-section,
.trips-section {
  margin-bottom: 2rem;
}

.billing-info-section h3,
.client-info-section h3,
.trips-section h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.125rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.info-item label {
  font-weight: 500;
  color: #6b7280;
}

.info-item span {
  font-weight: 500;
  color: #1f2937;
}

.info-item span.paid {
  color: #059669;
}

.info-item span.pending {
  color: #d97706;
}

.client-details p {
  margin: 0.25rem 0;
  color: #374151;
}

.trips-table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-width: 100%;
}

.trips-table {
  width: auto !important; /* Allow table to expand based on content */
  min-width: 100%; /* Ensure at least container width */
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: auto !important; /* Override global fixed layout */
  margin: 0 auto; /* Center the table */
}

.trips-table th,
.trips-table td {
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  white-space: nowrap;
}

.trips-table th {
  background: #f9fafb;
  font-weight: 600;
  text-align: left;
}

.trips-table .totals-row {
  background: #f3f4f6;
  font-weight: bold;
}

/* Mobile Table Column Widths */
@media (max-width: 768px) {
  .trips-table-container {
    margin: 1rem 0;
  }

  .trips-table {
    font-size: 0.7rem;
    min-width: 100%;
  }

  .trips-table th,
  .trips-table td {
    padding: 0.5rem 0.25rem;
    font-size: 0.7rem;
  }

  /* Auto-adjusting Column Widths */
  .trips-table th:nth-child(1),
  .trips-table td:nth-child(1) { /* Date */
    width: auto;
    min-width: 100px;
  }

  .trips-table th:nth-child(2),
  .trips-table td:nth-child(2) { /* Plate */
    width: auto;
    min-width: 120px;
  }

  .trips-table th:nth-child(3),
  .trips-table td:nth-child(3) { /* Invoice */
    width: auto;
    min-width: 140px;
  }

  .trips-table th:nth-child(4),
  .trips-table td:nth-child(4) { /* Destination */
    width: auto;
    min-width: 250px;
    white-space: normal;
    word-wrap: break-word;
  }

  .trips-table th:nth-child(5),
  .trips-table td:nth-child(5) { /* Bags */
    width: auto;
    min-width: 80px;
  }

  .trips-table th:nth-child(6),
  .trips-table td:nth-child(6) { /* Rate */
    width: auto;
    min-width: 100px;
  }

  .trips-table th:nth-child(7),
  .trips-table td:nth-child(7) { /* Total */
    width: auto;
    min-width: 110px;
  }
}

@media (max-width: 480px) {
  .trips-table {
    font-size: 0.65rem;
    min-width: 700px;
  }

  .trips-table th,
  .trips-table td {
    padding: 0.4rem 0.2rem;
    font-size: 0.65rem;
  }

  /* Smaller minimum widths for very small screens */
  .trips-table th:nth-child(1),
  .trips-table td:nth-child(1) { /* Date */
    min-width: 70px;
  }

  .trips-table th:nth-child(2),
  .trips-table td:nth-child(2) { /* Plate */
    min-width: 80px;
  }

  .trips-table th:nth-child(3),
  .trips-table td:nth-child(3) { /* Invoice */
    min-width: 100px;
  }

  .trips-table th:nth-child(4),
  .trips-table td:nth-child(4) { /* Destination */
    min-width: 180px;
  }

  .trips-table th:nth-child(5),
  .trips-table td:nth-child(5) { /* Bags */
    min-width: 50px;
  }

  .trips-table th:nth-child(6),
  .trips-table td:nth-child(6) { /* Rate */
    min-width: 70px;
  }

  .trips-table th:nth-child(7),
  .trips-table td:nth-child(7) { /* Total */
    min-width: 80px;
  }
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.modal-footer .btn {
  padding: 0.75rem 1.5rem;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.text-left {
  text-align: left;
}

@media (max-width: 768px) {
  .billing-history {
    padding: 1rem;
  }

  .billings-grid {
    grid-template-columns: 1fr;
  }

  .filter-controls {
    flex-direction: column;
    gap: 1rem;
  }

  .stats-info {
    justify-content: center;
  }

  .billing-actions {
    flex-direction: column;
  }

  .billing-info-row {
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
