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
            :class="{ 'expanded': expandedPayslips.has(payslip?.id) }"
          >

            <!-- Basic View (Always Visible) -->
            <div class="basic-view" v-if="payslip">
              <div class="payslip-header">
                <div class="payslip-number">{{ payslip?.payslipNumber || 'N/A' }}</div>
                <div class="payslip-date">{{ formatDate(payslip?.createdDate) }}</div>
              </div>

              <div class="basic-details">
                <div class="basic-row">
                  <strong>Period:</strong>
                  <span>{{ payslip?.period ? payslip.period : 'N/A' }}</span>
                </div>
                <div class="basic-row gross">
                  <strong>Gross Pay:</strong>
                  <span class="amount">₱{{ formatCurrency(Number(payslip?.grossPay) || 0) }}</span>
                </div>
                <div class="basic-row deductions">
                  <strong>Total Deductions:</strong>
                  <span class="deductions">₱{{ formatCurrency(Number(payslip?.totalDeductions) || 0) }}</span>
                </div>
                <div class="basic-row net">
                  <strong>Net Pay:</strong>
                  <span class="net-amount">₱{{ formatCurrency(Number(payslip?.netPay) || 0) }}</span>
                </div>

                <!-- Quick Stats -->
                <div v-if="payslip?.trips && payslip.trips.length > 0" class="quick-stats">
                  <span class="stat-item">📦 {{ payslip.trips.length }} trips</span>
                  <span class="stat-item">💰 {{ (payslip?.deductions || []).length }} deductions</span>
                </div>

                <div class="expand-actions">
                  <button
                    @click.stop="togglePayslipExpansion(payslip?.id)"
                    class="btn-expand"
                    :disabled="!payslip?.id"
                  >
                    {{ expandedPayslips.has(payslip?.id) ? '⬆️ Show Less' : '⬇️ View Details' }}
                  </button>
                  <button
                    @click.stop="downloadPayslip(payslip)"
                    class="btn-download"
                    :disabled="!payslip"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
            </div>

            <!-- Detailed View (Compact - No Trip Table) -->
            <div v-if="expandedPayslips.has(payslip?.id)" class="detailed-view-compact">
              
              <!-- Comprehensive Deductions Breakdown -->
              <div class="payslip-deductions">
                <h4>Deduction Details</h4>
                <div class="deductions-list">
                  <div
                    class="deduction-item"
                    v-for="deduction in (payslip?.deductions || [])"
                    :key="deduction.name || deduction.type || Math.random()"
                    :class="{ 'employee-deduction': deduction.isEmployeeSpecific }"
                  >
                    <span class="deduction-name">
                      {{ deduction.name || 'Unnamed Deduction' }}
                      <span v-if="deduction.isEmployeeSpecific" class="employee-badge">Employee</span>
                    </span>
                    <span class="deduction-amount">-₱{{ formatCurrency(Number(deduction.calculatedAmount) || 0) }}</span>
                  </div>
                </div>
                <div class="total-deductions">
                  <span class="deduction-name total-label"><strong>Total Deductions</strong></span>
                  <span class="deduction-amount total-amount">-₱{{ formatCurrency(Number(payslip?.totalDeductions) || 0) }}</span></div>
              </div>

              <!-- Net Pay Summary -->
              <div class="payslip-net-summary">
                <h4>Pay Summary</h4>
                <div class="summary-row">
                  <span class="summary-label">Gross Pay:</span>
                  <span class="summary-amount">₱{{ formatCurrency(Number(payslip?.grossPay) || 0) }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Total Deductions:</span>
                  <span class="summary-amount deduction-amount">-₱{{ formatCurrency(Number(payslip?.totalDeductions) || 0) }}</span>
                </div>
                <div class="summary-row net-row">
                  <span class="summary-label"><strong>Net Pay:</strong></span>
                  <span class="summary-amount net-amount"><strong>₱{{ formatCurrency(Number(payslip?.netPay) || 0) }}</strong></span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- SEPARATED TRIP SUMMARY SECTIONS -->
        <div class="trip-summaries-container">
          <div
            v-for="payslip in payslips"
            :key="`trip-summary-${payslip?.id || Math.random()}`"
            v-if="payslip && expandedPayslips.has(payslip.id) && payslip.trips && payslip.trips.length > 0"
            class="trip-summary-section"
          >
            <div class="trip-summary-card">
              <h3>📋 Trip Summary - {{ payslip.payslipNumber || 'Unknown' }}</h3>
              <div class="trips-table-container">
                <table class="trips-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice</th>
                      <th>Destination</th>
                      <th>Truck</th>
                      <th>Bags</th>
                      <th>Rate</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="trip in payslip.trips" :key="trip?.id || Math.random()">
                      <td>{{ formatDate(trip?.date) }}</td>
                      <td>{{ trip?.invoiceNumber || trip?.invoice || 'N/A' }}</td>
                      <td>{{ trip?.destination || 'N/A' }}</td>
                      <td>{{ trip?.truckPlate || 'N/A' }}</td>
                      <td>{{ trip?.numberOfBags || trip?.bags || 0 }}</td>
                      <td>₱{{ formatCurrency(trip?.adjustedRate || trip?.rate || 0) }}</td>
                      <td class="trip-total">₱{{ formatCurrency(trip?.total || 0) }}</td>
                    </tr>
                    <tr class="table-footer">
                      <td colspan="6"><strong>Total Earnings</strong></td>
                      <td class="total-gross">₱{{ formatCurrency(Number(payslip.totals?.grossPay || payslip.grossPay || 0)) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'
import { useAuth } from '@/composables/useAuth'

// Reactive data
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref(null)
const employee = ref(null)
const payslips = ref([])
const expandedPayslips = ref(new Set())

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

const downloadPayslip = (payslip) => {
  try {
    // If we have a Blob URL, open it in a new tab/window
    if (payslip?.blobUrl && payslip.blobUrl.trim()) {
      // Show loading feedback
      const downloadBtn = document.querySelector('.btn-download')
      if (downloadBtn) downloadBtn.textContent = 'Opening PDF...'

      // Open the PDF in a new tab
      window.open(payslip.blobUrl, '_blank')

      // Reset button text after a short delay
      setTimeout(() => {
        if (downloadBtn) downloadBtn.textContent = '📄 Download PDF'
      }, 1000)

      return
    }

    // If no Blob URL available, show message with payslip details
    alert(`PDF Export Not Available: ${payslip?.payslipNumber || 'Unknown'}\n\nThe PDF for this payslip is not yet available. Please contact your administrator or try again later.\n\nDetails:\n• Period: ${payslip?.period || 'N/A'}\n• Gross Pay: ₱${formatCurrency(Number(payslip?.grossPay) || 0)}\n• Net Pay: ₱${formatCurrency(Number(payslip?.netPay) || 0)}`)

  } catch (error) {
    console.error('Error downloading payslip:', error)
    alert(`Error downloading payslip: ${payslip?.payslipNumber || 'Unknown'}\n\nPlease try again later or contact support if the problem persists.`)
  }
}

const togglePayslipExpansion = (payslipId) => {
  if (!payslipId) return
  
  if (expandedPayslips.value.has(payslipId)) {
    expandedPayslips.value.delete(payslipId)
  } else {
    expandedPayslips.value.add(payslipId)
  }
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

.basic-details {
  margin-bottom: 1rem;
}

.basic-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
  color: #475569;
}

.basic-row.gross {
  font-weight: 600;
}

.basic-row.deductions {
  color: #dc2626;
}

.basic-row.net {
  border-top: 2px solid #e2e8f0;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  font-weight: 600;
}

.amount {
  font-weight: 700;
  color: #059669;
  font-size: 1rem;
}

.deductions {
  color: #dc2626;
  font-weight: 600;
}

.net-amount {
  font-size: 1.1rem;
  color: #059669;
}

.quick-stats {
  display: flex;
  gap: 1rem;
  margin: 0.75rem 0;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.stat-item {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.expand-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-expand {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 0.625rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-expand:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #334155;
}

.btn-expand:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.btn-download:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
}

.btn-download:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Compact Detailed View */
.detailed-view-compact {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* SEPARATED TRIP SUMMARY STYLES */
.trip-summaries-container {
  margin-top: 2rem;
}

.trip-summary-section {
  margin-bottom: 2rem;
  animation: slideDown 0.3s ease-out;
}

.trip-summary-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 2px solid #3b82f6;
}

.trip-summary-card h3 {
  margin: 0 0 1.5rem 0;
  color: #1e293b;
  font-size: 1.3rem;
  font-weight: 700;
  text-align: center;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
}

/* Trip Summary Table Styles */
.trips-table-container {
  overflow-x: auto !important;
  overflow-y: hidden;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  max-width: 100%;
  position: relative;
}

.trips-table-container::after {
  content: '← Scroll to see more →';
  display: block;
  text-align: center;
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 0.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-style: italic;
}

@media (min-width: 768px) {
  .trips-table-container::after {
    display: none;
  }
}

.trips-table {
  min-width: 700px !important;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  table-layout: auto;
}

/* Force text wrapping and proper overflow handling */
.trips-table th,
.trips-table td {
  padding: 0.5rem 0.75rem !important;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
  white-space: normal !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
  vertical-align: top;
  max-width: 150px;
  min-width: 80px;
}

.trips-table th {
  background: #f8fafc !important;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0 !important;
  position: sticky !important;
  top: 0;
  z-index: 2;
}

/* Specific column optimizations */
.trips-table th:nth-child(1), /* Date */
.trips-table td:nth-child(1) {
  min-width: 80px !important;
  max-width: 100px !important;
  white-space: normal !important;
}

.trips-table th:nth-child(2), /* Invoice */
.trips-table td:nth-child(2) {
  min-width: 100px !important;
  max-width: 120px !important;
  white-space: normal !important;
  word-wrap: break-word !important;
}

.trips-table th:nth-child(3), /* Destination */
.trips-table td:nth-child(3) {
  min-width: 120px !important;
  max-width: 180px !important;
  white-space: normal !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
}

.trips-table th:nth-child(4), /* Truck */
.trips-table td:nth-child(4) {
  min-width: 70px !important;
  max-width: 90px !important;
  text-align: center;
}

.trips-table th:nth-child(5), /* Bags */
.trips-table td:nth-child(5) {
  min-width: 50px !important;
  max-width: 70px !important;
  text-align: center;
}

.trips-table th:nth-child(6), /* Rate */
.trips-table td:nth-child(6) {
  min-width: 80px !important;
  max-width: 100px !important;
  text-align: right;
}

.trips-table th:nth-child(7), /* Total */
.trips-table td:nth-child(7) {
  min-width: 90px !important;
  max-width: 110px !important;
  text-align: right;
}

/* Footer styling */
.trip-total {
  font-weight: 600;
  color: #059669;
  text-align: right !important;
}

.table-footer {
  background: #f0f9ff !important;
  border-top: 2px solid #3b82f6 !important;
}

.table-footer td {
  font-weight: 600;
}

.total-gross {
  font-weight: 700;
  color: #059669;
  font-size: 0.95rem;
  text-align: right !important;
}

/* Deductions Section */
.payslip-deductions {
  margin: 1.5rem 0;
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
  margin-bottom: 1rem;
}

.deduction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #fecddd;
  color: #dc2626;
}

.deduction-name {
  font-weight: 500;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 70%;
}

.deduction-amount {
  font-weight: 600;
}

.employee-deduction {
  background: rgba(239, 246, 255, 0.5);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  margin: 0 -0.5rem;
}

.employee-badge {
  background: #3b82f6;
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 12px;
  margin-left: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.total-deductions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecddd;
  color: #dc2626;
}

.total-deductions .deduction-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.total-deductions .deduction-amount {
  font-weight: 700;
  font-size: 1rem;
}

/* Pay Summary Section */
.payslip-net-summary {
  margin: 1.5rem 0 1rem 0;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.payslip-net-summary h4 {
  margin: 0 0 0.75rem 0;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row.net-row {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-radius: 6px;
  margin: 0.5rem 0 0 0;
  padding: 0.75rem 0.5rem;
  border-bottom: none;
}

.summary-label {
  font-weight: 600;
  color: #334155;
}

.summary-amount {
  font-weight: 700;
  color: #059669;
}

.summary-amount.deduction-amount {
  color: #dc2626;
}

.summary-amount.net-amount {
  font-size: 1.1rem;
  color: #059669;
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
</style>
