<template>
  <div class="employee-portal">
    <!-- Standalone Portal Header - No Navigation -->
    <div class="portal-header">
      <div class="portal-branding">
        <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="portal-logo" />
        <div class="portal-title">
          <h1>MTM Enterprise</h1>
          <p>Employee Portal</p>
        </div>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner">Loading payslips...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">❌</div>
      <h3>{{ error.title }}</h3>
      <p>{{ error.message }}</p>
      <button @click="retryLoad" class="btn-retry">Try Again</button>
    </div>

    <!-- Employee Portal Content -->
    <div v-else-if="employee && payslips.length > 0" class="portal-content">
      <!-- Employee Header -->
      <div class="employee-header">
        <div class="header-content">
          <div class="welcome-message">
            <h1>👋 Welcome, {{ employee.name }}!</h1>
            <p>Use "View Details" to see breakdown and "PDF" to download.</p>
          </div>
          <div class="header-actions">
            <div class="session-info" v-if="auth.getCurrentEmployee">
              <div class="session-badge">
                🔒 Authenticated
              </div>
              <div class="session-time" v-if="sessionInfo">
                Session: {{ sessionInfo.remainingMinutes }}min remaining
              </div>
            </div>
            <button @click="handleLogout" class="btn-logout" title="Logout from portal">
              🚪 Logout
            </button>
            <div class="payslip-count">
              <div class="count-badge">{{ payslips.length }}</div>
              <div class="count-label">Payslips Available</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Payslips List -->
      <div class="payslips-section">
        <div class="payslips-grid">
          <div
            v-for="payslip in payslips"
            :key="payslip?.id || `payslip-${Math.random()}`"
            class="payslip-card"
          >
            <div class="payslip-header">
              <div class="payslip-info">
                <h3 class="payslip-number">{{ payslip?.payslipNumber || 'N/A' }}</h3>
                <p class="payslip-employee">{{ payslip.employeeName || 'N/A' }}</p>
              </div>
              <div class="payslip-status">
                <span class="status-badge">Approved</span>
              </div>
            </div>

            <div class="payslip-details">
              <div class="detail-row">
                <strong>Period:</strong> {{ payslip?.period ? payslip.period : 'N/A' }}
              </div>
              <div class="detail-row">
                <strong>Trips:</strong> {{ payslip?.trips?.length || 0 }}
              </div>
              <div class="detail-row">
                <strong>Gross Pay:</strong> ₱{{ formatCurrency(Number(payslip?.grossPay) || 0) }}
              </div>
              <div class="detail-row" v-if="payslip?.totalDeductions > 0">
                <strong>Total Deductions:</strong> ₱{{ formatCurrency(Number(payslip?.totalDeductions) || 0) }}
              </div>
              <div class="detail-row font-bold">
                <strong>Net Pay:</strong> ₱{{ formatCurrency(Number(payslip?.netPay) || 0) }}
              </div>
              <div class="detail-row">
                <strong>Date Created:</strong> {{ formatDate(payslip.createdDate) }}
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
                👁️ View Details
              </button>
              <button @click="downloadPayslip(payslip)" class="btn-download">
                📄 PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="portal-footer">
        <div class="footer-content">
          <div class="company-info">
            <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="footer-logo" />
            <div class="footer-text">
              <h4>MTM ENTERPRISE</h4>
              <p>For any questions, please contact your supervisor.</p>
            </div>
          </div>
          <div class="contact-info">
            <p><strong>Mobile:</strong> 09605638462</p>
            <p><strong>Telegram:</strong> +358-044-978-8592</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="employee && payslips.length === 0" class="empty-state">
      <div class="empty-icon">📄</div>
      <h3>No Payslips Available</h3>
      <p>{{ employee.name }}, you don't have any payslips yet. Please check back later.</p>
    </div>

    <!-- View Payslip Modal -->
    <div v-if="viewModalOpen && selectedPayslip" class="modal-overlay" @click="closeViewModal">
      <div class="modal-content large-modal" @click.stop>
        <div class="modal-header">
          <h3>📋 {{ selectedPayslip.payslipNumber }}</h3>
          <button class="modal-close" @click="closeViewModal">&times;</button>
        </div>

        <div class="modal-body">
          <PayslipPreview :payslip="selectedPayslip" />
        </div>

        <div class="modal-footer">
          <button @click="downloadPayslip(selectedPayslip)" class="btn btn-primary">Print</button>
          <button @click="closeViewModal" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- Hidden PDF Generation Modal -->
    <div v-if="pdfModalOpen && tempPayslip" class="modal-overlay pdf-modal" style="display: none;" aria-hidden="true">
      <div class="modal-content large-modal">
        <div class="modal-body">
          <PayslipPreview :payslip="tempPayslip" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'
