<template>
  <div class="payroll-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">💰 Payroll Management</h1>
        <p class="page-subtitle">Generate and manage employee payslips</p>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <div class="filters-content">
        <div class="filter-row">
          <div class="filter-item">
            <label class="filter-label">Start Date</label>
            <input type="date" v-model="startDate" @input="filterEmployeeTripData" class="filter-input" />
          </div>
          <div class="filter-item">
            <label class="filter-label">End Date</label>
            <input type="date" v-model="endDate" @input="filterEmployeeTripData" class="filter-input" />
          </div>
          <div class="filter-item">
            <label class="filter-label">Employee</label>
            <select v-model="selectedEmployeeUuid" @change="filterEmployeeTripData" class="filter-select">
              <option value="">Select Employee</option>
              <option v-for="employee in employees" :key="employee.uuid" :value="employee.uuid">
                {{ employee.name }}
              </option>
            </select>
          </div>
          <div class="filter-item">
            <label class="filter-label">Prepared By</label>
            <input type="text" v-model="preparedBy" placeholder="Enter name" class="filter-input" />
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop Payslip Card -->
    <div class="payslip-wrapper desktop-only">
      <v-card class="payslip-card" elevation="3">
        <v-card-text class="payslip-content">
          <!-- Company Header -->
          <div class="company-header-section">
            <div class="company-logo-section">
              <img src="/mtmlogo.jpeg" alt="MTM Enterprise Logo" class="company-logo" />
            </div>
            <div class="company-info-section">
              <h1 class="company-name">MTM ENTERPRISE</h1>
              <div class="company-details">
                <p>0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan</p>
                <p>TIN # 175-434-337-000</p>
                <p>Mobile No. 09605638462 / Telegram No. +358-044-978-8592</p>
              </div>
            </div>
            <div class="payslip-title-section">
              <h2 class="payslip-title">PAYSLIP</h2>
            </div>
          </div>

          <!-- Employee Information -->
          <div class="employee-info-grid">
            <div class="employee-details">
              <div class="info-row">
                <span class="info-label">Employee Name:</span>
                <span class="info-value">{{ selectedEmployeeName }}</span>
              </div>
            </div>
            <div class="payslip-details">
              <div class="info-row">
                <span class="info-label">Payslip Number:</span>
                <span class="info-value">{{ payslipNumber }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Period Covered:</span>
                <span class="info-value">{{ formatPeriod() }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date Generated:</span>
                <span class="info-value">{{ formatDate(new Date()) }}</span>
              </div>
            </div>
          </div>

          <!-- Scrollable Table Container -->
          <div class="table-scroll-container">
            <table class="payslip-table">
              <thead class="table-header">
                <tr class="header-row">
                  <th class="col-date">DATE</th>
                  <th class="col-plate">PLATE NUMBER</th>
                  <th class="col-invoice">INVOICE NUMBER</th>
                  <th class="col-destination">DESTINATION</th>
                  <th class="col-bags">BAGS</th>
                  <th class="col-position">POS</th>
                  <th class="col-rate">RATE</th>
                  <th class="col-total">TOTAL</th>
                </tr>
              </thead>
              <tbody class="table-body">
                <!-- Data rows -->
                <tr v-for="(trip, index) in filteredEmployeeTrips" :key="trip.id" class="data-row" :class="{ 'alt-row': index % 2 === 1 }">
                  <td class="col-date">{{ formatDateShort(trip.date) }}</td>
                  <td class="col-plate">{{ trip.truckPlate }}</td>
                  <td class="col-invoice">{{ trip.invoiceNumber }}</td>
                  <td class="col-destination">{{ trip.fullDestination }}</td>
                  <td class="col-bags text-center">{{ trip.numberOfBags }}</td>
                  <td class="col-position text-center">{{ formatEmployeeRole(trip._role) }}</td>
                  <td class="col-rate text-right">{{ trip._rate ? formatCurrency(trip._rate - 4) : '0.00' }}</td>
                  <td class="col-total text-right">{{ trip._rate && trip.numberOfBags ? formatCurrency((trip._rate - 4) * trip.numberOfBags * trip._commission) : '0.00' }}</td>
                </tr>

                <!-- Spacer row -->
                <tr class="spacer-row">
                  <td colspan="8" class="spacer-cell"></td>
                </tr>

                <!-- Totals section -->
                <tr class="totals-row">
                  <td colspan="4" class="totals-label-cell">
                    <span class="totals-label">GROSS PAY:</span>
                  </td>
                  <td class="totals-bags-cell text-center">
                    <span class="totals-bags">{{ totalBags }}</span>
                  </td>
                  <td colspan="2" class="empty-cell"></td>
                  <td class="totals-amount-cell text-right">
                    <span class="totals-amount">₱{{ formatCurrency(totalPay) }}</span>
                  </td>
                </tr>

                <!-- Individual Deductions rows -->
                <tr v-for="(deduction, index) in deductions" :key="deduction.name + index" class="deduction-row">
                  <td colspan="7" class="deduction-label-cell">
                    <span class="deduction-label">
                      {{ deduction.name }}
                      <span class="deduction-indicator">
                        ({{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }})
                      </span>
                    </span>
                  </td>
                  <td class="deduction-amount-cell text-right">
                    <span class="deduction-amount">
                      -₱{{ formatCurrency(calculateDeductionAmount(deduction)) }}
                    </span>
                  </td>
                </tr>

                <!-- Total Deductions row -->
                <tr v-if="deductions.length > 0" class="total-deductions-row">
                  <td colspan="7" class="total-deductions-label-cell">
                    <span class="total-deductions-label">TOTAL DEDUCTIONS:</span>
                  </td>
                  <td class="total-deductions-amount-cell text-right">
                    <span class="total-deductions-amount">-₱{{ formatCurrency(totalDeductions) }}</span>
                  </td>
                </tr>

                <!-- Net Pay row -->
                <tr v-if="deductions.length > 0" class="net-pay-row">
                  <td colspan="7" class="net-pay-label-cell">
                    <span class="net-pay-label">NET PAY:</span>
                  </td>
                  <td class="net-pay-amount-cell text-right">
                    <span class="net-pay-amount">₱{{ formatCurrency(netPay) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Prepared by Section -->
          <div class="prepared-by-section">
            <div class="prepared-by-content">
              <span class="prepared-by-label">Prepared by:</span>
              <span class="prepared-by-value">{{ preparedBy || '_______________________________' }}</span>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Mobile Native Payslip Cards -->
    <div class="mobile-payslip-cards mobile-only">
      <!-- Payslip Header Card -->
      <div class="payslip-header-card">
        <div class="card-header-native">
          <div class="payslip-identifier">
            <div class="payslip-badge">PAYSLIP</div>
            <div class="payslip-number">{{ payslipNumber }}</div>
          </div>
          <div class="payslip-amount">
            <div class="amount-primary">₱{{ formatCurrency(netPay) }}</div>
            <div class="amount-secondary">Net Pay</div>
          </div>
        </div>

        <div class="employee-section">
          <div class="employee-info">
            <div class="employee-name">
              <div class="name-label">👤 Employee</div>
              <div class="name-value">{{ selectedEmployeeName }}</div>
            </div>
            <div class="period-info">
              <div class="period-label">📅 Period</div>
              <div class="period-value">{{ formatPeriod() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Trip Details Cards -->
      <div v-for="(trip, index) in filteredEmployeeTrips" :key="trip.id" class="trip-detail-card">
        <div class="card-header-native">
          <div class="trip-identifier">
            <div class="invoice-badge">{{ trip.invoiceNumber }}</div>
            <div class="plate-text">{{ trip.truckPlate }}</div>
          </div>
          <div class="trip-amount">
            <div class="amount-primary">₱{{ trip._rate && trip.numberOfBags ? formatCurrency((trip._rate - 4) * trip.numberOfBags * trip._commission) : '0.00' }}</div>
            <div class="amount-secondary" :class="{ 'rate-display': trip._rate, 'rate-warning': !trip._rate }">
              {{ trip._rate ? `₱${formatCurrency(trip._rate - 4)}` : '--' }}
            </div>
          </div>
        </div>

        <div class="route-section">
          <div class="route-visual">
            <div class="route-dot origin-dot"></div>
            <div class="route-line"></div>
            <div class="route-dot destination-dot"></div>
          </div>
          <div class="route-details">
            <div class="route-destination">
              <div class="location-label">📍 Destination</div>
              <div class="location-name">{{ trip.fullDestination }}</div>
            </div>
          </div>
        </div>

        <div class="trip-meta-section">
          <div class="trip-meta">
            <div class="meta-item">
              <span class="meta-icon">📦</span>
              <span class="meta-text">{{ trip.numberOfBags }} bags</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">👤</span>
              <span class="meta-text">{{ formatEmployeeRole(trip._role) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">📅</span>
              <span class="meta-text">{{ formatDateShort(trip.date) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Card -->
      <div class="summary-card">
        <div class="summary-header">
          <h3>💰 Payment Summary</h3>
        </div>

        <div class="summary-details">
          <div class="summary-row">
            <span class="summary-label">Gross Pay:</span>
            <span class="summary-value">₱{{ formatCurrency(totalPay) }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Bags:</span>
            <span class="summary-value">{{ totalBags }}</span>
          </div>

          <div v-if="deductions.length > 0" class="deductions-breakdown">
            <div class="deductions-header">
              <span class="deductions-title">📊 Deductions:</span>
            </div>
            <div v-for="deduction in deductions" :key="deduction.name" class="deduction-item-mobile">
              <span class="deduction-name-mobile">{{ deduction.name }}</span>
              <span class="deduction-value-mobile">
                {{ deduction.type === 'percentage' ? `${deduction.value}%` : `₱${formatCurrency(deduction.value)}` }}
                (₱{{ formatCurrency(calculateDeductionAmount(deduction)) }})
              </span>
            </div>
            <div class="total-deductions-mobile">
              <span class="total-deductions-label">Total Deductions:</span>
              <span class="total-deductions-value">-₱{{ formatCurrency(totalDeductions) }}</span>
            </div>
          </div>

          <div class="net-pay-row-mobile">
            <span class="net-pay-label">💵 Net Pay:</span>
            <span class="net-pay-value">₱{{ formatCurrency(netPay) }}</span>
          </div>
        </div>
      </div>

      <!-- Prepared By Card -->
      <div class="prepared-by-card">
        <div class="prepared-by-content-mobile">
          <span class="prepared-by-label-mobile">✍️ Prepared by:</span>
          <span class="prepared-by-value-mobile">{{ preparedBy || '_______________________________' }}</span>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons-section">
      <div class="action-buttons-grid">
        <button class="action-btn btn-deductions" @click="openDeductionsModal">
          <span class="btn-icon">💰</span>
          <span class="btn-text">Deductions</span>
        </button>
        <button class="action-btn btn-save" @click="savePayslip">
          <span class="btn-icon">💾</span>
          <span class="btn-text">Save Payslip</span>
        </button>
        <button class="action-btn btn-excel" @click="exportExcel">
          <span class="btn-icon">📊</span>
          <span class="btn-text">Export Excel</span>
        </button>
        <button class="action-btn btn-print" @click="printStatement">
          <span class="btn-icon">🖨️</span>
          <span class="btn-text">Print</span>
        </button>
      </div>
    </div>

    <!-- Deductions Modal -->
    <div v-if="showDeductionsModal" class="modal-overlay" @click="closeDeductionsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Add Deductions</h3>
          <button class="modal-close" @click="closeDeductionsModal">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Auto-Applied Deductions Info -->
          <div class="auto-deductions-info" v-if="deductions.length > 0">
            <div class="info-box">
              <h4>✓ Auto-Applied Deductions:</h4>
              <p style="color: #28a745; margin: 0.5rem 0;">
                All saved deductions from your database have been automatically applied to this payslip.
              </p>
              <div class="auto-deductions-list">
                <div v-for="deduction in deductions" :key="deduction.name" class="auto-deduction-item">
                  <strong>{{ deduction.name }}</strong> - {{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }}
                </div>
              </div>
            </div>
            <hr style="margin: 1rem 0; border-color: #dee2e6;">
          </div>

          <!-- Saved Deductions Management -->
          <div class="saved-deductions-management">
            <h4>Manage Saved Deductions:</h4>
            <div class="management-controls">
              <button class="btn btn-manage" @click="showManagementView = !showManagementView">
                {{ showManagementView ? 'Hide' : 'Show' }} Management Tools
              </button>
            </div>

            <div v-if="showManagementView" class="management-view">
              <div class="saved-deductions-list">
                <h5>Current Saved Deductions:</h5>
                <div v-if="availableDeductions.length === 0" class="no-saved-deductions">
                  <p style="color: #6c757d; margin: 0;">No saved deductions available.</p>
                </div>
                <div v-else class="saved-deduction-item" v-for="deduction in availableDeductions" :key="deduction.id">
                  <div class="deduction-details">
                    <strong>{{ deduction.name }}</strong> -
                    <span :class="deduction.type === 'percentage' ? 'percentage-type' : 'amount-type'">
                      {{ deduction.type === 'percentage' ? `${deduction.value}%` : `₱${formatCurrency(deduction.value)}` }}
                    </span>
                  </div>
                  <div class="deduction-actions">
                    <button class="btn-edit" @click="startEditDeduction(deduction)" title="Edit deduction">
                      ✏️
                    </button>
                    <button class="btn-delete" @click="deleteDeduction(deduction)" title="Delete deduction">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              <!-- Edit Deduction Form -->
              <div v-if="isEditing" class="edit-deduction-form" style="margin-top: 2rem; padding: 1rem; background: #fff3e0; border-radius: 8px; border: 1px solid #ffcc02;">
                <h5>Edit Deduction: {{ editDeductionForm.name }}</h5>
                <div class="form-group">
                  <label for="edit-deduction-name">Deduction Name:</label>
                  <input type="text" id="edit-deduction-name" v-model="editDeductionForm.name" placeholder="Enter deduction name" class="deduction-input" />
                </div>
                <div class="form-group">
                  <label for="edit-deduction-type">Deduction Type:</label>
                  <select id="edit-deduction-type" v-model="editDeductionForm.type" class="deduction-select">
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Fixed Amount</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="edit-deduction-value">Value:</label>
                  <input type="number" id="edit-deduction-value" v-model="editDeductionForm.value" :placeholder="editDeductionForm.type === 'percentage' ? 'Enter percentage' : 'Enter amount'" class="deduction-input" :step="editDeductionForm.type === 'percentage' ? '0.01' : '0.01'" min="0" />
                </div>
                <div class="form-actions">
                  <button class="btn btn-add" @click="updateDeduction">Update Deduction</button>
                  <button class="btn btn-clear" @click="cancelEdit">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <hr style="margin: 1rem 0; border-color: #dee2e6;">

          <!-- Quick Add Section - Available Deductions (if any exist) -->
          <div class="deduction-quick-add" v-if="availableDeductions.length > 0">
            <h4>Additional Saved Deductions:</h4>
            <div class="deduction-templates">
              <div class="template-grid">
                <button
                  v-for="deduction in availableDeductions"
                  :key="deduction.id"
                  class="btn-template"
                  @click="quickAddDeduction(deduction)"
                >
                  {{ deduction.name }}<br>
                  <small>{{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }}</small>
                </button>
              </div>
            </div>
            <hr style="margin: 1rem 0; border-color: #dee2e6;">
          </div>

          <!-- Info message when no saved deductions -->
          <div class="deduction-info-message" v-if="availableDeductions.length === 0">
            <p style="color: #6c757d; font-size: 0.9rem; margin: 0;">
              <em>No saved deductions available. Add custom deductions below, or create favorites by saving commonly used ones.</em>
            </p>
          </div>

          <!-- Custom Add Section -->
          <div class="deduction-form">
            <h4>Add Custom Deduction:</h4>
            <div class="form-group">
              <label for="deduction-name">Deduction Name:</label>
              <input type="text" id="deduction-name" v-model="newDeduction.name" placeholder="Enter deduction name" class="deduction-input" />
            </div>

            <div class="form-group">
              <label for="deduction-type">Deduction Type:</label>
              <select id="deduction-type" v-model="newDeduction.type" class="deduction-select">
                <option value="percentage">Percentage (%)</option>
                <option value="amount">Fixed Amount</option>
              </select>
            </div>

            <div class="form-group">
              <label for="deduction-value">Value:</label>
              <input type="number" id="deduction-value" v-model="newDeduction.value" :placeholder="newDeduction.type === 'percentage' ? 'Enter percentage' : 'Enter amount'" class="deduction-input" :step="newDeduction.type === 'percentage' ? '0.01' : '0.01'" min="0" />
            </div>

            <div class="form-actions">
              <button class="btn btn-add" @click="addDeduction">Add Deduction</button>
              <button class="btn btn-clear" @click="clearForm">Clear</button>
            </div>
          </div>

          <div class="deductions-list" v-if="deductions.length > 0">
            <h4>Current Deductions:</h4>
            <div class="deduction-item" v-for="(deduction, index) in deductions" :key="index">
              <span class="deduction-name">{{ deduction.name }}</span>
              <span class="deduction-value">
                {{ deduction.type === 'percentage' ? `${deduction.value}%` : `₱${formatCurrency(deduction.value)}` }}
              </span>
              <button class="btn-remove" @click="removeDeduction(index)">Remove</button>
            </div>
          </div>

          <div class="deductions-summary" v-if="deductions.length > 0">
            <div class="summary-item">
              <strong>Gross Pay:</strong> ₱{{ formatCurrency(totalPay) }}
            </div>
            <div class="summary-item">
              <strong>Total Deductions:</strong> ₱{{ formatCurrency(totalDeductions) }}
            </div>
            <div class="summary-item total-net-pay">
              <strong>Net Pay:</strong> ₱{{ formatCurrency(netPay) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'
import { useDataRefresh } from '../composables/useDataRefresh'

// Initialize global refresh system
const { triggerRefresh } = useDataRefresh()

const trips = ref([])
const employees = ref([])
const startDate = ref('')
const endDate = ref('')
const selectedEmployeeUuid = ref('')
const preparedBy = ref('')
const payslipNumber = ref('')

// Available default deductions from server
const availableDeductions = ref([])

// Deductions data
const showDeductionsModal = ref(false)
const deductions = ref([])
const newDeduction = ref({
  name: '',
  type: 'percentage',
  value: 0
})

// Management view
const showManagementView = ref(false)

// Computed properties
const selectedEmployeeName = computed(() => {
  if (!selectedEmployeeUuid.value) return ''

  const employee = employees.value.find(emp => emp.uuid === selectedEmployeeUuid.value)
  return employee ? employee.name : ''

  // Legacy code - remove when verified working
  // if (!selectedEmployeeId.value) return ''
  // Parse position from the selectedEmployeeId (format: "driver-1" or "helper-1")
  // const [position, id] = selectedEmployeeId.value.split('-')
  // if (position === 'driver') {
  //   const driver = drivers.value.find(d => d.id == id)
  //   if (driver) return driver.name
  // } else if (position === 'helper') {
  //   const helper = helpers.value.find(h => h.id == id)
  //   if (helper) return helper.name
  // }
  // return ''
})

const expandEmployeeTrips = (trips) => {
  const expandedTrips = []

  trips.forEach(trip => {
    // If employee was driver, add a driver entry
    if (trip.driver === selectedEmployeeUuid.value) {
      expandedTrips.push({
        ...trip,
        // Map database snake_case fields to camelCase for component use
      truckPlate: trip.truckPlate,
        invoiceNumber: trip.invoiceNumber,
        fullDestination: trip.fullDestination || trip.destination,
        numberOfBags: trip.numberOfBags,
        _role: 'D', // Driver marker
        _commission: 0.11,
        _displayPosition: 'Driver'
      })
    }

    // If employee was helper (and different from driver), add a helper entry
    // Or if employee was both roles, add both entries
    if (trip.helper === selectedEmployeeUuid.value) {
      expandedTrips.push({
        ...trip,
        // Map database snake_case fields to camelCase for component use
        truckPlate: trip.truckPlate,
        invoiceNumber: trip.invoiceNumber,
        fullDestination: trip.fullDestination || trip.destination,
        numberOfBags: trip.numberOfBags,
        _role: 'H', // Helper marker
        _commission: 0.10,
        _displayPosition: 'Helper'
      })
    }
  })

  return expandedTrips
}

// Centralized payslip calculation system for consistency across display, save, and export
const calculatePayslipTotals = (tripsData, deductionsData) => {
  // Calculate gross pay (total pay)
  const grossPay = tripsData.reduce((sum, trip) => {
    if (trip._rate && trip.numberOfBags) {
      const adjustedRate = trip._rate - 4
      const pay = (adjustedRate * trip.numberOfBags) * trip._commission
      return sum + (isNaN(pay) ? 0 : pay)
    }
    return sum
  }, 0)

  // Calculate total deductions
  const totalDeductions = deductionsData.reduce((sum, deduction) => {
    // Ensure deduction value is a number
    const deductionValue = parseFloat(deduction.value) || 0
    if (deduction.type === 'percentage') {
      const percentageAmount = (grossPay * (deductionValue / 100))
      return sum + (isNaN(percentageAmount) ? 0 : percentageAmount)
    } else {
      return sum + (isNaN(deductionValue) ? 0 : deductionValue)
    }
  }, 0)

  // Calculate net pay
  const netPay = grossPay - totalDeductions

  // Calculate total bags
  const totalBags = tripsData.reduce((sum, trip) => {
    const bags = parseInt(trip.numberOfBags) || 0
    return sum + bags
  }, 0)

  return {
    grossPay: isNaN(grossPay) ? 0 : grossPay,
    totalDeductions: isNaN(totalDeductions) ? 0 : totalDeductions,
    netPay: isNaN(netPay) ? 0 : netPay,
    totalBags: totalBags
  }
}

const filteredEmployeeTrips = computed(() => {
  if (!startDate.value || !endDate.value || !selectedEmployeeUuid.value) {
    return []
  }

  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  end.setHours(23, 59, 59, 999)

  // First, filter trips where employee participated
  const participatingTrips = trips.value.filter(trip => {
    const tripDate = new Date(trip.date)
    const isInDateRange = tripDate >= start && tripDate <= end
    const isCompleted = trip.status === 'Completed'

    // Check if the employee participated in this trip (either as driver or helper)
    const employeeParticipated = (trip.driver === selectedEmployeeUuid.value) ||
                                 (trip.helper === selectedEmployeeUuid.value)

    return isInDateRange && isCompleted && employeeParticipated
  })

  // Then expand to show separate entries for each role
  // If employee was both driver and helper on same trip, they get two entries
  return expandEmployeeTrips(participatingTrips).sort((a, b) => {
    // Sort by date, then by truck plate to group related trips together
    if (a.date !== b.date) return new Date(a.date) - new Date(b.date)
    return (a.truckPlate || '').localeCompare(b.truckPlate || '')
  })
})

const totalPay = computed(() => {
  const totals = calculatePayslipTotals(filteredEmployeeTrips.value, deductions.value)
  return totals.grossPay
})

const totalBags = computed(() => {
  const totals = calculatePayslipTotals(filteredEmployeeTrips.value, deductions.value)
  return totals.totalBags
})

const autoApplySavedDeductions = () => {
  if (selectedEmployeeUuid.value && startDate.value && endDate.value && availableDeductions.value.length > 0) {
    // Clear current deductions and auto-apply all saved deductions
    deductions.value = availableDeductions.value.map(deduction => ({
      name: deduction.name,
      type: deduction.type,
      value: deduction.value
    }))

    console.log('Auto-applied deductions:', deductions.value.length, 'items')
  } else {
    // Clear deductions if no filters selected
    deductions.value = []
  }
}

// Edit deduction functionality
const editDeductionForm = ref({
  id: '',
  name: '',
  type: 'percentage',
  value: 0
})

const isEditing = ref(false)

const startEditDeduction = (deduction) => {
  editDeductionForm.value = {
    id: deduction.id,
    name: deduction.name,
    type: deduction.type,
    value: deduction.value
  }
  isEditing.value = true
}

const updateDeduction = async () => {
  if (!editDeductionForm.value.id || !editDeductionForm.value.name || editDeductionForm.value.value <= 0) {
    alert('Please fill in all fields correctly.')
    return
  }

  try {
    const response = await axios.put(`${API_BASE_URL}/deductions/${editDeductionForm.value.id}`, {
      name: editDeductionForm.value.name,
      type: editDeductionForm.value.type,
      value: parseFloat(editDeductionForm.value.value),
      isDefault: false
    })

    if (response.status === 200) {
      // Update local availableDeductions
      const index = availableDeductions.value.findIndex(d => d.id === editDeductionForm.value.id)
      if (index !== -1) {
        availableDeductions.value[index] = {
          ...availableDeductions.value[index],
          name: editDeductionForm.value.name,
          type: editDeductionForm.value.type,
          value: parseFloat(editDeductionForm.value.value)
        }

        // Update current deductions if this deduction is applied
        const currentIndex = deductions.value.findIndex(d => d.name === editDeductionForm.value.name)
        if (currentIndex !== -1) {
          deductions.value[currentIndex] = {
            name: editDeductionForm.value.name,
            type: editDeductionForm.value.type,
            value: parseFloat(editDeductionForm.value.value)
          }
        }
      }

      alert(`Saved deduction "${editDeductionForm.value.name}" updated successfully!`)
      isEditing.value = false
      editDeductionForm.value = { id: '', name: '', type: 'percentage', value: 0 }
    }
  } catch (error) {
    console.error('Error updating deduction:', error)
    alert('Failed to update deduction. Please try again.')
  }
}

const deleteDeduction = async (deduction) => {
  if (confirm(`Are you sure you want to delete "${deduction.name}" from saved deductions? This cannot be undone.`)) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/deductions/${deduction.id}`)

      if (response.status === 200) {
        // Remove from availableDeductions
        availableDeductions.value = availableDeductions.value.filter(d => d.id !== deduction.id)

        // Remove from current deductions if applied
        deductions.value = deductions.value.filter(d => d.name !== deduction.name)

        alert(`Saved deduction "${deduction.name}" deleted successfully!`)
      }
    } catch (error) {
      console.error('Error deleting deduction:', error)
      alert('Failed to delete deduction. Please try again.')
    }
  }
}

const cancelEdit = () => {
  isEditing.value = false
  editDeductionForm.value = { id: '', name: '', type: 'percentage', value: 0 }
}

const totalDeductions = computed(() => {
  const totals = calculatePayslipTotals(filteredEmployeeTrips.value, deductions.value)
  return totals.totalDeductions
})

const netPay = computed(() => {
  const totals = calculatePayslipTotals(filteredEmployeeTrips.value, deductions.value)
  return totals.netPay
})

// Individual deduction amounts calculation
const calculateDeductionAmount = (deduction) => {
  const grossPay = totalPay.value
  const deductionValue = parseFloat(deduction.value) || 0
  return deduction.type === 'percentage'
    ? (grossPay * (deductionValue / 100))
    : deductionValue
}

// Unified formatting helpers for consistent output across all exports
const formatEmployeeRole = (role) => {
  return role === 'D' ? 'Driver' : role === 'H' ? 'Helper' : role
}

const formatDeductionLine = (deduction) => {
  const amount = calculateDeductionAmount(deduction)
  const displayValue = deduction.type === 'percentage'
    ? `${deduction.value}%`
    : `₱${formatCurrency(deduction.value)}`
  return `${deduction.name} (${displayValue})`
}

const formatDeductionAmount = (deduction) => {
  return formatCurrency(calculateDeductionAmount(deduction))
}

// Create unified payslip data structure for ALL outputs (display, exports, print)
const getUnifiedPayslipData = () => {
  return {
    // Company information
    company: {
      name: 'MTM ENTERPRISE',
      address: '0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan',
      tin: 'TIN # 175-434-337-000',
      contact: 'Mobile No. 09605638462 / Telegram No. +358-044-978-8592'
    },

    // Employee information (same as main display)
    employee: {
      name: selectedEmployeeName.value // Only name, no UUID like main display
    },

    // Payslip metadata (exact same format as main display)
    payslip: {
      number: payslipNumber.value,
      period: formatPeriod(), // "start_date to end_date" format
      dateGenerated: formatDate(new Date()) // Long date format like main display
    },

    // Prepared by (same as footer)
    preparedBy: preparedBy.value,

    // Trips data (same formatting as table display)
    trips: filteredEmployeeTrips.value.map(trip => ({
      date: formatDateShort(trip.date), // Short date format like table
      invoice: trip.invoiceNumber, // "INVOICE NUMBER" column
      destination: trip.fullDestination, // "DESTINATION" column
      plate: trip.truckPlate, // "PLATE NUMBER" column
      bags: trip.numberOfBags, // "BAGS" column
      role: formatEmployeeRole(trip._role), // "POS" column (Driver/Helper)
      rate: `₱${formatCurrency(trip._rate ? trip._rate - 4 : 0)}`, // "RATE" column
      total: `₱${formatCurrency(trip._rate && trip.numberOfBags ? (trip._rate - 4) * trip.numberOfBags * trip._commission : 0)}` // "TOTAL" column
    })),

    // Totals section (exact same as table rows)
    summary: {
      totalBags: totalBags.value,
      grossPay: totalPay.value,
      grossPayFormatted: `₱${formatCurrency(totalPay.value)}`, // "GROSS PAY:" row
      netPay: netPay.value,
      netPayFormatted: `₱${formatCurrency(netPay.value)}` // "NET PAY:" row
    },

    // Deductions (exact same as table rows - using WORKING display logic globally)
    deductions: deductions.value.map(deduction => {
      const deductionValue = Number(deduction.value) || 0
      const displayValueForType = deduction.type === 'percentage' ? `${deductionValue}%` : `₱${formatCurrency(deductionValue)}`

      return {
        name: deduction.name, // Deduction name
        indicator: displayValueForType, // Type indicator like template
        displayValue: displayValueForType,
        amount: `-₱${formatCurrency(calculateDeductionAmount(deduction))}` // Calculated amount
      }
    }),

    // Total deductions (exact same as table row)
    totalDeductions: {
      label: 'TOTAL DEDUCTIONS:',
      amount: `-₱${formatCurrency(totalDeductions.value)}`
    }
  }
}

// Backward compatibility - exports can still use different naming if needed
const createPayslipData = () => {
  const unified = getUnifiedPayslipData()

  // Convert unified structure to export-specific format
  return {
    company: unified.company,
    employee: {
      name: unified.employee.name,
      // No UUID in main display, so exports shouldn't have it either
    },
    payslip: unified.payslip,
    preparedBy: unified.preparedBy,
    trips: unified.trips,
    totals: {
      grossPay: unified.summary.grossPayFormatted,
      totalBags: unified.summary.totalBags.toString(),
      netPay: unified.summary.netPayFormatted
    },
    deductions: unified.deductions.map(d => ({
      name: d.name,
      displayValue: d.indicator,
      amount: d.amount
    })),
    totalsDeductions: {
      label: unified.totalDeductions.label,
      amount: unified.totalDeductions.amount
    }
  }
}

// Deduction methods
const openDeductionsModal = () => {
  showDeductionsModal.value = true
}

const closeDeductionsModal = () => {
  showDeductionsModal.value = false
}

const quickAddDeduction = (templateDeduction) => {
  // Check if deduction already exists
  const exists = deductions.value.find(d => d.name === templateDeduction.name)
  if (exists) {
    alert(`${templateDeduction.name} is already added.`)
    return
  }

  // Add the deduction with its predefined values
  deductions.value.push({
    name: templateDeduction.name,
    type: templateDeduction.type,
    value: templateDeduction.value
  })

  alert(`Added ${templateDeduction.name} (${templateDeduction.type === 'percentage' ? templateDeduction.value + '%' : '₱' + formatCurrency(templateDeduction.value)})`)
}

const addDeduction = async () => {
  if (!newDeduction.value.name || newDeduction.value.value <= 0) {
    alert('Please enter a valid deduction name and value.')
    return
  }

  // Check if deduction with same name already exists in available deductions
  const exists = availableDeductions.value.find(d => d.name.toLowerCase() === newDeduction.value.name.toLowerCase())
  if (exists) {
    alert(`A saved deduction with the name "${newDeduction.value.name}" already exists. Please use that instead or choose a different name.`)
    return
  }

  const deductionData = {
    id: newDeduction.value.id && newDeduction.value.id.includes('-') ? newDeduction.value.id : `custom-${Date.now()}`,
    name: newDeduction.value.name,
    type: newDeduction.value.type,
    value: parseFloat(newDeduction.value.value),
    isCustom: true
  }

  try {
    // Save to database first
    const response = await axios.post(`${API_BASE_URL}/deductions`, deductionData)

    if (response.status === 201) {
      // Add to local deductions for this session
      deductions.value.push({
        name: deductionData.name,
        type: deductionData.type,
        value: deductionData.value
      })

      // Add to available deductions for future quick-add
      availableDeductions.value.push(deductionData)

      alert(`Custom deduction "${deductionData.name}" saved and added! It will be available for quick-add in future sessions.`)

      clearForm()
    } else {
      throw new Error('Failed to save deduction')
    }
  } catch (error) {
    console.error('Error saving deduction:', error)
    alert('Failed to save deduction to database. Please try again.')
  }
}

const removeDeduction = (index) => {
  deductions.value.splice(index, 1)
}

const clearForm = () => {
  newDeduction.value = {
    name: '',
    type: 'percentage',
    value: 0
  }
}

// Methods
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH')
}

const formatDateShort = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatPeriod = () => {
  if (!startDate.value || !endDate.value) return 'Please select date range'
  return `${formatDate(startDate.value)} to ${formatDate(endDate.value)}`
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

const filterEmployeeTripData = () => {
  // Generate new payslip number whenever filters change (especially dates)
  generatePayslipNumber()

  // Auto-apply saved deductions when filters are valid
  autoApplySavedDeductions()

  // This is called when filters change, computed property will automatically update
  console.log('Filtering with:', {
    selectedEmployeeUuid: selectedEmployeeUuid.value,
    selectedEmployeeName: selectedEmployeeName.value,
    autoDeductions: deductions.value.length,
    payslipNumber: payslipNumber.value
  })
}

const exportPDF = () => {
  // Create a new window for PDF export
  const pdfWindow = window.open('', '_blank')
  if (!pdfWindow) {
    alert('Please allow popups for PDF export to work.')
    return
  }

  // Use unified data to prevent undefined/NAN values
  const payslip = getUnifiedPayslipData()

  const companyInfo = `${payslip.company.name}<br>
${payslip.company.address}<br>
${payslip.company.tin}<br>
${payslip.company.contact}`.replace(/\n/g, '<br>')

  let tableHTML = `
<table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: 'Courier New', monospace; margin-top: 20px;">
<thead>
<tr style="background: #f0f0f0;">
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">DATE</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">PLATE NUMBER</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">INVOICE NUMBER</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">DESTINATION</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">BAGS</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">POS</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">RATE</th>
<th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">TOTAL</th>
</tr>
</thead>
<tbody>`

// Use unified trip data to avoid undefined values
payslip.trips.forEach((trip, index) => {
    const bgColor = index % 2 === 1 ? '#fafafa' : 'white'
    tableHTML += `
<tr style="background: ${bgColor}; page-break-inside: avoid;">
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.date}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.plate}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.invoice}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.destination}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.bags}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px;">${trip.role}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: right; font-size: 8px;">${trip.rate}</td>
<td style="border: 1px solid #000; padding: 2px; text-align: right; font-size: 8px;">${trip.total}</td>
</tr>`
  })

    tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td colspan="4" style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 12px;">GROSS PAY:</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 14px;">${totalBags.value}</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 14px;">₱${formatCurrency(totalPay.value)}</td>
</tr>`

  // First show NET PAY above the table, then deductions below
  tableHTML += `
<tr style="background: #d1ecf1; font-weight: bold; border: 2px solid #28a745;">
<td colspan="4" style="border: 2px solid #28a745; padding: 10px; text-align: left; font-size: 12px; color: #0c5460;">NET PAY:</td>
<td style="border: 2px solid #28a745; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #28a745; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #28a745; padding: 10px; text-align: right; font-size: 16px; color: #28a745;">₱${formatCurrency(netPay.value)}</td>
</tr>`

  const employeeInfo = `<strong>Employee Name:</strong> ${selectedEmployeeName.value}<br>
<strong>Employee UUID:</strong> ${selectedEmployeeUuid.value}<br>
<strong>Payslip Number:</strong> ${payslipNumber.value}<br>
<strong>Period Covered:</strong> ${formatPeriod()}<br>
<strong>Date Generated:</strong> ${formatDate(new Date())}`

  const printContent = `
<!DOCTYPE html>
<html>
<head>
<title>Print Preview</title>
<style>
@media print {
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; padding: 20mm; }
  .company-name-pdf { font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 20px; }
  .company-details-pdf { font-size: 12px; text-align: center; line-height: 1.4; margin-bottom: 20px; }
  .employee-info-pdf { margin-bottom: 20px; font-size: 12px; }
  @page { size: A4; margin: 25mm; orientation: portrait; }
}
</style>
</head>
<body style="font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: white; margin: 0; padding: 20px;">
<div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
<h1 class="company-name-pdf">MTM ENTERPRISE</h1>
<div class="company-details-pdf">
${companyInfo}
</div>
<h2 style="font-size: 18px; font-weight: bold; margin: 15px 0;">PAYSLIP</h2>
</div>

<div class="employee-info-pdf" style="margin-top: 15px; line-height: 1.6;">
${employeeInfo}
</div>

${tableHTML}
</body>
</html>`

  pdfWindow.document.write(printContent)
  pdfWindow.document.close()

  // Automatically trigger print dialog when content loads
  pdfWindow.onload = () => {
    pdfWindow.print()
  }

  alert('PDF export started! A print dialog will open. Select "Save as PDF" in your browser\'s print dialog to create the PDF file.')
}

const exportExcel = () => {
  const payslip = createPayslipData()

  // Create deductions data using unified formatting (already calculated in UnifiedPayslipData)
  let deductionsData = []
  if (payslip.deductions.length > 0) {
    deductionsData = payslip.deductions.map(deduction => [
      deduction.name + ' ' + deduction.displayValue,
      '',
      '',
      '',
      '',
      '',
      '',
      deduction.amount
    ])
  }

  // Create Excel data using unified data structure
  const data = [
    ['DATE', 'PLATE NUMBER', 'INVOICE NUMBER', 'DESTINATION', 'BAGS', 'POS', 'RATE', 'TOTAL'],
    ...payslip.trips.map(trip => [
      trip.date,
      trip.plate,
      trip.invoice,
      trip.destination,
      trip.bags,
      trip.role,
      trip.rate,
      trip.total
    ]),
    [`GROSS PAY:`, '', '', '', payslip.totals.totalBags, '', '', payslip.totals.grossPay],
    ...deductionsData,
    ...(payslip.deductions.length > 0 ? [
      [`${payslip.totalsDeductions.label}:`, '', '', '', '', '', '', payslip.totalsDeductions.amount],
      ['NET PAY:', '', '', '', '', '', '', payslip.totals.netPay]
    ] : [])
  ]

  // Add employee and payslip info to CSV data using unified structure
  data.splice(0, 0, [`Employee: ${payslip.employee.name}`, `Payslip: ${payslip.payslip.number}`])
  data.splice(1, 0, ['Period:', payslip.payslip.period, 'Date Generated:', payslip.payslip.dateGenerated])

  // Add prepared by information using unified structure
  data.push([])
  data.push(['Prepared by:', payslip.preparedBy || '_______________________________'])

  // Create CSV content
  const csvContent = data.map(row =>
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n')

  // Download as CSV (which can be opened in Excel)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payslip_${payslip.employee.name}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  alert('Excel export ready! CSV file has been downloaded and can be opened in Excel or similar spreadsheet applications.')
}

const printStatement = () => {
  // Use unified payslip data for print consistency
  const payslip = createPayslipData()

  // Create print-friendly version using unified data
  const companyInfo = `${payslip.company.name}
${payslip.company.address}
${payslip.company.tin}
${payslip.company.contact}`.replace(/\n/g, '<br>')

  const employeeInfo = `<strong>Employee Name:</strong> ${payslip.employee.name}<br>
<strong>Payslip Number:</strong> ${payslip.payslip.number}<br>
<strong>Period Covered:</strong> ${payslip.payslip.period}<br>
<strong>Date Generated:</strong> ${payslip.payslip.dateGenerated}`.replace(/\n/g, '<br>')

  let tableHTML = `
<table style="width: 100%; border-collapse: collapse; font-size: 8px; font-family: 'Courier New', monospace; margin-top: 5px;">
<tbody>
<tr style="background: #f0f0f0;" class="header-row">
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">DATE</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">PLATE NUMBER</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">INVOICE NUMBER</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">DESTINATION</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">BAGS</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">POS</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">RATE</td>
<td style="border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold;">TOTAL</td>
</tr>`

  // Use unified trip data for consistent formatting
  payslip.trips.forEach((trip, index) => {
    const bgColor = index % 2 === 1 ? '#fafafa' : 'white'
    tableHTML += `
<tr style="background: ${bgColor};">
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.date}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.plate}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.invoice}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.destination}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.bags}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.role}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">${trip.rate}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">${trip.total}</td>
</tr>`
  })

  // Add deductions using unified formatting if they exist
  if (payslip.deductions.length > 0) {
    tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 10px;">GROSS PAY:</td>
<td></td>
<td></td>
<td></td>
<td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 10px;">${payslip.totals.totalBags}</td>
<td></td>
<td></td>
<td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 10px;">${payslip.totals.grossPay}</td>
</tr>`

    // Individual deductions breakdown using unified data
    payslip.deductions.forEach(deduction => {
      tableHTML += `
<tr style="background: #fefefa; font-size: 10px;">
<td colspan="7" style="border: 1px solid #000; padding: 4px 8px; text-align: left; color: #000;">${deduction.name} ${deduction.displayValue}:</td>
<td style="border: 1px solid #000; padding: 4px; text-align: right; color: #000;">${deduction.amount}</td>
</tr>`
    })

    // Total deductions and net pay using unified data
    tableHTML += `
<tr style="background: #fff3cd; font-weight: bold;">
<td colspan="7" style="border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; color: #000;">${payslip.totalsDeductions.label}:</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right; color: #000;">${payslip.totalsDeductions.amount}</td>
</tr>
<tr style="background: #d1ecf1; font-weight: bold; border: 2px solid #28a745;">
<td colspan="7" style="border: 2px solid #28a745; padding: 8px; text-align: left; font-size: 12px; color: #000;">NET PAY:</td>
<td style="border: 2px solid #28a745; padding: 8px; text-align: right; font-size: 14px; color: #000;">${payslip.totals.netPay}</td>
</tr>`
  } else {
    // Original table structure when no deductions
    tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td colspan="4" style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 12px;">TOTAL PAY:</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 14px;">${payslip.totals.totalBags}</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 14px;">${payslip.totals.grossPay}</td>
</tr>`
  }

  tableHTML += `
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
  body { font-family: 'Courier New', monospace; color: #000; padding: 20mm 15mm; }
  .no-print { display: none; }
  .company-name-print { font-size: 20px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 10px; }
  .company-details-print { font-size: 10px; text-align: center; line-height: 1.2; margin-bottom: 15px; }
  .payroll-title-print { font-size: 16px; font-weight: bold; text-align: center; margin: 10px 0 15px 0; }
  .employee-info-print { font-size: 10px; margin-bottom: 10px; text-align: left; line-height: 1.3; }
  .header-row { background: #f0f0f0 !important; page-break-after: avoid; }
  @page { size: A4; margin: 15mm; }
}
</style>
</head>
<body>
<div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
<h1 class="company-name-print">MTM ENTERPRISE</h1>
<div class="company-details-print">
${companyInfo}
</div>
<h2 class="payroll-title-print">PAYSLIP</h2>
</div>

<div class="employee-info-print">
${employeeInfo}
</div>

${tableHTML}

<div style="margin-top: 30px; padding: 15px 0; font-size: 14px; font-weight: bold;">
<strong>Prepared by:</strong> ${preparedBy.value || '_______________________________'}
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

const calculateTripRates = (tripsArray, ratesData) => {
  tripsArray.forEach(trip => {
    const destination = trip.destination || ''
    let foundRate = null

    // Parse destination string in format "Aringay - La Union"
    const destinationParts = destination.split(' - ')
    if (destinationParts.length === 2) {
      const townName = destinationParts[0].trim()
      const provinceName = destinationParts[1].trim()

      // Find exact town + province combination
      const exactMatch = ratesData.find(rate =>
        (rate.town?.toLowerCase() === townName.toLowerCase()) &&
        (rate.province?.toLowerCase() === provinceName.toLowerCase())
      )

      if (exactMatch) {
        foundRate = exactMatch.new_rates || exactMatch.rates
      }
    }

    // Store on trip object
    trip._rate = foundRate
    trip._total = foundRate ? foundRate * (trip.numberOfBags || 0) : 0
  })
}

const generatePayslipNumber = () => {
  console.log('generatePayslipNumber called - startDate:', startDate.value, 'endDate:', endDate.value)

  // Check if dates exist and are not empty strings
  if (!startDate.value || startDate.value === '' || !endDate.value || endDate.value === '') {
    console.log('Dates not available, setting P----')
    payslipNumber.value = 'P----'
    return
  }

  try {
    // Generate unique payslip number in format: P1015-25-1761234567890
    // Where:
    // P = Payslip
    // 10 = Start month (October)
    // 15 = End day (15th)
    // 25 = Year (2025)
    // 1761234567890 = Unix timestamp in milliseconds (for uniqueness)

    const startDateObj = new Date(startDate.value)
    const endDateObj = new Date(endDate.value)

    console.log('Date objects:', startDateObj, endDateObj)
    console.log('getTime values:', startDateObj.getTime(), endDateObj.getTime())

    // Validate dates
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      console.log('Invalid date objects, setting P----')
      payslipNumber.value = 'P----'
      return
    }

    const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0') // MM format (01-12)
    const endDay = String(endDateObj.getDate()).padStart(2, '0') // DD format (01-31)
    const year = String(startDateObj.getFullYear()).slice(-2) // YY format (25 for 2025)
    const timestamp = Date.now() // Unix timestamp in milliseconds

    payslipNumber.value = `P${startMonth}${endDay}-${year}-${timestamp}`

    console.log('Generated payslip number:', payslipNumber.value)
  } catch (error) {
    console.error('Error generating payslip number:', error)
    payslipNumber.value = 'P----'
  }
}

const savePayslip = async () => {
  if (!preparedBy.value) {
    alert('Please enter the prepared by name before saving.')
    return
  }

  if (!selectedEmployeeUuid.value || !selectedEmployeeName.value) {
    alert('Please select an employee before saving.')
    return
  }

  if (filteredEmployeeTrips.value.length === 0) {
    alert('No trips found for this employee in the selected date range.')
    return
  }

  // Find the employee from the employees array to get complete info
  const employeeInfo = employees.value.find(emp => emp.uuid === selectedEmployeeUuid.value)

  // Create a clean, serializable payslip data object
  const payslipData = {
    id: Date.now().toString(),
    payslipNumber: payslipNumber.value,
    period: {
      startDate: startDate.value,
      endDate: endDate.value,
      periodText: formatPeriod()
    },
    employee: {
      id: selectedEmployeeUuid.value,
      uuid: selectedEmployeeUuid.value,
      name: selectedEmployeeName.value,
      note: employeeInfo?.note || '' // Include employee note if available
    },
    trips: filteredEmployeeTrips.value.map(trip => ({
      id: trip.id,
      date: trip.date,
      truckPlate: trip.truckPlate,
      invoiceNumber: trip.invoiceNumber,
      destination: trip.fullDestination,
      numberOfBags: trip.numberOfBags,
      _role: trip._role, // Include role marker (D/H)
      _commission: trip._commission, // Include commission rate
      adjustedRate: trip._rate ? trip._rate - 4 : 0, // Show the adjusted rate
      rate: trip._rate,
      total: trip._rate && trip.numberOfBags ? (trip._rate - 4) * trip.numberOfBags * trip._commission : 0 // Use same calculation as display
    })),
    totals: {
      totalBags: totalBags.value,
      grossPay: totalPay.value,
      totalPay: totalPay.value,
      totalDeductions: totalDeductions.value,
      netPay: netPay.value
    },
    deductions: deductions.value.map(deduction => ({
      name: deduction.name,
      type: deduction.type,
      value: deduction.value,
      calculatedAmount: deduction.type === 'percentage'
        ? totalPay.value * (deduction.value / 100)
        : deduction.value
    })),
    preparedBy: preparedBy.value,
    createdDate: new Date().toISOString(),
    status: 'pending',
    systemVersion: '2.0' // Mark as new system version
  }

  // Ensure the data is serializable by creating a deep copy without Vue reactivity
  const serializableData = JSON.parse(JSON.stringify(payslipData))

  try {
    const response = await axios.post(`${API_BASE_URL}/payslips`, serializableData)

    if (response.status === 201) {
      console.log('Payslip saved successfully:', payslipData.payslipNumber)

      const deductionSummary = deductions.value.length > 0
        ? `\nTotal Deductions: ₱${formatCurrency(totalDeductions.value)}\nNet Pay: ₱${formatCurrency(netPay.value)}`
        : ''

      alert(`Payslip ${payslipNumber.value} saved successfully!\n\n📄 Saved to: backend/data/payslips.json\n\n👤 Employee: ${selectedEmployeeName.value}\n💰 Gross Pay: ₱${formatCurrency(totalPay.value)}${deductionSummary}\n📊 Status: Pending (with UUID system)`)

      // Generate new payslip number for next use
      generatePayslipNumber()
    } else {
      throw new Error('Server response error')
    }

  } catch (error) {
    console.error('Error saving payslip to server:', error)

    // Fallback: try to save to localStorage if server fails
    try {
      const localPayslips = JSON.parse(localStorage.getItem('payslipHistory') || '[]')
      localPayslips.push(payslipData)
      localStorage.setItem('payslipHistory', JSON.stringify(localPayslips))

      const deductionSummary = deductions.value.length > 0
        ? `\nTotal Deductions: ₱${formatCurrency(totalDeductions.value)}\nNet Pay: ₱${formatCurrency(netPay.value)}`
        : ''

      alert(`Payslip saved locally (server unavailable).\n\n💾 Saved to browser storage as fallback\n\nPayroll ${payslipNumber.value}\nEmployee: ${selectedEmployeeName.value}\nGross Pay: ₱${formatCurrency(totalPay.value)}${deductionSummary}\nStatus: Pending`)
      generatePayslipNumber()

    } catch (localError) {
      console.error('Local storage fallback failed:', localError)
      alert('❌ Error: All save methods failed. Please try again.')
    }

    // 🔄 TRIGGER GLOBAL REFRESH: Refresh all payslip data across app
    triggerRefresh('payslips')
  }
}

const fetchPayrollData = async () => {
  try {
    // Use wide date range to get all trips (like billing view but for all data)
    const queryParams = `startDate=1900-01-01&endDate=2100-12-31&limit=all&_t=${Date.now()}`

    const [tripsRes, employeesRes, ratesRes, deductionsRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/trips?${queryParams}`),
      axios.get(`${API_BASE_URL}/employees`),
      axios.get(`${API_BASE_URL}/rates`),
      axios.get(`${API_BASE_URL}/deductions`)
    ])

    const rawTrips = tripsRes.data.trips || []
    const ratesData = ratesRes.data

    // Calculate rates and totals for trips
    calculateTripRates(rawTrips, ratesData)

    trips.value = rawTrips
    employees.value = employeesRes.data
    availableDeductions.value = deductionsRes.data

    // Generate payslip number
    await generatePayslipNumber()

  } catch (error) {
    console.error('Error fetching payroll data:', error)
  }
}

// Lifecycle
onMounted(() => {
  fetchPayrollData()
})
</script>

<style scoped>
/* ==========================================================================
   PAYROLL VIEW - SIMPLE & RESPONSIVE LAYOUT
   ========================================================================== */

/* Main Container - Simple Content Layout (like ExpensesView) */
.payroll-container {
  width: 100%;
  padding: 1rem;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Page Header - Content Header */
.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.header-content {
  max-width: 100%;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 0.25rem 0;
}

.page-subtitle {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin: 0;
  font-weight: 400;
}

/* Filters Bar - Compact & Centered */
.filters-bar {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  margin-bottom: 2rem;
  overflow: hidden;
}

.filters-content {
  padding: 1.5rem;
}

.filter-row {
  display: flex;
  gap: 1.5rem;
  align-items: end;
  flex-wrap: wrap;
  justify-content: center;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 160px;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-input,
.filter-select {
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  background: white;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

/* Payslip Wrapper - Responsive Layout */
.payslip-wrapper {
  width: 100%;
  margin-bottom: 2rem;
}

.payslip-card {
  width: 100%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  overflow: hidden;
  box-sizing: border-box;
}

.payslip-content {
  padding: 2rem;
}

/* Company Header Section */
.company-header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  flex-wrap: wrap;
  gap: 1rem;
}

.company-logo-section {
  flex-shrink: 0;
}

.company-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.company-info-section {
  flex: 1;
  text-align: center;
  min-width: 200px;
}

.company-name {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  letter-spacing: 1px;
}

.company-details {
  font-size: 0.8rem;
  color: #6b7280;
  line-height: 1.4;
}

.company-details p {
  margin: 0.2rem 0;
}

.payslip-title-section {
  flex-shrink: 0;
}

.payslip-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #dc2626;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* Employee Information Grid */
.employee-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.employee-details,
.payslip-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-weight: 500;
  color: #1f2937;
  text-align: right;
}

/* Scrollable Table Container - All Data Visible */
.table-scroll-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible; /* Allow all content to show vertically */
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  position: relative;
}

.payslip-table {
  width: 100% !important;
  max-width: 100% !important;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  table-layout: auto;
  min-width: auto !important; /* Allow table to shrink to fit card */
}

.table-header {
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
}

.header-row th {
  padding: 1rem 0.75rem;
  text-align: center;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 10;
}

.header-row th:last-child {
  border-right: none;
}

.table-body {
  background: white;
}

.data-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.2s ease;
}

.data-row:hover {
  background: #f8fafc;
}

.alt-row {
  background: #fafbfc;
}

.data-row td {
  padding: 0.75rem;
  text-align: center;
  border-right: 1px solid #f1f5f9;
  vertical-align: middle;
}

.data-row td:last-child {
  border-right: none;
}

/* Table Column Classes */
.col-date { min-width: 100px; }
.col-plate { min-width: 120px; }
.col-invoice { min-width: 140px; }
.col-destination { min-width: 250px; text-align: left; }
.col-bags { min-width: 80px; }
.col-position { min-width: 60px; }
.col-rate { min-width: 100px; text-align: right; }
.col-total { min-width: 120px; text-align: right; }

/* Special Table Rows */
.totals-row {
  background: linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%);
  border-top: 2px solid #0277bd;
  border-bottom: 2px solid #0277bd;
  font-weight: 700;
}

.totals-row td {
  padding: 1rem 0.75rem;
  color: #0d47a1;
}

.totals-label-cell {
  text-align: left;
  font-size: 0.9rem;
}

.totals-bags-cell {
  font-size: 1rem;
}

.totals-amount-cell {
  font-size: 1.1rem;
  color: #0d47a1;
}

.deduction-row {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
}

.deduction-row td {
  color: #e65100;
  font-weight: 500;
}

.total-deductions-row {
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  border-top: 2px solid #d32f2f;
  border-bottom: 2px solid #d32f2f;
  font-weight: 700;
}

.total-deductions-row td {
  color: #b71c1c;
}

.net-pay-row {
  background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
  border-top: 3px solid #2e7d32;
  border-bottom: 3px solid #2e7d32;
  font-weight: 700;
}

.net-pay-row td {
  color: #1b5e20;
  font-size: 1.1rem;
}

/* Prepared by Section */
.prepared-by-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e5e7eb;
  text-align: center;
}

.prepared-by-content {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.prepared-by-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.prepared-by-value {
  font-weight: 500;
  color: #1f2937;
  border-bottom: 1px dashed #9ca3af;
  min-width: 300px;
  text-align: center;
  padding: 0.25rem;
}

/* Action Buttons Section */
.action-buttons-section {
  text-align: center;
  margin-top: 2rem;
}

.action-buttons-grid {
  display: inline-flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: 2px solid;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  background: white;
  min-width: 140px;
  justify-content: center;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.btn-deductions {
  border-color: #ff9800;
  color: #e65100;
}

.btn-deductions:hover {
  background: #fff3e0;
}

.btn-save {
  border-color: #4caf50;
  color: #2e7d32;
}

.btn-save:hover {
  background: #e8f5e8;
}

.btn-excel {
  border-color: #2196f3;
  color: #0d47a1;
}

.btn-excel:hover {
  background: #e3f2fd;
}

.btn-print {
  border-color: #9c27b0;
  color: #6a1b9a;
}

.btn-print:hover {
  background: #f3e5f5;
}

.btn-icon {
  font-size: 1.1rem;
}

.btn-text {
  font-weight: 600;
}

/* ==========================================================================
   MODAL STYLES & FORM ELEMENTS
   ========================================================================== */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #e5e7eb;
  color: #374151;
}

.modal-body {
  padding: 2rem;
}

/* Enhanced Form Styles for Deductions Modal */
.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Enhanced Input Fields */
.deduction-input,
.deduction-select {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  background: white;
  transition: all 0.3s ease;
  box-sizing: border-box;
  min-height: 44px; /* Better touch targets */
}

.deduction-input::placeholder {
  color: #9ca3af;
  font-style: italic;
}

.deduction-input:focus,
.deduction-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.deduction-input:hover,
.deduction-select:hover {
  border-color: #d1d5db;
}

/* Custom Select Styling */
.deduction-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
  padding-right: 2.5rem;
  cursor: pointer;
}

.deduction-select:focus {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%233b82f6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
}

/* Form Actions & Buttons */
.form-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  min-width: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* Primary Add Button - Bright Green */
.btn-add {
  border-color: #059669;
  background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
}

.btn-add:hover {
  background: linear-gradient(135deg, #047857 0%, #0f766e 100%);
  border-color: #047857;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4);
}

.btn-add:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
}

/* Edit Button - Warm Orange/Apricot */
.btn-edit {
  border-color: #ea580c;
  background: linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #9a3412 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(234, 88, 12, 0.2);
}

.btn-edit:hover {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #b91c1c 100%);
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
}

/* Clear Button - Cool Blue */
.btn-clear {
  border-color: #2563eb;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.btn-clear:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  border-color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

/* Manage Button - Professional Purple */
.btn-manage {
  border-color: #7c3aed;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
}

.btn-manage:hover {
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
  border-color: #6d28d9;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

.btn-manage:active {
  transform: translateY(0);
}

/* Destructive Buttons - Vivid Red */
.btn-delete,
.btn-remove {
  border-color: #dc2626;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
}

.btn-delete:hover,
.btn-remove:hover {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  border-color: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
}

/* Management Section */
.management-controls {
  margin-bottom: 1rem;
}

.btn-manage {
  width: 100%;
  justify-content: center;
}

/* Saved Deductions List */
.saved-deductions-list,
.deductions-list {
  margin-top: 1.5rem;
}

.no-saved-deductions {
  text-align: center;
  color: #6b7280;
  font-style: italic;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.saved-deduction-item,
.deduction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}

.saved-deduction-item:hover,
.deduction-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #d1d5db;
}

.deduction-details,
.deduction-name,
.deduction-value {
  color: #374151;
}

.deduction-actions,
.deduction-actions-right {
  display: flex;
  gap: 0.5rem;
}

.btn-edit,
.btn-delete,
.btn-remove {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  min-width: auto;
}

/* Auto-deductions list */
.auto-deduction-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.auto-deduction-item:last-child {
  border-bottom: none;
}

/* Percentage and Amount Type Indicators */
.percentage-type {
  color: #059669;
  font-weight: 600;
}

.amount-type {
  color: #dc2626;
  font-weight: 600;
}

/* Quick Add Templates */
.deduction-templates {
  margin-top: 1rem;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.btn-template {
  padding: 0.875rem;
  background: #f8fafc;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #374151;
  transition: all 0.2s ease;
  text-align: center;
  cursor: pointer;
}

.btn-template:hover {
  background: #e0f2fe;
  border-color: #0ea5e9;
  color: #0ea5e9;
  transform: translateY(-1px);
}

.btn-template small {
  display: block;
  color: #6b7280;
  margin-top: 0.25rem;
}

/* Auto-Applied Info Box */
.auto-deductions-info {
  margin-bottom: 1.5rem;
}

.info-box {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  padding: 1rem;
  color: #065f46;
}

.info-box h4 {
  margin: 0 0 0.5rem 0;
  color: #047857;
}

/* Responsive Form Styles */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 10px;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    min-width: auto;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }

  .saved-deduction-item,
  .deduction-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .deduction-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

/* Ultra-Compact Mobile-First Design */
@media (max-width: 768px) {
  .payroll-container {
    padding: 0.25rem !important; /* Ultra-minimal padding */
    min-height: auto !important;
    max-height: none !important;
    overflow-y: visible !important;
    display: block !important;
    height: auto !important;
  }

  .page-header {
    margin-bottom: 0.25rem !important;
  }

  .page-title {
    font-size: 0.9rem !important;
    margin: 0 0 0.125rem 0 !important;
  }

  .page-subtitle {
    font-size: 0.7rem !important;
  }

  .filters-bar {
    margin-bottom: 0.25rem !important;
  }

  .filters-content {
    padding: 0.25rem !important;
  }

  .filter-row {
    gap: 0.25rem !important;
  }

  .filter-item {
    min-width: auto !important;
  }

  .filter-input,
  .filter-select {
    padding: 0.375rem 0.5rem !important;
    font-size: 0.75rem !important;
  }

  .payslip-wrapper {
    margin-bottom: 0.25rem !important;
  }

  .payslip-card {
    border-radius: 4px !important;
  }

  .payslip-content {
    padding: 0.25rem !important; /* Ultra-compressed padding */
  }

  .company-header-section {
    margin-bottom: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    gap: 0.25rem !important;
    flex-direction: column !important;
    text-align: center !important;
  }

  .company-logo {
    width: 32px !important; /* Smaller logo */
    height: 32px !important;
  }

  .company-name {
    font-size: 0.9rem !important;
  }

  .company-details {
    font-size: 0.55rem !important;
  }

  .company-details p {
    margin: 0.1rem 0 !important; /* Tighter line spacing */
  }

  .payslip-title {
    font-size: 0.8rem !important;
  }

  .employee-info-grid {
    margin-bottom: 0.5rem !important;
    padding: 0.25rem !important; /* Compressed padding */
    gap: 0.25rem !important;
    grid-template-columns: 1fr !important;
  }

  .info-row {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0.0625rem !important; /* Minimal gap */
    padding: 0.125rem 0 !important; /* Compressed padding */
  }

  .info-label {
    font-size: 0.65rem !important;
  }

  .info-value {
    font-size: 0.7rem !important;
    text-align: left !important;
  }

  .table-scroll-container {
    max-height: 250px !important; /* Reasonable height for mobile */
    border-radius: 3px !important;
  }

  .payslip-table {
    font-size: 0.45rem !important; /* Smaller font for more data */
    min-width: 350px !important; /* Reduced min-width for better fit */
  }

  .header-row th {
    padding: 0.125rem 0.0625rem !important; /* Ultra-compressed padding */
    font-size: 0.4rem !important;
  }

  .data-row td {
    padding: 0.125rem 0.0625rem !important; /* Ultra-compressed cell padding */
  }

  .totals-row td,
  .deduction-row td,
  .total-deductions-row td,
  .net-pay-row td {
    padding: 0.1875rem 0.0625rem !important; /* Slightly more padding for totals */
  }

  .prepared-by-section {
    margin-top: 0.5rem !important;
    padding-top: 0.5rem !important;
  }

  .prepared-by-content {
    padding: 0.25rem !important; /* Compressed padding */
    gap: 0.125rem !important; /* Minimal gap */
    flex-direction: column !important;
  }

  .prepared-by-label {
    font-size: 0.7rem !important;
  }

  .prepared-by-value {
    min-width: 200px !important; /* Reasonable width for mobile */
    font-size: 0.65rem !important;
  }

  .action-buttons-section {
    margin-top: 0.5rem !important;
  }

  .action-buttons-grid {
    gap: 0.125rem !important; /* Minimal gap */
    flex-direction: column !important;
    width: 100% !important;
  }

  .action-btn {
    width: 100% !important;
    padding: 0.375rem 0.5rem !important; /* Compressed button padding */
    font-size: 0.65rem !important;
    min-width: auto !important;
  }
}

/* Extra Small Devices */
@media (max-width: 480px) {
  .payroll-container {
    padding: 0.125rem !important;
  }

  .page-title {
    font-size: 0.9rem !important;
  }

  .page-subtitle {
    font-size: 0.7rem !important;
  }

  .filters-content {
    padding: 0.4rem !important;
  }

  .payslip-content {
    padding: 0.4rem !important;
  }

  .company-logo {
    width: 35px !important;
    height: 35px !important;
  }

  .company-name {
    font-size: 0.9rem !important;
  }

  .company-details {
    font-size: 0.55rem !important;
  }

  .payslip-title {
    font-size: 0.8rem !important;
  }

  .employee-info-grid {
    padding: 0.4rem !important;
  }

  .table-scroll-container {
    max-height: 120px !important;
  }

  .payslip-table {
    font-size: 0.45rem !important;
    min-width: 350px !important;
  }

  .prepared-by-value {
    min-width: 80px !important;
    font-size: 0.65rem !important;
  }

  .action-btn {
    padding: 0.4rem 0.6rem !important;
    font-size: 0.65rem !important;
  }
}

/* Tiny Devices */
@media (max-width: 360px) {
  .payroll-container {
    padding: 0.0625rem !important;
  }

  .page-title {
    font-size: 0.8rem !important;
  }

  .page-subtitle {
    font-size: 0.65rem !important;
  }

  .filters-content {
    padding: 0.3rem !important;
  }

  .payslip-content {
    padding: 0.3rem !important;
  }

  .company-logo {
    width: 30px !important;
    height: 30px !important;
  }

  .company-name {
    font-size: 0.8rem !important;
  }

  .company-details {
    font-size: 0.5rem !important;
  }

  .payslip-title {
    font-size: 0.75rem !important;
  }

  .employee-info-grid {
    padding: 0.3rem !important;
  }

  .table-scroll-container {
    max-height: 100px !important;
  }

  .payslip-table {
    font-size: 0.4rem !important;
    min-width: 300px !important;
  }

  .prepared-by-value {
    min-width: 70px !important;
    font-size: 0.6rem !important;
  }

  .action-btn {
    padding: 0.35rem 0.5rem !important;
    font-size: 0.6rem !important;
  }
}

/* Print Styles */
@media print {
  .payroll-container {
    background: white !important;
    padding: 0 !important;
  }

  .page-header,
  .filters-bar,
  .action-buttons-section {
    display: none !important;
  }

  .payslip-card {
    box-shadow: none !important;
    border: 1px solid #000 !important;
    width: 100% !important;
    max-width: none !important;
  }

  .payslip-content {
    padding: 1rem !important;
  }

  .table-scroll-container {
    overflow: visible !important;
    border: none !important;
  }

  .payslip-table {
    font-size: 0.7rem !important;
  }
}

/* ==========================================================================
   MOBILE NATIVE PAYSLIP CARDS - Matching TripList Theme
   ========================================================================== */

.mobile-payslip-cards {
  width: 100%;
  padding: 0.5rem;
  background: #f8fafc;
  min-height: 100vh;
}

/* Payslip Header Card */
.payslip-header-card {
  background: white;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.payslip-header-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Card Header - Native Style */
.card-header-native {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #f1f5f9;
}

.payslip-identifier {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.payslip-badge {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  background: #f1f5f9;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  display: inline-block;
  border: 1px solid #e2e8f0;
}

.payslip-number {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}

.payslip-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.amount-primary {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
  text-shadow: 0 1px 2px rgba(5, 150, 105, 0.1);
}

.amount-secondary {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
}

/* Employee Section */
.employee-section {
  padding: 1rem 1.5rem;
  background: #fafbfc;
  border-bottom: 1px solid #f1f5f9;
}

.employee-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.employee-name,
.period-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.employee-name:hover,
.period-info:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.name-label,
.period-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.name-value,
.period-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  text-align: right;
}

/* Trip Detail Cards */
.trip-detail-card {
  background: white;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.trip-detail-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.trip-identifier {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.invoice-badge {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  background: #f1f5f9;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  display: inline-block;
  border: 1px solid #e2e8f0;
}

.plate-text {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}

.trip-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.rate-display {
  color: #059669;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.rate-warning {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

/* Route Section - Visual Route */
.route-section {
  padding: 1rem 1.5rem;
  background: #fafbfc;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.route-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.route-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.origin-dot {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.destination-dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.route-line {
  width: 2px;
  height: 24px;
  background: linear-gradient(to bottom, #10b981, #f59e0b);
  border-radius: 1px;
}

.route-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.route-origin,
.route-destination {
  flex: 1;
  text-align: center;
}

.location-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
}

.location-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
}

/* Trip Meta Section */
.trip-meta-section {
  padding: 1rem 1.5rem;
  background: white;
}

.trip-meta {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  flex: 1;
  justify-content: center;
}

.meta-icon {
  font-size: 0.9rem;
}

.meta-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

/* Summary Card */
.summary-card {
  background: white;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.summary-header {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #f1f5f9;
}

.summary-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 700;
}

.summary-details {
  padding: 1rem 1.5rem;
  background: #fafbfc;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.summary-value {
  font-weight: 700;
  color: #1e293b;
  font-size: 0.95rem;
  text-align: right;
}

.deductions-breakdown {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #e2e8f0;
}

.deductions-header {
  margin-bottom: 0.75rem;
}

.deductions-title {
  font-weight: 600;
  color: #374151;
  font-size: 0.85rem;
}

.deduction-item-mobile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.deduction-item-mobile:last-child {
  border-bottom: none;
}

.deduction-name-mobile {
  font-weight: 500;
  color: #374151;
  font-size: 0.8rem;
}

.deduction-value-mobile {
  font-weight: 600;
  color: #dc2626;
  font-size: 0.8rem;
  text-align: right;
}

.total-deductions-mobile {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-deductions-label {
  font-weight: 700;
  color: #dc2626;
  font-size: 0.85rem;
}

.total-deductions-value {
  font-weight: 700;
  color: #dc2626;
  font-size: 0.9rem;
}

.net-pay-row-mobile {
  margin-top: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-radius: 12px;
  border: 2px solid #a7f3d0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.net-pay-label {
  font-weight: 700;
  color: #065f46;
  font-size: 1rem;
}

.net-pay-value {
  font-weight: 700;
  color: #065f46;
  font-size: 1.1rem;
}

/* Prepared By Card */
.prepared-by-card {
  background: white;
  border-radius: 16px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.prepared-by-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.prepared-by-content-mobile {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.prepared-by-label-mobile {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.prepared-by-value-mobile {
  font-weight: 500;
  color: #1e293b;
  border-bottom: 1px dashed #9ca3af;
  min-width: 200px;
  text-align: center;
  padding: 0.25rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

/* Mobile Optimizations */
@media (max-width: 480px) {
  .mobile-payslip-cards {
    padding: 0.25rem;
  }

  .payslip-header-card,
  .trip-detail-card,
  .summary-card,
  .prepared-by-card {
    margin-bottom: 0.75rem;
  }

  .card-header-native {
    padding: 1rem 1.25rem;
  }

  .route-section {
    padding: 0.875rem 1.25rem;
  }

  .trip-meta-section {
    padding: 0.875rem 1.25rem;
  }

  .summary-details {
    padding: 0.875rem 1.25rem;
  }

  .prepared-by-content-mobile {
    padding: 1rem 1.25rem;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prepared-by-value-mobile {
    min-width: 150px;
  }

  .trip-meta {
    flex-direction: column;
    gap: 0.5rem;
  }

  .meta-item {
    justify-content: flex-start;
  }
}

/* Desktop/Mobile Toggle */
@media (min-width: 769px) {
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }
}
</style>
