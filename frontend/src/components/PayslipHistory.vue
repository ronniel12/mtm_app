<template>
  <div class="payslip-history">
    <!-- Header -->
    <div class="history-header">
      <h2>📑 Payslip History</h2>
      <p>View and manage saved payslips</p>
    </div>

    <!-- Filters -->
    <div class="history-filters">
      <div class="filter-group">
        <label for="filter-year">Year:</label>
        <select id="filter-year" v-model="filterYear" @change="applyFilters" class="filter-select">
          <option value="">All Years</option>
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-employee">Employee:</label>
        <select id="filter-employee" v-model="filterEmployee" @change="applyFilters" class="filter-select">
          <option value="">All Employees</option>
          <option v-for="employee in availableEmployees" :key="employee.id" :value="employee.id">
            {{ employee.name }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label for="search-term">Search:</label>
        <input
          type="text"
          id="search-term"
          v-model="searchTerm"
          @input="applyFilters"
          placeholder="Payslip number, employee..."
          class="filter-input"
        />
      </div>

      <div class="filter-actions">
        <button @click="clearFilters" class="btn-clear-filters">Clear Filters</button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-cards" v-if="displayedPayslips.length > 0">
      <div class="stat-card">
        <h4>Total Payslips</h4>
        <p class="stat-value">{{ displayedPayslips.length }}</p>
      </div>
      <div class="stat-card">
        <h4>Total Amount Paid</h4>
        <p class="stat-value">₱{{ formatCurrency(totalAmountPaid) }}</p>
      </div>
      <div class="stat-card">
        <h4>Total Deductions</h4>
        <p class="stat-value">₱{{ formatCurrency(totalDeductions) }}</p>
      </div>
      <div class="stat-card">
        <h4>Average Net Pay</h4>
        <p class="stat-value">₱{{ formatCurrency(averageNetPay) }}</p>
      </div>
    </div>

    <!-- Payslip List -->
    <div class="payslip-list">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner">Loading payslips...</div>
      </div>

      <!-- No Payslips -->
      <div v-else-if="allPayslips.length === 0" class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>No Payslips Found</h3>
        <p>No payslips have been created yet. Create your first payslip from the main payroll view.</p>
      </div>

      <!-- Empty Filtered Results -->
      <div v-else-if="displayedPayslips.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No Matches Found</h3>
        <p>No payslips match your current filters. Try adjusting your search criteria.</p>
      </div>

      <!-- Payslip Cards -->
      <div v-else class="payslip-cards">
        <div
          v-for="payslip in displayedPayslips"
          :key="payslip.id"
          class="payslip-card"
          :class="{ 'pending-status': payslip.status === 'pending', 'approved-status': payslip.status === 'approved' }"
        >
          <div class="payslip-header">
            <div class="payslip-info">
              <h3 class="payslip-number">{{ payslip.displayNumber }}</h3>
              <p class="payslip-employee">{{ payslip.displayEmployeeName }}</p>
            </div>
            <div class="payslip-status">
              <span class="status-badge" :class="payslip.status">
                {{ payslip.status.charAt(0).toUpperCase() + payslip.status.slice(1) }}
              </span>
            </div>
          </div>

          <div class="payslip-details">
            <div class="detail-row">
              <strong>Period:</strong> {{ payslip.displayPeriod }}
            </div>
            <div class="detail-row">
              <strong>Trips:</strong> {{ payslip.displayTripsCount }}
            </div>
            <div class="detail-row">
              <strong>Total Bags:</strong> {{ payslip.displayTotalBags }}
            </div>
            <div class="detail-row">
              <strong>Gross Pay:</strong> ₱{{ formatCurrency(payslip.displayGrossPay) }}
            </div>
            <div class="detail-row" v-if="payslip.displayTotalDeductions > 0">
              <strong>Total Deductions:</strong> ₱{{ formatCurrency(payslip.displayTotalDeductions) }}
            </div>
            <div class="detail-row font-bold">
              <strong>Net Pay:</strong> ₱{{ formatCurrency(payslip.displayNetPay) }}
            </div>
            <div class="detail-row">
              <strong>Prepared by:</strong> {{ payslip.displayPreparedBy }}
            </div>
            <div class="detail-row">
              <strong>Date Created:</strong> {{ formatDate(payslip.displayCreatedDate) }}
            </div>
          </div>

          <div class="payslip-deductions" v-if="payslip.deductions && payslip.deductions.length > 0">
            <h4>Deductions Applied:</h4>
            <div class="deductions-list">
              <span
                v-for="deduction in payslip.deductions"
                :key="deduction.name"
                class="deduction-tag"
              >
                {{ deduction.name }} ({{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }})
              </span>
            </div>
          </div>

          <div class="payslip-actions">
            <button @click="viewPayslip(payslip)" class="btn-view">
              👁️ View
            </button>
            <button @click="editPayslip(payslip)" class="btn-edit">
              ✏️ Edit
            </button>
            <button @click="printPayslip(payslip)" class="btn-print">
              ️ Print
            </button>
            <button @click="deletePayslip(payslip)" class="btn-delete">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Payslip Modal -->
    <div v-if="viewModalOpen && selectedPayslip" class="modal-overlay" @click="closeViewModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📋 {{ selectedPayslip.payslipNumber }}</h3>
          <button class="modal-close" @click="closeViewModal">&times;</button>
        </div>

        <div class="modal-body">
          <PayslipPreview :payslip="selectedPayslip" />
        </div>

        <div class="modal-footer">
          <button @click="printPayslip(selectedPayslip)" class="btn btn-primary">Print</button>
          <button @click="togglePayslipStatus(selectedPayslip)" class="btn" :class="selectedPayslip.status === 'approved' ? 'btn-secondary' : 'btn-success'">
            {{ selectedPayslip.status === 'approved' ? 'Mark as Pending' : 'Mark as Approved' }}
          </button>
          <button @click="closeViewModal" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- Edit Payslip Modal -->
    <div v-if="editModalOpen && selectedPayslip" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content large-modal" @click.stop>
        <div class="modal-header">
          <h3>✏️ Edit Payslip: {{ selectedPayslip.payslipNumber }}</h3>
          <button class="modal-close" @click="closeEditModal">&times;</button>
        </div>

        <div class="modal-body">
          <EditPayslipForm
            :payslip="selectedPayslip"
            @payslipSaved="handlePayslipUpdated"
            @cancel="closeEditModal"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import PayslipPreview from './PayslipPreview.vue'
import EditPayslipForm from './EditPayslipForm.vue'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'
import { useDataRefresh } from '../composables/useDataRefresh'

// Initialize global refresh system
const { onRefresh } = useDataRefresh()

// Data
const allPayslips = ref([])
const loading = ref(true)
const filterYear = ref('')
const filterEmployee = ref('')
const searchTerm = ref('')
const viewModalOpen = ref(false)
const editModalOpen = ref(false)
const selectedPayslip = ref(null)

// Filters
const availableYears = computed(() => {
  const years = new Set()
  allPayslips.value.forEach(payslip => {
    // Handle both database structure and direct payslip structure
    const payslipNumber = payslip.payslip_number || payslip.payslipNumber
    if (payslipNumber) {
      const year = payslipNumber.split('-')[1]
      if (year) years.add(year)
    }
  })
  return Array.from(years).sort().reverse()
})

const availableEmployees = computed(() => {
  const employees = new Map()
  allPayslips.value.forEach(payslip => {
    // Handle both database structure and direct payslip structure
    let employee = payslip.employee
    if (!employee && payslip.details) {
      try {
        // Handle both JSON string and object cases
        const details = typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details
        employee = details.employee
      } catch (e) {
        console.warn('Failed to parse payslip details:', payslip.details)
      }
    }
    if (employee) {
      employees.set(`${employee.position || 'Unknown'}-${employee.id || employee.uuid}`, {
        id: `${employee.position || 'Unknown'}-${employee.id || employee.uuid}`,
        name: employee.name,
        position: employee.position || 'Unknown'
      })
    }
  })
  return Array.from(employees.values())
})

// Processed payslips with safe data access
const processedPayslips = computed(() => {
  return allPayslips.value.map(payslip => {
    const details = getSafeDetails(payslip)
    const employee = payslip.employee || details?.employee
    const totals = payslip.totals || details?.totals
    const period = payslip.period || details?.period
    const trips = payslip.trips || details?.trips

    // Ensure deductions is always an array - get from details, not from payslip.deductions (which is a number)
    let deductions = details?.deductions || []
    if (typeof deductions === 'string') {
      try {
        deductions = JSON.parse(deductions)
      } catch (e) {
        deductions = []
      }
    }
    if (!Array.isArray(deductions)) {
      deductions = []
    }

    return {
      ...payslip,
      employee,
      totals,
      period,
      trips,
      deductions,
      // Ensure payslip number fields are available for editing
      payslip_number: payslip.payslip_number || payslip.payslipNumber,
      payslipNumber: payslip.payslip_number || payslip.payslipNumber,
      // Computed display properties
      displayNumber: payslip.payslip_number || payslip.payslipNumber,
      displayEmployeeName: employee?.name || '',
      displayEmployeePosition: employee?.position || '',
      displayPeriod: period?.periodText || '',
      displayTripsCount: trips?.length || 0,
      displayTotalBags: totals?.totalBags || 0,
      displayGrossPay: totals?.totalPay || 0,
      displayTotalDeductions: totals?.totalDeductions || 0,
      displayNetPay: totals?.netPay || 0,
      displayPreparedBy: payslip.prepared_by || details?.preparedBy || payslip.preparedBy || '',
      displayCreatedDate: payslip.created_date || payslip.createdDate
    }
  })
})

// Filtered payslips
const displayedPayslips = computed(() => {
  let filtered = processedPayslips.value

  // Filter by year
  if (filterYear.value) {
    filtered = filtered.filter(p => p.displayNumber && p.displayNumber.includes(`-${filterYear.value}-`))
  }

  // Filter by employee
  if (filterEmployee.value) {
    filtered = filtered.filter(p => {
      if (!p.employee) return false
      return `${p.employee.position || 'Unknown'}-${p.employee.id || p.employee.uuid}` === filterEmployee.value
    })
  }

  // Filter by search term
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    filtered = filtered.filter(p =>
      p.displayNumber.toLowerCase().includes(term) ||
      (p.employee?.name && p.employee.name.toLowerCase().includes(term)) ||
      (p.employee?.position && p.employee.position.toLowerCase().includes(term)) ||
      p.displayPreparedBy.toLowerCase().includes(term)
    )
  }

  // Sort by creation date (newest first)
  return filtered.sort((a, b) => {
    const dateA = new Date(a.displayCreatedDate)
    const dateB = new Date(b.displayCreatedDate)
    return dateB - dateA
  })
})