import { useAuth } from '@/composables/useAuth'
import { useClientPayslipPDF } from '@/composables/useClientPayslipPDF'
import PayslipPreview from '@/components/PayslipPreview.vue'

// Client-side PDF service
const { openPDFInNewTab } = useClientPayslipPDF()
const pdfModalOpen = ref(false)
const tempPayslip = ref(null)

// Reactive data
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref(null)
const employee = ref(null)
const payslips = ref([])
const expandedPayslips = ref(new Set()) // Keep for template compatibility but not used
const viewModalOpen = ref(false)
const selectedPayslip = ref(null)

// Authentication
const auth = useAuth()
const sessionInfo = computed(() => auth.getSessionInfo())

// Get PIN from route parameters
const employeePin = route.params.pin

const fetchEmployeePayslips = async () => {
  if (!employeePin || !/^\d{4}$/.test(employeePin)) {
    error.value = {
      title: 'Invalid PIN',
      message: 'The PIN in the URL is not valid. Please check the link you received.'
    }
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null

    const response = await axios.get(`${API_BASE_URL}/employee/${employeePin}/payslips`)

    employee.value = response.data.employee
    payslips.value = response.data.payslips

    // Payslips data loaded successfully
    payslips.value.forEach(payslip => {
      // Ensure consistent data structure
      if (!payslip.payslipNumber) {
        console.warn('Payslip missing payslipNumber:', payslip.id)
      }
    })

    // Update authentication state if user is authenticated
    if (auth.isAuthenticated.value) {
      // Session is already active, no need to update
    } else {
      // Create authentication session for backward compatibility
      const authData = {
        pin: employeePin,
        employee: response.data.employee,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
      auth.saveAuthState(authData)
    }

  } catch (err) {
    console.error('Error fetching employee payslips:', err)

    if (err.response?.status === 404) {
      error.value = {
        title: 'Employee Not Found',
        message: 'No employee found with this PIN. Please check the link you received.'
      }
    } else {
      error.value = {
        title: 'Error Loading Payslips',
        message: 'There was a problem loading your payslips. Please try again later.'
      }
    }
  } finally {
    loading.value = false
  }
}

const downloadPayslip = async (payslip) => {
  try {
    const downloadBtn = document.querySelector('.btn-download')
    if (downloadBtn) downloadBtn.textContent = 'Generating PDF...'

    // If we have a Blob URL, open it directly
    if (payslip?.blobUrl && payslip.blobUrl.trim()) {
      window.open(payslip.blobUrl, '_blank')
      if (downloadBtn) downloadBtn.textContent = '📄 PDF'
      return
    }

    // Try server-side PDF generation first
    try {
      console.log('📄 Generating server-side PDF for employee payslip:', payslip.payslipNumber)
      const pdfResponse = await axios.post(`${API_BASE_URL}/payslips/generate-pdf`, payslip, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (pdfResponse.data && pdfResponse.data.size > 0) {
        // Create blob URL from response
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')

        console.log('✅ Server-side PDF generated and opened successfully')
        return
      } else {
        throw new Error('Server PDF generation failed - empty response')
      }

    } catch (serverError) {
      console.warn('Server PDF generation failed, falling back to client-side:', serverError.message)

      // Fallback to client-side PDF generation
      console.log('📄 Falling back to client-side PDF generation for employee payslip:', payslip.payslipNumber)

      // Create temporary modal with payslip data to render PayslipPreview
      tempPayslip.value = {
        ...payslip,
        employee: {
          name: employee.value?.name || payslip.employeeName,
          position: 'N/A' // Employee portal does not track position info
        },
        period: {
          periodText: payslip.period || 'Period not specified'
        },
        preparedBy: payslip.preparedBy || 'MTM Enterprise System'
      }

      pdfModalOpen.value = true

      // Wait for the modal to render
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get the PayslipPreview element from the temporary modal
      const payslipElement = document.querySelector('.pdf-modal .payslip-preview')
      if (!payslipElement) {
        throw new Error('Payslip preview element not found')
      }

      // Generate and open PDF
      await openPDFInNewTab(payslipElement, payslip)

      console.log('✅ Client-side PDF generated and opened successfully')
    }

  } catch (error) {
    console.error('Error downloading payslip:', error)
    const payslipNumber = payslip?.payslipNumber || 'Unknown'

    if (error.response?.status === 404) {
      alert(`PDF Generation Not Supported: ${payslipNumber}\n\nPDF generation is currently not available.\n\nPlease contact your administrator.`)
    } else {
      alert(`PDF Generation Failed: ${payslipNumber}\n\nAll PDF generation methods failed. Please try again later or contact support.\n\nError: ${error.message}`)
    }
  } finally {
    const downloadBtn = document.querySelector('.btn-download')
    if (downloadBtn) downloadBtn.textContent = '📄 PDF'
    // Ensure modal is closed in case of error
    pdfModalOpen.value = false
    tempPayslip.value = null
  }
}

const viewPayslip = (payslip) => {
  selectedPayslip.value = {
    ...payslip,
    employee: {
      name: employee.value?.name || payslip.employeeName,
      position: 'N/A' // Employee portal does not track position info
    },
    period: {
      periodText: payslip.period || 'Period not specified'
    },
    preparedBy: payslip.preparedBy || 'MTM Enterprise System'
  }
  viewModalOpen.value = true
}

const closeViewModal = () => {
  viewModalOpen.value = false
  selectedPayslip.value = null
}

const retryLoad = () => {
  fetchEmployeePayslips()
}

const handleLogout = () => {
  // Perform logout
  auth.logout()

  // Show confirmation
  alert('You have been logged out successfully.')

  // Redirect to login page
  router.push('/login')
}

// Formatting helpers
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatPeriod = (period) => {
  // Handle null/undefined periods
  if (!period) return 'N/A'

  // Handle if period is already a string (periodText)
  if (typeof period === 'string') return period

  // Handle object with periodText
  if (period.periodText) return period.periodText

  // Handle object with startDate/endDate
  if (period.startDate && period.endDate) {
    const start = new Date(period.startDate).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const end = new Date(period.endDate).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    return `${start} to ${end}`
  }

  // Fallback for unexpected formats
  return 'N/A'
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0)
}

// Lifecycle
onMounted(() => {
  fetchEmployeePayslips()
})
</script>

<style scoped>
.employee-portal {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Portal Header - Standalone Branding */
.portal-header {
  background: white;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 100;
}

.portal-branding {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.portal-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: 12px;
}

.portal-title h1 {
  margin: 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.portal-title p {
  margin: 0.25rem 0 0 0;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  text-align: center;
  color: #64748b;
}

.loading-spinner {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.loading-spinner::after {
  content: '';
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-radius: 50%;
  border-top-color: #3b82f6;
  animation: spin 1s ease-in-out infinite;
  margin-left: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  text-align: center;
  padding: 2rem;
  color: #dc2626;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-state h3 {
  margin: 0 0 0.5rem 0;
  color: #dc2626;
}

.btn-retry {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
  transition: background-color 0.2s;
}

.btn-retry:hover {
  background: #b91c1c;
}

/* Portal Content */
.portal-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

/* Employee Header */
.employee-header {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.session-info {
  text-align: center;
  min-width: 120px;
}

.session-badge {
  background: #10b981;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.25rem;
}

.session-time {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
}

.btn-logout {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  white-space: nowrap;
}

.btn-logout:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.welcome-message h1 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
  font-size: 1.8rem;
}

.welcome-message p {
  margin: 0;
  color: #64748b;
  font-size: 1rem;
}

.payslip-count {
  text-align: center;
  min-width: 140px;
}

.count-badge {
  font-size: 2.5rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
}

.count-label {
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
}

/* Payslips Section */
.payslips-section {
  margin-bottom: 2rem;
}

.payslips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* Payslip Cards */
.payslip-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid transparent;
}

.payslip-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #3b82f6;
}

.payslip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f1f5f9;
}

.payslip-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.payslip-date {
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
  color: #475569;
}

.detail-row.font-bold {
  color: #000;
  font-weight: bold;
}

.detail-row strong {
  color: #000;
}

.payslip-deductions h4 {
  margin: 0 0 0.75rem 0;
  color: #dc2626;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.btn-view {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: all 0.3s ease;
  flex: 1;
  max-width: 150px;
}

.btn-view {
  background: #17a2b8;
  color: white;
}

.btn-view:hover {
  background: #138496;
}

.btn-download {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 0.625rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

/* Portal Footer */
.portal-footer {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.company-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.footer-logo {
  width: 50px;
  height: 50px;
  object-fit: contain;
  border-radius: 8px;
}

.footer-text h4 {
  margin: 0 0 0.25rem 0;
  color: #1e293b;
  font-size: 1.1rem;
}

.footer-text p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}

.contact-info {
  text-align: right;
  color: #475569;
}

.contact-info p {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
}

.contact-info p:last-child {
  margin-bottom: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #475569;
}

.empty-state p {
  margin: 0;
  max-width: 400px;
}

/* Enhanced Mobile Responsive Design */
@media (max-width: 768px) {
  .portal-content {
    padding: 1rem 0.5rem;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .header-actions {
    flex-direction: column;
    gap: 1rem;
  }

  .payslips-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .employee-header,
  .portal-footer {
    padding: 1.5rem;
  }

  .footer-content {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }

  .company-info {
    justify-content: center;
  }

  .contact-info {
    text-align: center;
  }

  /* Trip Summary Mobile Styles */
  .trip-summary-card {
    padding: 1.5rem;
  }

  .trip-summary-card h3 {
    font-size: 1.1rem;
  }

  /* ENHANCED MOBILE TABLE OPTIMIZATION */
  .trips-table-container {
    overflow-x: auto !important;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 8px;
    margin: 0 -0.5rem;
    padding: 0;
    max-width: 100vw;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .trips-table-container::after {
    display: block;
  }

  .trips-table {
    min-width: 700px !important;
    width: 700px !important;
    font-size: 0.8rem;
  }

  /* Mobile-optimized column widths */
  .trips-table th,
  .trips-table td {
    padding: 0.4rem 0.5rem !important;
    max-width: 100px !important;
    font-size: 0.8rem;
  }

  .trips-table th:nth-child(1), /* Date */
  .trips-table td:nth-child(1) {
    min-width: 70px !important;
    max-width: 80px !important;
  }

  .trips-table th:nth-child(2), /* Invoice */
  .trips-table td:nth-child(2) {
    min-width: 80px !important;
    max-width: 100px !important;
  }

  .trips-table th:nth-child(3), /* Destination */
  .trips-table td:nth-child(3) {
    min-width: 100px !important;
    max-width: 120px !important;
  }

  .trips-table th:nth-child(4), /* Truck */
  .trips-table td:nth-child(4) {
    min-width: 60px !important;
    max-width: 70px !important;
  }

  .trips-table th:nth-child(5), /* Bags */
  .trips-table td:nth-child(5) {
    min-width: 40px !important;
    max-width: 50px !important;
  }

  .trips-table th:nth-child(6), /* Rate */
  .trips-table td:nth-child(6) {
    min-width: 70px !important;
    max-width: 80px !important;
  }

  .trips-table th:nth-child(7), /* Total */
  .trips-table td:nth-child(7) {
    min-width: 80px !important;
    max-width: 90px !important;
  }
}

@media (max-width: 480px) {
  .employee-header {
    padding: 1rem;
  }

  .portal-footer {
    padding: 1rem;
  }

  .payslip-card {
    padding: 1rem;
  }

  .welcome-message h1 {
    font-size: 1.5rem;
  }

  .count-badge {
    font-size: 2rem;
  }

  .header-actions {
    width: 100%;
  }

  .session-info {
    min-width: auto;
  }

  /* Trip Summary Mobile Styles */
  .trip-summary-card {
    padding: 1rem;
    margin: 0 -1rem;
    border-radius: 0;
  }

  .trip-summary-card h3 {
    font-size: 1rem;
  }

  /* ULTRA-MOBILE OPTIMIZED TABLE */
  .trips-table-container {
    margin: 0 -1rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
  }

  .trips-table-container::after {
    font-size: 0.7rem;
    padding: 0.4rem;
  }

  .trips-table {
    min-width: 600px !important;
    width: 600px !important;
    font-size: 0.75rem;
  }

  /* Even more compact for small screens */
  .trips-table th,
  .trips-table td {
    padding: 0.3rem 0.4rem !important;
    font-size: 0.75rem;
    max-width: 80px !important;
  }

  .trips-table th:nth-child(1), /* Date */
  .trips-table td:nth-child(1) {
    min-width: 60px !important;
    max-width: 70px !important;
  }

  .trips-table th:nth-child(2), /* Invoice */
  .trips-table td:nth-child(2) {
    min-width: 70px !important;
    max-width: 80px !important;
  }

  .trips-table th:nth-child(3), /* Destination */
  .trips-table td:nth-child(3) {
    min-width: 80px !important;
    max-width: 100px !important;
  }

  .trips-table th:nth-child(4), /* Truck */
  .trips-table td:nth-child(4) {
    min-width: 50px !important;
    max-width: 60px !important;
  }

  .trips-table th:nth-child(5), /* Bags */
  .trips-table td:nth-child(5) {
    min-width: 35px !important;
    max-width: 40px !important;
  }

  .trips-table th:nth-child(6), /* Rate */
  .trips-table td:nth-child(6) {
    min-width: 60px !important;
    max-width: 70px !important;
  }

  .trips-table th:nth-child(7), /* Total */
  .trips-table td:nth-child(7) {
    min-width: 70px !important;
    max-width: 80px !important;
  }

  /* Enhanced mobile scroll indicator */
  .trips-table-container::before {
    content: '← Swipe to scroll →';
    display: block;
    text-align: center;
    font-size: 0.7rem;
    color: #64748b;
    padding: 0.25rem;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }
}

/* MOBILE MODAL STYLES */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 100%;
  max-height: 90vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0.5rem;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: #f1f5f9;
  color: #475569;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-basic-info {
  margin-bottom: 1.5rem;
}

.modal-basic-info .basic-row {
  padding: 0.5rem 0;
  font-size: 1rem;
}

.modal-body .payslip-deductions,
.modal-body .payslip-net-summary {
  margin: 1.5rem 0;
}

.trip-summary-in-modal .trip-summary-card {
  margin: 1.5rem -1.5rem -1.5rem -1.5rem;
  border-radius: 0;
  border: none;
  border-top: 1px solid #e2e8f0;
}

.trip-summary-in-modal .trip-summary-card h3 {
  font-size: 1rem;
  padding-bottom: 0.75rem;
}

.trip-summary-in-modal .trips-table {
  font-size: 0.75rem;
}

.trip-summary-in-modal .trips-table th,
.trip-summary-in-modal .trips-table td {
  padding: 0.4rem 0.25rem !important;
  min-width: 60px;
  max-width: 80px;
}

.modal-actions {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

/* Modal animations */
.modal-overlay {
  animation: modalFadeIn 0.3s ease-out;
}

.modal-content {
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