// Statistics
const totalAmountPaid = computed(() => {
  return displayedPayslips.value.reduce((sum, p) => sum + p.displayNetPay, 0)
})

const totalDeductions = computed(() => {
  return displayedPayslips.value.reduce((sum, p) => sum + p.displayTotalDeductions, 0)
})

const averageNetPay = computed(() => {
  if (displayedPayslips.value.length === 0) return 0
  return totalAmountPaid.value / displayedPayslips.value.length
})

// Helper methods for safe data access
const getSafeDetails = (payslip) => {
  if (!payslip.details) return null
  try {
    return typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details
  } catch (e) {
    console.warn('Failed to parse payslip details:', payslip.details)
    return null
  }
}

const getEmployeeInfo = (payslip, field) => {
  const employee = payslip.employee || (getSafeDetails(payslip)?.employee)
  return employee?.[field] || ''
}

const getPayslipInfo = (payslip, field) => {
  const details = getSafeDetails(payslip)
  return details?.[field] || payslip[field] || ''
}

// Methods
const fetchPayslips = async () => {
  try {
    loading.value = true
    const response = await axios.get(`${API_BASE_URL}/payslips`)
    allPayslips.value = response.data.payslips || []
  } catch (error) {
    console.error('Error fetching payslips:', error)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  // Filters are applied automatically by computed properties
}

const clearFilters = () => {
  filterYear.value = ''
  filterEmployee.value = ''
  searchTerm.value = ''
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
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

const viewPayslip = (payslip) => {
  selectedPayslip.value = payslip
  viewModalOpen.value = true
}

const closeViewModal = () => {
  viewModalOpen.value = false
  selectedPayslip.value = null
}

const editPayslip = (payslip) => {
  // Ensure payslip number is available for editing
  const payslipWithNumber = {
    ...payslip,
    payslip_number: payslip.payslip_number || payslip.payslipNumber || payslip.displayNumber,
    payslipNumber: payslip.payslip_number || payslip.payslipNumber || payslip.displayNumber
  }
  selectedPayslip.value = payslipWithNumber
  editModalOpen.value = true
}

const closeEditModal = () => {
  editModalOpen.value = false
  selectedPayslip.value = null
}

const printPayslip = (payslip) => {
  if (confirm('Do you want to print this payslip?')) {
    // Check if PDF blob URL is available
    const payslipDetails = getSafeDetails(payslip)

    if (payslipDetails?.blobUrl) {
      // Use the pre-generated PDF blob URL
      window.open(payslipDetails.blobUrl, '_blank')
      return
    }

    // Fallback to HTML generation if no PDF blob URL

    // Import payslip renderer for consistent fallback
    import('../composables/usePayslipRenderer.js').then(renderer => {
      // Prepare payslip data with proper createdDate field for the renderer
      const payslipForPrint = {
        ...payslip,
        createdDate: payslip.displayCreatedDate || payslip.created_date || payslip.createdDate
      }
      const htmlContent = renderer.default.generatePayslipHTML(payslipForPrint, true)

      // Create new window with consistent content
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Please allow popups for printing to work.')
        return
      }

      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.document.title = `${payslip.displayNumber}_${payslip.displayEmployeeName.replace(/\s+/g, '_')}.pdf`

      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
      }
    }).catch(error => {
      console.error('Failed to import renderer for fallback print:', error)
      // Fallback to simple alert if renderer import fails
      alert('Print functionality is temporarily unavailable. PDF download should work.')
    })
  }
}



const deletePayslip = async (payslip) => {
  if (confirm(`Are you sure you want to delete payslip "${payslip.displayNumber}"? This cannot be undone.`)) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/payslips/${payslip.id}`)
      if (response.status === 200) {
        allPayslips.value = allPayslips.value.filter(p => p.id !== payslip.id)
        alert(`Payslip "${payslip.displayNumber}" deleted successfully.`)
      }
    } catch (error) {
      console.error('Error deleting payslip:', error)
      alert('Failed to delete payslip.')
    }
  }
}

const generateNewPayslipNumber = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/payslips`)
    const existingPayslips = response.data
    const currentYear = new Date().getFullYear()
    const yearPayslips = existingPayslips.filter(payslip =>
      payslip.payslipNumber?.startsWith(`PAY-${currentYear}`))
    const nextNumber = yearPayslips.length + 1
    return `PAY-${currentYear}-${String(nextNumber).padStart(3, '0')}`
  } catch (error) {
    const currentYear = new Date().getFullYear()
    return `PAY-${currentYear}-001`
  }
}

const togglePayslipStatus = async (payslip) => {
  const newStatus = payslip.status === 'approved' ? 'pending' : 'approved'

  try {
    // Try to update via API first
    const response = await axios.put(`${API_BASE_URL}/payslips/${payslip.id}`, {
      ...payslip,
      status: newStatus
    })

    if (response.status === 200) {
      // Update local data
      payslip.status = newStatus

      alert(`Payslip ${payslip.displayNumber} marked as ${newStatus === 'approved' ? 'Approved' : 'Pending'}`)
      return
    }

  } catch (apiError) {
    console.warn('API update failed, using localStorage:', apiError.message)
  }

  // Fallback: Update in localStorage
  try {
    payslip.status = newStatus
    const savedPayslips = JSON.stringify(allPayslips.value)
    localStorage.setItem('payslips', savedPayslips)

    alert(`Payslip ${payslip.displayNumber} marked as ${newStatus === 'approved' ? 'Approved' : 'Pending'} (stored locally)`)

  } catch (localError) {
    console.error('Local storage update failed:', localError)
    alert('Status update failed completely. Please try again.')
  }

  // Close modal if open
  if (selectedPayslip.value) {
    selectedPayslip.value.status = newStatus
  }
}

const handlePayslipUpdated = (updatedPayslip) => {
  const index = allPayslips.value.findIndex(p => p.id === updatedPayslip.id)
  if (index !== -1) {
    allPayslips.value[index] = updatedPayslip
  }
  closeEditModal()
}

// 📡 Listen for payslip creation/deletion events to refresh the list
onRefresh('payslips', async () => {
  await fetchPayslips()
})

// Lifecycle
onMounted(() => {
  fetchPayslips()
})
</script>

<style scoped>
.payslip-history {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem; /* Matching table font size */
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.history-header {
  margin-bottom: 2rem;
}

.history-header h2 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.history-header p {
  margin: 0;
  color: #7f8c8d;
}

.history-filters {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 150px;
}

.filter-group label {
  font-weight: bold;
  font-size: 0.9rem;
  color: #495057;
}

.filter-select,
.filter-input {
  padding: 0.5rem;
  border: 2px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: #007bff;
}

.btn-clear-filters {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 1.5rem;
}

.btn-clear-filters:hover {
  background: #5a6268;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-card h4 {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 0.9rem;
  text-transform: uppercase;
  font-weight: bold;
}

.stat-card .stat-value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #000;
}

.payslip-list {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6c757d;
}

.loading-spinner {
  font-size: 1.1rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #495057;
}

.payslip-cards {
  display: grid;
  gap: 1.5rem;
}

.payslip-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.payslip-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #007bff;
}

.payslip-card.pending-status {
  border-left: 4px solid #ffc107;
}

.payslip-card.approved-status {
  border-left: 4px solid #28a745;
}

.payslip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.payslip-info h3 {
  margin: 0 0 0.25rem 0;
  color: #007bff;
  font-size: 1.2rem;
}

.payslip-employee {
  margin: 0 0 0.25rem 0;
  color: #2c3e50;
  font-weight: bold;
}

.payslip-position {
  margin: 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.payslip-status {
  text-align: right;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.approved {
  background: #d1ecf1;
  color: #0c5460;
}

.payslip-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.detail-row.font-bold {
  color: #000;
  font-size: 1.1rem;
}

.detail-row strong {
  color: #000;
}

.payslip-deductions {
  margin-bottom: 1rem;
}

.payslip-deductions h4 {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 0.95rem;
}

.deductions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.deduction-tag {
  background: #fff3e0;
  color: #000;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.payslip-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
  flex-wrap: wrap;
}

.btn-view,
.btn-edit,
.btn-duplicate,
.btn-delete {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-view {
  background: #17a2b8;
  color: white;
}

.btn-view:hover {
  background: #138496;
}

.btn-edit {
  background: #ffc107;
  color: #212529;
}

.btn-edit:hover {
  background: #e0a800;
}

.btn-print,
.btn-export {
  background: #17a2b8;
  color: white;
}

.btn-print:hover,
.btn-export:hover {
  background: #138496;
}

.btn-duplicate:hover {
  background: #5a6268;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 0;
  max-width: 90%;
  max-height: 90%;
  overflow-y: auto;
  position: relative;
  width: 800px;
}

.modal-content.large-modal {
  width: 1200px;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 2px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #000;
}

.modal-body {
  padding: 1.5rem;
  max-height: 80vh;
  overflow-y: auto;
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
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  min-width: 120px;
}

/* Custom button styles for modal footer */
.modal-footer .btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.modal-footer .btn-primary:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.modal-footer .btn-success {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

.modal-footer .btn-success:hover {
  background: linear-gradient(135deg, #43a047 0%, #3d8b40 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6);
}

.modal-footer .btn-secondary {
  background: linear-gradient(135deg, #757575 0%, #616161 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(117, 117, 117, 0.4);
}

.modal-footer .btn-secondary:hover {
  background: linear-gradient(135deg, #6d6d6d 0%, #575757 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(117, 117, 117, 0.6);
}

/* Mobile responsive button styles */
@media (max-width: 768px) {
  .modal-footer .btn {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
    min-width: 100px;
  }

  .modal-footer {
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal-footer .btn {
    width: 100%;
    min-width: unset;
  }
}

@media (max-width: 768px) {
  .history-filters {
    flex-direction: column;
  }

  .filter-group {
    min-width: auto;
  }

  .payslip-details {
    grid-template-columns: 1fr;
  }

  .payslip-actions {
    justify-content: center;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
