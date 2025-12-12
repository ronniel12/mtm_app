<template>
  <div class="settings">
    <h3>⚙️ MTM ENTERPRISE Settings</h3>

    <div class="settings-tabs">
      <button
        :class="{ active: activeTab === 'employees' }"
        @click="activeTab = 'employees'"
        class="tab-btn"
      >
        👥 Employees
      </button>
      <button
        :class="{ active: activeTab === 'deductions' }"
        @click="handleTabChange('deductions')"
        class="tab-btn"
      >
        💸 Deductions
      </button>
      <button
        :class="{ active: activeTab === 'vehicles' }"
        @click="activeTab = 'vehicles'"
        class="tab-btn"
      >
        🚛 Vehicles
      </button>
      <button
        :class="{ active: activeTab === 'rates' }"
        @click="activeTab = 'rates'"
        class="tab-btn"
      >
        💰 Rates
      </button>
    </div>

    <div class="tab-content">
      <!-- Employees Tab -->
      <div v-if="activeTab === 'employees'" class="tab-pane">
        <div class="employees-content">
          <!-- Header with Stats and Add Button -->
          <div class="employees-header">
            <div class="header-left">
              <h4 class="section-title">👥 Employee Management</h4>
              <p class="section-subtitle">Manage your team members and their information</p>
            </div>
            <div class="header-right">
              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-number">{{ employees.length }}</div>
                  <div class="stat-label">Total Employees</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ employees.filter(e => e.cashAdvance > 0).length }}</div>
                  <div class="stat-label">With Advances</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ employees.filter(e => e.loans > 0).length }}</div>
                  <div class="stat-label">With Loans</div>
                </div>
              </div>
              <button @click="showAddEmployeeForm = !showAddEmployeeForm" class="btn-add-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {{ showAddEmployeeForm ? 'Cancel' : 'Add Employee' }}
              </button>
            </div>
          </div>

          <!-- Add/Edit Employee Form -->
          <div v-if="showAddEmployeeForm" class="employee-form-container">
            <div class="form-header">
              <h5>{{ editingEmployee ? '✏️ Edit Employee' : '➕ Add New Employee' }}</h5>
              <p>{{ editingEmployee ? 'Update employee information' : 'Enter employee details to add them to your team' }}</p>
            </div>

            <form @submit.prevent="submitEmployeeForm" class="employee-form-modern">
              <!-- Basic Information Card -->
              <div class="form-card">
                <div class="card-header">
                  <div class="card-icon">👤</div>
                  <div class="card-title">Basic Information</div>
                </div>
                <div class="card-content">
                  <div class="form-grid">
                    <div class="form-field">
                      <label for="employeeName" class="field-label">
                        Full Name <span class="required">*</span>
                      </label>
                      <input
                        id="employeeName"
                        v-model="employeeForm.name"
                        type="text"
                        required
                        placeholder="Enter full name"
                        class="field-input"
                      />
                    </div>
                    <div class="form-field">
                      <label for="employeePhone" class="field-label">Phone Number</label>
                      <input
                        id="employeePhone"
                        v-model="employeeForm.phone"
                        type="tel"
                        placeholder="09123456789"
                        class="field-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Employment Details Card -->
              <div class="form-card">
                <div class="card-header">
                  <div class="card-icon">🚛</div>
                  <div class="card-title">Employment Details</div>
                </div>
                <div class="card-content">
                  <div class="form-grid">
                    <div class="form-field">
                      <label for="employeeLicense" class="field-label">Driver's License</label>
                      <input
                        id="employeeLicense"
                        v-model="employeeForm.licenseNumber"
                        type="text"
                        placeholder="A01-12345"
                        class="field-input"
                      />
                    </div>
                    <div class="form-field">
                      <label for="employeeAddress" class="field-label">Address</label>
                      <input
                        id="employeeAddress"
                        v-model="employeeForm.address"
                        type="text"
                        placeholder="Street, City, Province"
                        class="field-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Government IDs Card -->
              <div class="form-card">
                <div class="card-header">
                  <div class="card-icon">📋</div>
                  <div class="card-title">Government IDs</div>
                </div>
                <div class="card-content">
                  <div class="form-grid">
                    <div class="form-field">
                      <label for="pagibigNumber" class="field-label">PAG-IBIG Number</label>
                      <input
                        id="pagibigNumber"
                        v-model="employeeForm.pagibigNumber"
                        type="text"
                        placeholder="123456789012"
                        class="field-input"
                      />
                    </div>
                    <div class="form-field">
                      <label for="sssNumber" class="field-label">SSS Number</label>
                      <input
                        id="sssNumber"
                        v-model="employeeForm.sssNumber"
                        type="text"
                        placeholder="123456789012"
                        class="field-input"
                      />
                    </div>
                    <div class="form-field">
                      <label for="philhealthNumber" class="field-label">PhilHealth Number</label>
                      <input
                        id="philhealthNumber"
                        v-model="employeeForm.philhealthNumber"
                        type="text"
                        placeholder="1234567890123"
                        class="field-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Financial Information Card -->
              <div class="form-card">
                <div class="card-header">
                  <div class="card-icon">💰</div>
                  <div class="card-title">Financial Information</div>
                </div>
                <div class="card-content">
                  <div class="form-grid">
                    <div class="form-field">
                      <label for="cashAdvance" class="field-label">Cash Advance (₱)</label>
                      <input
                        id="cashAdvance"
                        v-model.number="employeeForm.cashAdvance"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="field-input currency"
                      />
                      <div class="field-helper">
                        <input
                          id="autoDeductCashAdvance"
                          v-model="employeeForm.autoDeductCashAdvance"
                          type="checkbox"
                          class="checkbox-small"
                        />
                        <label for="autoDeductCashAdvance" class="checkbox-label-small">Auto-deduct from salary</label>
                      </div>
                    </div>
                    <div class="form-field">
                      <label for="loans" class="field-label">Loans (₱)</label>
                      <input
                        id="loans"
                        v-model.number="employeeForm.loans"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="field-input currency"
                      />
                      <div class="field-helper">
                        <input
                          id="autoDeductLoans"
                          v-model="employeeForm.autoDeductLoans"
                          type="checkbox"
                          class="checkbox-small"
                        />
                        <label for="autoDeductLoans" class="checkbox-label-small">Auto-deduct from salary</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-actions-modern">
                <button @click="resetEmployeeForm" type="button" class="btn-cancel-modern">Cancel</button>
                <button type="submit" class="btn-submit-modern">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17,21 17,13 7,13 7,21"/>
                    <polyline points="7,3 7,8 15,8"/>
                  </svg>
                  {{ editingEmployee ? 'Update Employee' : 'Save Employee' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Empty State -->
          <div v-if="employees.length === 0 && !showAddEmployeeForm" class="empty-state-modern">
            <div class="empty-icon">👥</div>
            <h3>No Employees Yet</h3>
            <p>Start building your team by adding your first employee</p>
            <button @click="showAddEmployeeForm = true" class="btn-add-empty">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Your First Employee
            </button>
          </div>

          <!-- Employees Grid -->
          <div v-else class="employees-grid">
            <div
              v-for="employee in employees"
              :key="employee.uuid"
              class="employee-card-modern"
            >
              <div class="employee-header">
                <div class="employee-avatar">
                  <span class="avatar-text">{{ getInitials(employee.name) }}</span>
                </div>
                <div class="employee-basic-info">
                  <h4 class="employee-name">{{ employee.name }}</h4>
                  <div class="employee-meta">
                    <span v-if="employee.phone" class="meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {{ employee.phone }}
                    </span>
                    <span v-if="employee.licenseNumber" class="meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      {{ employee.licenseNumber }}
                    </span>
                  </div>
                </div>
                <div class="employee-actions">
                  <button @click="editEmployee(employee)" class="btn-action edit" title="Edit Employee">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button @click="deleteEmployee(employee.uuid)" class="btn-action delete" title="Delete Employee">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      <path d="M8 10l4 4"/>
                      <path d="M12 10l4 4"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="employee-details">
                <div v-if="employee.address" class="detail-section">
                  <div class="detail-icon">🏠</div>
                  <div class="detail-content">
                    <div class="detail-label">Address</div>
                    <div class="detail-value">{{ employee.address }}</div>
                  </div>
                </div>

                <div class="government-ids" v-if="employee.pagibigNumber || employee.sssNumber || employee.philhealthNumber">
                  <div class="detail-icon">📋</div>
                  <div class="detail-content">
                    <div class="detail-label">Government IDs</div>
                    <div class="id-badges">
                      <span v-if="employee.pagibigNumber" class="id-badge">PAG-IBIG</span>
                      <span v-if="employee.sssNumber" class="id-badge">SSS</span>
                      <span v-if="employee.philhealthNumber" class="id-badge">PhilHealth</span>
                    </div>
                  </div>
                </div>

                <div v-if="employee.cashAdvance > 0 || employee.loans > 0" class="financial-section">
                  <div class="detail-icon">💰</div>
                  <div class="detail-content">
                    <div class="detail-label">Financial Status</div>
                    <div class="financial-items">
                      <div v-if="employee.cashAdvance > 0" class="financial-item advance">
                        <span class="amount">₱{{ formatCurrency(employee.cashAdvance) }}</span>
                        <span class="label">Cash Advance</span>
                        <span v-if="employee.autoDeductCashAdvance" class="auto-badge">AUTO</span>
                      </div>
                      <div v-if="employee.loans > 0" class="financial-item loan">
                        <span class="amount">₱{{ formatCurrency(employee.loans) }}</span>
                        <span class="label">Loan</span>
                        <span v-if="employee.autoDeductLoans" class="auto-badge">AUTO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Deductions Tab -->
      <div v-if="activeTab === 'deductions'" class="tab-pane">
        <div class="deductions-content">
          <!-- Header with Stats -->
          <div class="deductions-header">
            <div class="header-left">
              <h4 class="section-title">💸 Deduction Management</h4>
              <p class="section-subtitle">Configure per-employee deduction schedules</p>
            </div>
            <div class="header-right">
              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-number">{{ deductionMatrix.length }}</div>
                  <div class="stat-label">Configured Rules</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ employees.length }}</div>
                  <div class="stat-label">Employees</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ availableDeductions.length }}</div>
                  <div class="stat-label">Deductions</div>
                </div>
              </div>
              <button @click="loadDeductionMatrix" class="btn-refresh-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Refresh Matrix
              </button>
            </div>
          </div>

          <!-- Deduction Matrix -->
          <div class="deduction-matrix-container">
            <table class="deduction-matrix-table">
              <thead>
                <tr>
                  <th class="employee-header">Employee</th>
                  <th v-for="deduction in availableDeductions" :key="deduction.id" class="deduction-header">
                    <div class="deduction-info">
                      <div class="deduction-name">{{ deduction.name }}</div>
                      <div class="deduction-type">{{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }}</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="employeeRow in deductionMatrix" :key="employeeRow.employee.uuid" class="employee-row">
                  <td class="employee-cell">
                    <div class="employee-info">
                      <div class="employee-avatar-small">
                        <span class="avatar-text">{{ getInitials(employeeRow.employee.name) }}</span>
                      </div>
                      <div class="employee-details-small">
                        <div class="employee-name-small">{{ employeeRow.employee.name }}</div>
                      </div>
                    </div>
                  </td>
                  <!-- Loop through each deduction to create columns -->
                  <td v-for="deduction in availableDeductions" :key="`${employeeRow.employee.uuid}-${deduction.id}`" class="config-cell">
                    <div class="config-wrapper">
                      <!-- Find the config for this employee + deduction combination -->
                      <div class="config-status" :class="getConfigStatusClass(findConfigFor(employeeRow.employee.uuid, deduction.id))">
                        <select
                          :value="findConfigFor(employeeRow.employee.uuid, deduction.id).apply_mode"
                          @change="updateDeductionConfig(
                            employeeRow.employee.uuid,
                            deduction.id, // Use the deduction from the header array
                            $event.target.value,
                            employeeRow.employee.name,
                            deduction.name, // Use the deduction from the header array
                            employeeRow.employee,
                            deduction, // Pass the correct deduction object
                            findConfigFor(employeeRow.employee.uuid, deduction.id)
                          )"
                          class="mode-select"
                          :class="getModeSelectClass(findConfigFor(employeeRow.employee.uuid, deduction.id))"
                        >
                          <option value="never">Never</option>
                          <option value="always">Always</option>
                          <option value="selected_dates">Selected Dates</option>
                        </select>

                        <!-- Action Buttons -->
                        <div class="config-actions" v-if="findConfigFor(employeeRow.employee.uuid, deduction.id).apply_mode !== 'never'">
                          <button
                            @click="openDateModal(employeeRow.employee, deduction, findConfigFor(employeeRow.employee.uuid, deduction.id))"
                            class="btn-config-action edit"
                            title="Edit dates"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            @click="deleteConfig(employeeRow.employee.uuid, deduction.id, employeeRow.employee.name, deduction.name, findConfigFor(employeeRow.employee.uuid, deduction.id))"
                            class="btn-config-action delete"
                            title="Remove configuration"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                              <path d="M8 10l4 4"/>
                              <path d="M12 10l4 4"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <!-- Date Preview for Selected Dates Mode -->
                      <div v-if="findConfigFor(employeeRow.employee.uuid, deduction.id).apply_mode === 'selected_dates' && findConfigFor(employeeRow.employee.uuid, deduction.id).date_config?.selected_dates?.length"
                           class="date-preview">
                        <div class="date-count">
                          📅 {{ findConfigFor(employeeRow.employee.uuid, deduction.id).date_config.selected_dates.length }} date{{ findConfigFor(employeeRow.employee.uuid, deduction.id).date_config.selected_dates.length === 1 ? '' : 's' }}
                        </div>
                        <div class="date-list-preview" v-if="findConfigFor(employeeRow.employee.uuid, deduction.id).date_config.selected_dates.length <= 3">
                          <span v-for="date in findConfigFor(employeeRow.employee.uuid, deduction.id).date_config.selected_dates.slice(0, 3)"
                                :key="date"
                                class="date-chip">
                            {{ formatDatePreview(date) }}
                          </span>
                        </div>
                        <div class="date-range-preview" v-else>
                          {{ formatDateRange(findConfigFor(employeeRow.employee.uuid, deduction.id).date_config.selected_dates) }}
                        </div>
                      </div>

                      <!-- Always Mode Indicator -->
                      <div v-if="findConfigFor(employeeRow.employee.uuid, deduction.id).apply_mode === 'always'" class="always-indicator">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Active
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Instructions Card -->
          <div class="instructions-card">
            <div class="instruction-header">
              <div class="instruction-icon">ℹ️</div>
              <h5>How to Use</h5>
            </div>
            <div class="instruction-content">
              <ul>
                <li><strong>Never</strong>: Deduction is never applied to this employee's payslips</li>
                <li><strong>Always</strong>: Deduction is applied to all payslips for this employee</li>
                <li><strong>Selected Dates</strong>: Deduction is only applied when the payslip period overlaps with specific dates</li>
              </ul>
              <p><em>The deduction amounts are calculated from saved deductions in your Payroll Settings tab.</em></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Date Selection Modal -->
      <div v-if="showDateModal" class="modal-overlay" @click="closeDateModal">
        <div class="modal-content date-modal" @click.stop>
          <div class="modal-header">
            <h4>📅 Select Deduction Dates for {{ selectedEmployee?.name }} - {{ selectedDeduction?.name }}</h4>
            <button @click="closeDateModal" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="calendar-section">
              <div class="calendar-header">
                <button @click="prevMonth" class="nav-btn">&larr;</button>
                <h5>{{ formatCalendarMonth() }}</h5>
                <button @click="nextMonth" class="nav-btn">&rarr;</button>
              </div>
              <div class="calendar-grid">
                <div class="day-label" v-for="label in dayLabels" :key="label">{{ label }}</div>
                <div
                  v-for="day in calendarDays"
                  :key="day.date"
                  :class="[
                    'calendar-day',
                    day.isCurrentMonth ? 'current-month' : 'other-month',
                    isDateSelected(day.date) ? 'selected' : '',
                    isToday(day.date) ? 'today' : ''
                  ]"
                  @click="toggleDateSelection(day.date)"
                >
                  {{ day.dayNumber }}
                </div>
              </div>
            </div>
            <div class="selected-dates-section">
              <h5>📋 Selected Dates ({{ selectedDates.length }})</h5>
              <div class="selected-dates-list">
                <div
                  v-for="date in selectedDates"
                  :key="date"
                  class="selected-date-item"
                >
                  <span>{{ formatDateReadable(date) }}</span>
                  <button @click="removeDateSelection(date)" class="remove-date-btn">&times;</button>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button @click="clearAllDates" class="btn-clear-dates">Clear All</button>
              <button @click="saveDateSelections" class="btn-save-dates">Save Selections</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Rates Tab -->
      <div v-if="activeTab === 'rates'" class="tab-pane">
        <div class="section-header">
          <h4>Rate Management</h4>
          <div class="header-actions">
            <button @click="checkRates" :disabled="isRefreshingRates" class="btn-check-rates" title="Check for updated rates">
              <svg v-if="isRefreshingRates" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinning">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              {{ isRefreshingRates ? 'Checking...' : 'Check Rates' }}
            </button>
            <button @click="showAddRateForm = !showAddRateForm" class="btn-add" title="Add Rate/Toggle Form">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Add Rate Form -->
        <div v-if="showAddRateForm" class="form-container">
          <form @submit.prevent="submitRateForm" class="item-form">
            <div class="form-row">
              <div class="form-group">
                <label for="rateOrigin">Origin</label>
                <input
                  id="rateOrigin"
                  v-model="rateForm.origin"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="rateProvince">Province</label>
                <input
                  id="rateProvince"
                  v-model="rateForm.province"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="rateTown">Town</label>
                <input
                  id="rateTown"
                  v-model="rateForm.town"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="rateAmount">Rate (PHP)</label>
                <input
                  id="rateAmount"
                  v-model.number="rateForm.newRates"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-actions">
              <button @click="resetRateForm" type="button" class="btn-cancel">Cancel</button>
              <button type="submit" class="btn-submit">Add Rate</button>
            </div>
          </form>
          </div>

        <!-- Search Bar -->
        <div v-if="allRates.length > 0" class="search-container">
          <div class="search-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by town, province, or rate..."
              class="search-input"
            />
          </div>
          <div v-if="searchQuery" class="search-results">
            Showing {{ Object.values(filteredRates).flat().length }} of {{ allRates.length }} rates
            <button @click="searchQuery = ''" class="clear-search-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          </div>
        </div>

        <div class="rates-list">
          <div class="rates-by-province">
            <div
              v-for="(provinceRates, province) in groupedRates"
              :key="province"
              class="province-section"
            >
              <h5>{{ province }} ({{ provinceRates.length }} rates)</h5>
              <table class="rates-table">
                <thead>
                  <tr>
                    <th>Town</th>
                    <th>City/Province</th>
                    <th>New Rate</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rate in provinceRates" :key="rate.origin + rate.province + rate.town">
                    <td>{{ rate.town }}</td>
                    <td>{{ rate.province }}</td>
                    <td class="rate-amount">₱{{ rate.newRates?.toLocaleString() || '0' }}</td>
                    <td class="actions-cell">
                      <button @click="editRate(rate)" class="btn-edit-small">Edit</button>
                      <button @click="deleteRate(rate.origin, rate.province, rate.town)" class="btn-delete-small">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicles Tab -->
      <div v-if="activeTab === 'vehicles'" class="tab-pane">
        <div class="vehicles-content">
          <!-- Header with Stats and Add Button -->
          <div class="vehicles-header">
            <div class="header-left">
              <h4 class="section-title">🚛 Vehicle Management</h4>
              <p class="section-subtitle">Manage your fleet and vehicle information</p>
            </div>
            <div class="header-right">
              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-number">{{ vehicles.length }}</div>
                  <div class="stat-label">Total Vehicles</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ getVehiclesByClass('1') }}</div>
                  <div class="stat-label">Class 1</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ getVehiclesByClass('2') }}</div>
                  <div class="stat-label">Class 2</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ getVehiclesByClass('3') }}</div>
                  <div class="stat-label">Class 3</div>
                </div>
              </div>
              <button @click="showAddVehicleForm = !showAddVehicleForm" class="btn-add-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {{ showAddVehicleForm ? 'Cancel' : 'Add Vehicle' }}
              </button>
            </div>
          </div>

          <!-- Add/Edit Vehicle Form -->
          <div v-if="showAddVehicleForm" class="vehicle-form-container">
            <div class="form-header">
              <h5>{{ editingVehicle ? '✏️ Edit Vehicle' : '➕ Add New Vehicle' }}</h5>
              <p>{{ editingVehicle ? 'Update vehicle information' : 'Enter vehicle details to add to your fleet' }}</p>
            </div>

            <form @submit.prevent="submitVehicleForm" class="vehicle-form-modern">
              <!-- Vehicle Information Card -->
              <div class="form-card">
                <div class="card-header">
                  <div class="card-icon">🚛</div>
                  <div class="card-title">Vehicle Information</div>
                </div>
                <div class="card-content">
                  <div class="form-grid">
                    <div class="form-field">
                      <label for="vehiclePlateNumber" class="field-label">
                        Plate Number <span class="required">*</span>
                      </label>
                      <input
                        id="vehiclePlateNumber"
                        v-model="vehicleForm.plateNumber"
                        type="text"
                        required
                        placeholder="ABC-123"
                        class="field-input"
                        style="text-transform: uppercase;"
                      />
                    </div>
                    <div class="form-field">
                      <label for="vehicleClass" class="field-label">
                        Vehicle Class <span class="required">*</span>
                      </label>
                      <select
                        id="vehicleClass"
                        v-model="vehicleForm.vehicleClass"
                        required
                        class="field-input"
                      >
                        <option value="">Select Class</option>
                        <option value="1">Class 1</option>
                        <option value="2">Class 2</option>
                        <option value="3">Class 3</option>
                        <option value="4">Class 4</option>
                        <option value="5">Class 5</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-field">
                    <label for="vehicleName" class="field-label">Vehicle Name (Optional)</label>
                    <input
                      id="vehicleName"
                      v-model="vehicleForm.name"
                      type="text"
                      placeholder="e.g., Delivery Truck 1, Company Van"
                      class="field-input"
                    />
                  </div>
                </div>
              </div>

              <div class="form-actions-modern">
                <button @click="resetVehicleForm" type="button" class="btn-cancel-modern">Cancel</button>
                <button type="submit" class="btn-submit-modern">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17,21 17,13 7,13 7,21"/>
                    <polyline points="7,3 7,8 15,8"/>
                  </svg>
                  {{ editingVehicle ? 'Update Vehicle' : 'Save Vehicle' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Empty State -->
          <div v-if="vehicles.length === 0 && !showAddVehicleForm" class="empty-state-modern">
            <div class="empty-icon">🚛</div>
            <h3>No Vehicles Yet</h3>
            <p>Start building your fleet by adding your first vehicle</p>
            <button @click="showAddVehicleForm = true" class="btn-add-empty">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Your First Vehicle
            </button>
          </div>

          <!-- Vehicles Grid -->
          <div v-else class="vehicles-grid">
            <div
              v-for="vehicle in vehicles"
              :key="vehicle.id"
              class="vehicle-card-modern"
            >
              <div class="vehicle-header">
                <div class="vehicle-icon">
                  <span class="icon-text">🚛</span>
                </div>
                <div class="vehicle-basic-info">
                  <h4 class="vehicle-plate">{{ vehicle.plate_number }}</h4>
                  <div class="vehicle-meta">
                    <span class="meta-item class-badge" :class="`class-${vehicle.vehicle_class}`">
                      Class {{ vehicle.vehicle_class }}
                    </span>
                    <span v-if="vehicle.name" class="meta-item">
                      {{ vehicle.name }}
                    </span>
                  </div>
                </div>
                <div class="vehicle-actions">
                  <button @click="editVehicle(vehicle)" class="btn-action edit" title="Edit Vehicle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button @click="deleteVehicle(vehicle.id)" class="btn-action delete" title="Delete Vehicle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      <path d="M8 10l4 4"/>
                      <path d="M12 10l4 4"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="vehicle-details">
                <div class="detail-section">
                  <div class="detail-icon">📅</div>
                  <div class="detail-content">
                    <div class="detail-label">Added</div>
                    <div class="detail-value">{{ formatDate(vehicle.created_at) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Rate Modal -->
    <div v-if="showEditRateModal" class="modal-overlay" @click="closeEditRateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>Edit Rate</h4>
          <button @click="closeEditRateModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitRateForm" class="item-form">
            <div class="form-row">
              <div class="form-group">
                <label for="editRateOrigin">Origin</label>
                <input
                  id="editRateOrigin"
                  v-model="rateForm.origin"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="editRateProvince">Province</label>
                <input
                  id="editRateProvince"
                  v-model="rateForm.province"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="editRateTown">Town</label>
                <input
                  id="editRateTown"
                  v-model="rateForm.town"
                  type="text"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="editRateAmount">Rate (PHP)</label>
                <input
                  id="editRateAmount"
                  v-model.number="rateForm.newRates"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-actions">
              <button @click="closeEditRateModal" type="button" class="btn-cancel">Cancel</button>
              <button type="submit" class="btn-submit">Update Rate</button>
            </div>
          </form>
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

const activeTab = ref('employees')
const employees = ref([])
const vehicles = ref([])
const allRates = ref([])
const searchQuery = ref('')
const showAddEmployeeForm = ref(false)
const showAddVehicleForm = ref(false)
const showAddRateForm = ref(false)
const showEditRateModal = ref(false)
const editingEmployee = ref(null)
const editingVehicle = ref(null)
const editingRate = ref(null)
const isRefreshingRates = ref(false)
const ratesLastUpdated = ref(null)

// Deductions
const deductionMatrix = ref([])
const availableDeductions = ref([])
const showDateModal = ref(false)
const selectedEmployee = ref(null)
const selectedDeduction = ref(null)
const selectedConfig = ref(null)
const selectedDates = ref([])
const calendarDays = ref([])
const currentMonth = ref(new Date())
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const employeeForm = ref({
  name: '',
  phone: '',
  licenseNumber: '',
  pagibigNumber: '',
  sssNumber: '',
  philhealthNumber: '',
  address: '',
  cashAdvance: 0,
  loans: 0,
  autoDeductCashAdvance: true,
  autoDeductLoans: true
})

// Setup data refresh system
const { triggerRefresh, onRefresh } = useDataRefresh()
const vehicleForm = ref({
  plateNumber: '',
  vehicleClass: '',
  name: ''
})
const rateForm = ref({
  origin: 'Bulacan',
  province: '',
  town: '',
  newRates: ''
})

const filteredRates = computed(() => {
  if (!searchQuery.value.trim()) return allRates.value
  return allRates.value.filter(rate =>
    (rate.town?.toLowerCase() || '').includes(searchQuery.value.toLowerCase().trim()) ||
    (rate.province?.toLowerCase() || '').includes(searchQuery.value.toLowerCase().trim()) ||
    rate.newRates.toString().includes(searchQuery.value.trim())
  )
})

const groupedRates = computed(() => {
  const rates = filteredRates.value
  const groups = {}
  rates.forEach(rate => {
    const provinceKey = rate.province || 'Unknown Province'
    if (!groups[provinceKey]) {
      groups[provinceKey] = []
    }
    groups[provinceKey].push(rate)
  })
  return groups
})

onMounted(() => {
  fetchSettings()
  // Load deductions data when deductions tab is active
  if (activeTab.value === 'deductions') {
    loadDeductionsData()
  }

  // Listen for employee refresh events
  onRefresh('employees', () => {
    fetchSettings()
  })
})

const fetchSettings = async () => {
  try {
    // Fetch employees from new unified API
    const employeesRes = await axios.get(`${API_BASE_URL}/employees`)
    employees.value = employeesRes.data

    await fetchAllRates()
    await fetchVehicles()
  } catch (error) {
    console.error('Error fetching settings:', error)
    // Fallback to empty arrays
    employees.value = []
    allRates.value = []
    vehicles.value = []
  }
}

const fetchAllRates = async () => {
  try {
    console.log('📡 fetchAllRates - Starting to fetch all rates...')
    const response = await axios.get(`${API_BASE_URL}/rates`)
    console.log('📡 fetchAllRates - Received response with', response.data.length, 'rates')

    const mappedRates = response.data.map(rate => ({
      ...rate,
      newRates: rate.new_rates || rate.newRates,
      origin: rate.origin,
      province: rate.province,
      town: rate.town
    }))

    console.log('📡 fetchAllRates - Mapped rates:', mappedRates.map(r => `${r.origin}/${r.province}/${r.town}:${r.newRates}`))
    console.log('📡 fetchAllRates - Setting allRates.value:', allRates.value.length, '->', mappedRates.length)

    allRates.value = mappedRates

    console.log('📡 fetchAllRates - Computed properties should now update')
    console.log('  filteredRates:', Object.keys(filteredRates.value).length, 'provinces')
    console.log('  groupedRates keys:', Object.keys(groupedRates.value))

    // Force Vue reactivity notification (in case computed properties aren't triggering)
    allRates.value = [...allRates.value]
    console.log('📡 fetchAllRates - Force reactivity completed')

  } catch (error) {
    console.error('❌ fetchAllRates - Error fetching rates:', error)
    allRates.value = []
  }
}

// Employee CRUD functions
const submitEmployeeForm = async () => {
  try {
    // Set timestamps
    const now = new Date().toISOString()
    const formData = { ...employeeForm.value }

    if (editingEmployee.value) {
      // Update existing employee
      formData.updated = now
      await axios.put(`${API_BASE_URL}/employees/${editingEmployee.value.uuid}`, formData)
      showAddEmployeeForm.value = false
    } else {
      // Create new employee
      formData.created = now
      formData.updated = now
      await axios.post(`${API_BASE_URL}/employees`, formData)

      // Trigger global refresh for employees
      triggerRefresh('employees', { action: 'create', employee: formData })
    }

    await fetchSettings()
    resetEmployeeForm()
  } catch (error) {
    console.error('Error saving employee:', error)
    alert('Error saving employee. Please try again.')
  }
}

const editEmployee = (employee) => {
  editingEmployee.value = employee
  // Load employee data into form
  employeeForm.value = {
    name: employee.name || '',
    phone: employee.phone || '',
    licenseNumber: employee.licenseNumber || '',
    pagibigNumber: employee.pagibigNumber || '',
    sssNumber: employee.sssNumber || '',
    philhealthNumber: employee.philhealthNumber || '',
    address: employee.address || '',
    cashAdvance: employee.cashAdvance || 0,
    loans: employee.loans || 0,
    autoDeductCashAdvance: employee.autoDeductCashAdvance !== false, // Default true
    autoDeductLoans: employee.autoDeductLoans !== false // Default true
  }
  showAddEmployeeForm.value = true
}

const deleteEmployee = async (employeeUuid) => {
  if (confirm('Are you sure you want to delete this employee?')) {
    try {
      await axios.delete(`${API_BASE_URL}/employees/${employeeUuid}`)
      await fetchSettings()
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Error deleting employee. Please try again.')
    }
  }
}

const resetEmployeeForm = () => {
  employeeForm.value = {
    name: '',
    phone: '',
    licenseNumber: '',
    pagibigNumber: '',
    sssNumber: '',
    philhealthNumber: '',
    address: '',
    cashAdvance: 0,
    loans: 0,
    autoDeductCashAdvance: true,
    autoDeductLoans: true
  }
  editingEmployee.value = null
  showAddEmployeeForm.value = false
}

// Currency formatting helper
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0)
}

// Rate CRUD functions
const submitRateForm = async () => {
  try {
    if (editingRate.value) {
      console.log('🔄 Updating existing rate:', {
        original: editingRate.value,
        updates: rateForm.value
      })
      await axios.put(`${API_BASE_URL}/rates/${editingRate.value.origin}/${editingRate.value.province}/${editingRate.value.town}`, {
        ...rateForm.value,
        originalOrigin: editingRate.value.origin,
        originalProvince: editingRate.value.province,
        originalTown: editingRate.value.town
      })
      console.log('✅ Rate updated successfully')
    } else {
      console.log('➕ Creating new rate:', rateForm.value)
      await axios.post(`${API_BASE_URL}/rates`, rateForm.value)
      console.log('✅ Rate created successfully')
    }

    console.log('🔄 Refreshing rates data and clearing search...')
    searchQuery.value = '' // Clear search filter so updated rate shows in UI
    await fetchAllRates()
    console.log('✅ Rates data refreshed and search cleared')

    resetRateForm()
    console.log('🧹 Form reset complete')
  } catch (error) {
    console.error('❌ Error saving rate:', error)
    alert('Error saving rate. Please try again.')
  }
}

const editRate = (rate) => {
  editingRate.value = rate
  rateForm.value = { ...rate }
  showEditRateModal.value = true
}

const closeEditRateModal = () => {
  showEditRateModal.value = false
  resetRateForm()
}

const deleteRate = async (origin, province, town) => {
  if (confirm('Are you sure you want to delete this rate?')) {
    try {
      await axios.delete(`${API_BASE_URL}/rates/${encodeURIComponent(origin)}/${encodeURIComponent(province)}/${encodeURIComponent(town)}`)
      await fetchAllRates()
    } catch (error) {
      console.error('Error deleting rate:', error)
      alert('Error deleting rate. Please try again.')
    }
  }
}

const resetRateForm = () => {
  rateForm.value = {
    origin: '',
    province: '',
    town: '',
    newRates: ''
  }
  editingRate.value = null
  showAddRateForm.value = false
  showEditRateModal.value = false
}

// Vehicles CRUD functions
const fetchVehicles = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/vehicles`)
    vehicles.value = response.data
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    vehicles.value = []
  }
}

const submitVehicleForm = async () => {
  try {
    if (editingVehicle.value) {
      // Update existing vehicle
      await axios.put(`${API_BASE_URL}/vehicles/${editingVehicle.value.id}`, vehicleForm.value)
      showAddVehicleForm.value = false
    } else {
      // Create new vehicle
      await axios.post(`${API_BASE_URL}/vehicles`, vehicleForm.value)
    }

    await fetchVehicles()
    resetVehicleForm()
  } catch (error) {
    console.error('Error saving vehicle:', error)
    if (error.response?.data?.error) {
      alert(error.response.data.error)
    } else {
      alert('Error saving vehicle. Please try again.')
    }
  }
}

const editVehicle = (vehicle) => {
  editingVehicle.value = vehicle
  // Load vehicle data into form
  vehicleForm.value = {
    plateNumber: vehicle.plate_number || '',
    vehicleClass: vehicle.vehicle_class || '',
    name: vehicle.name || ''
  }
  showAddVehicleForm.value = true
}

const deleteVehicle = async (vehicleId) => {
  if (confirm('Are you sure you want to delete this vehicle?')) {
    try {
      await axios.delete(`${API_BASE_URL}/vehicles/${vehicleId}`)
      await fetchVehicles()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      alert('Error deleting vehicle. Please try again.')
    }
  }
}

const resetVehicleForm = () => {
  vehicleForm.value = {
    plateNumber: '',
    vehicleClass: '',
    name: ''
  }
  editingVehicle.value = null
  showAddVehicleForm.value = false
}

const getVehiclesByClass = (vehicleClass) => {
  return vehicles.value.filter(vehicle => vehicle.vehicle_class === vehicleClass).length
}

// Date formatting helper
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  // Database now stores timestamps in local timezone (UTC+2)
  // Display as-is without additional timezone conversion
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Check Rates function - manual refresh for rates data
const checkRates = async () => {
  if (isRefreshingRates.value) return // Prevent multiple simultaneous requests

  isRefreshingRates.value = true
  try {
    await fetchAllRates()
    ratesLastUpdated.value = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    // Could add a success notification here if desired
  } catch (error) {
    console.error('Error checking rates:', error)
    alert('Failed to refresh rates. Please try again.')
  } finally {
    isRefreshingRates.value = false
  }
}

// Deductions functions
const loadDeductionsData = async () => {
  try {
    // Fetch deductions from payroll settings
    const [deductionsRes, matrixRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/deductions`),
      axios.get(`${API_BASE_URL}/employee-deduction-configs/matrix`)
    ])

    availableDeductions.value = deductionsRes.data
    deductionMatrix.value = matrixRes.data.matrix
  } catch (error) {
    console.error('Error loading deduction data:', error)
    // Fallback to empty data
    availableDeductions.value = []
    deductionMatrix.value = []
  }
}

const updateDeductionConfig = async (employeeUuid, deductionId, applyMode, employeeName, deductionName, employee, deduction, config) => {
  try {
    // Debug logging to verify the deduction ID matches expectation
    console.log('🎯 updateDeductionConfig called with:', {
      employeeUuid,
      deductionId,
      applyMode,
      deductionName,
      availableDeductionsCount: availableDeductions.value.length,
      availableDeductionsNames: availableDeductions.value.map(d => `${d.id}:${d.name}`)
    })

    const payload = {
      employee_uuid: employeeUuid,
      deduction_id: deductionId,
      apply_mode: applyMode
    }

    await axios.post(`${API_BASE_URL}/employee-deduction-configs`, payload)
    console.log(`✅ Updated ${employeeName}'s ${deductionName} (ID:${deductionId}) config to ${applyMode}`)

    // If selected "selected_dates" mode, automatically open the date picker
    if (applyMode === 'selected_dates') {
      openDateModal(employee, deduction, config)
    }
  } catch (error) {
    console.error('❌ Error updating deduction config:', error)
    alert('Error updating deduction configuration. Please try again.')
  }
}

// Date modal functions
const openDateModal = (employee, deduction, config) => {
  selectedEmployee.value = employee
  selectedDeduction.value = deduction
  selectedConfig.value = config
  selectedDates.value = config.date_config?.selected_dates || []
  currentMonth.value = new Date()
  generateCalendarDays()
  showDateModal.value = true
}

const closeDateModal = () => {
  showDateModal.value = false
  selectedEmployee.value = null
  selectedDeduction.value = null
  selectedConfig.value = null
  selectedDates.value = []
}

const generateCalendarDays = () => {
  const days = []
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()

  // Get first day of the month and last day
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()

  // Get last day of previous month
  const prevLastDate = new Date(year, month, 0).getDate()

  // Add previous month's days
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevLastDate - i)
    days.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      dayNumber: prevLastDate - i,
      isCurrentMonth: false
    })
  }

  // Add current month's days
  for (let i = 1; i <= lastDate; i++) {
    const date = new Date(year, month, i)
    days.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      dayNumber: i,
      isCurrentMonth: true
    })
  }

  // Add next month's days to fill the grid
  const remainingDays = 42 - days.length // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    days.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      dayNumber: i,
      isCurrentMonth: false
    })
  }

  calendarDays.value = days
}

const prevMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
  generateCalendarDays()
}

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
  generateCalendarDays()
}

const formatCalendarMonth = () => {
  return currentMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const isDateSelected = (dateString) => {
  return selectedDates.value.includes(dateString)
}

const isToday = (dateString) => {
  const today = new Date().toISOString().split('T')[0]
  return dateString === today
}

const toggleDateSelection = (dateString) => {
  const index = selectedDates.value.indexOf(dateString)
  if (index > -1) {
    selectedDates.value.splice(index, 1)
  } else {
    selectedDates.value.push(dateString)
  }
}

const removeDateSelection = (dateString) => {
  const index = selectedDates.value.indexOf(dateString)
  if (index > -1) {
    selectedDates.value.splice(index, 1)
  }
}

const clearAllDates = () => {
  selectedDates.value = []
}

const saveDateSelections = async () => {
  try {
    const payload = {
      employee_uuid: selectedEmployee.value.uuid,
      deduction_id: selectedDeduction.value.id,
      apply_mode: 'selected_dates',
      date_config: {
        selected_dates: selectedDates.value
      }
    }

    await axios.post(`${API_BASE_URL}/employee-deduction-configs`, payload)
    console.log(`Updated ${selectedEmployee.value.name}'s ${selectedDeduction.value.name} dates`)
    closeDateModal()
    await loadDeductionMatrix()
  } catch (error) {
    console.error('Error saving date selections:', error)
    alert('Error saving date selections. Please try again.')
  }
}

const formatDateReadable = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Tab change handler to load data when needed
const handleTabChange = (tab) => {
  activeTab.value = tab
  if (tab === 'deductions') {
    loadDeductionMatrix()
  }
}

const loadDeductionMatrix = async () => {
  await loadDeductionsData()
}

// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Helper functions for deductions configuration
const getConfigStatusClass = (config) => {
  if (!config || config.apply_mode === 'never') return 'status-never'
  if (config.apply_mode === 'always') return 'status-always'
  if (config.apply_mode === 'selected_dates') return 'status-selected'
  return 'status-never'
}

const getModeSelectClass = (applyMode) => {
  return `mode-${applyMode || 'never'}`
}

// Date preview functions
const formatDatePreview = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatDateRange = (dates) => {
  if (!dates || dates.length === 0) return ''

  // Sort dates
  const sortedDates = dates.sort()
  const firstDate = new Date(sortedDates[0])
  const lastDate = new Date(sortedDates[sortedDates.length - 1])

  if (sortedDates.length <= 3) {
    // Show individual dates
    return sortedDates.map(d => formatDatePreview(d)).join(', ')
  } else {
    // Show range
    return `${formatDatePreview(firstDate)} - ${formatDatePreview(lastDate)} (${dates.length} dates)`
  }
}

// Helper method to find config for specific employee + deduction combination
const findConfigFor = (employeeUuid, deductionId) => {
  // Find the employee row that matches the employeeUuid
  const employeeRow = deductionMatrix.value.find(row => row.employee.uuid === employeeUuid)
  if (!employeeRow) {
    return { apply_mode: 'never', date_config: null }
  }

  // Find the config for this specific deduction within the employee's configs
  const configItem = employeeRow.configs.find(config =>
    config.deduction.id === deductionId
  )

  return configItem ? configItem.config : { apply_mode: 'never', date_config: null }
}

// CRUD operations for deduction configurations
const deleteConfig = async (employeeUuid, deductionId, employeeName, deductionName, config) => {
  if (!confirm(`Are you sure you want to delete the deduction configuration for ${employeeName} - ${deductionName}?`)) {
    return
  }

  try {
    await axios.delete(`${API_BASE_URL}/employee-deduction-configs/${employeeUuid}/${deductionId}`)
    console.log(`Deleted ${employeeName}'s ${deductionName} config`)

    // Refresh the matrix
    await loadDeductionMatrix()
  } catch (error) {
    console.error('Error deleting deduction config:', error)
    alert('Error deleting deduction configuration. Please try again.')
  }
}
</script>

<style scoped>
.settings {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.5rem;
  text-align: center;
}

.settings-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #dee2e6;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  background: #f8f9fa;
  color: #666;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-btn:hover {
  background: #e9ecef;
}

.tab-btn.active {
  background: #007bff;
  color: white;
  border-bottom: 3px solid #0056b3;
}

.tab-content {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tab-pane {
  animation: fadeIn 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.employees-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h4 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-check-rates {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 4px rgba(23, 162, 184, 0.3);
}

.btn-check-rates:hover:not(:disabled) {
  background: #138496;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(23, 162, 184, 0.4);
}

.btn-check-rates:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.btn-add {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-add:hover {
  background: #218838;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-style: italic;
}

.items-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1rem;
}

.item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.item-details {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #666;
  flex-wrap: wrap;
  align-items: center;
}

.item-details span {
  background: #fff;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  white-space: nowrap;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
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
  transition: color 0.2s;
}

.btn-edit:hover svg {
  color: #0056b3;
  stroke: #0056b3;
}

.btn-delete svg {
  color: #dc3545;
  fill: none;
  stroke: #dc3545;
  transition: color 0.2s;
}

.btn-delete:hover svg {
  color: #c82333;
  stroke: #c82333;
}

.btn-edit {
  background: #ffc107;
  color: #212529;
}

.btn-edit:hover {
  background: #e0a800;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h4 {
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #333;
}

.modal-body {
  padding: 1.5rem;
}

/* Rates specific styles */
.rates-info {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
}

.info-text, .upload-info {
  margin: 0 0 0.5rem 0;
  color: #1565c0;
  font-size: 0.9rem;
}

.upload-info {
  margin-bottom: 0;
}

.province-section {
  margin-bottom: 2rem;
}

.province-section h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
}

.rates-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin: 1rem 0;
}

.rates-table th {
  background: #f8f9fa;
  padding: 0.75rem;
  text-align: center;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
  border-right: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 1;
}

.rates-table th:last-child {
  border-right: none;
  text-align: center;
}

/* Removed overriding rule - now all columns are center-aligned */

.rates-table td {
  padding: 0.75rem;
  text-align: center;
  border-bottom: 1px solid #dee2e6;
  border-right: 1px solid #dee2e6;
  vertical-align: middle;
}

.rates-table td:last-child {
  border-right: none;
}

/* Previously right-aligned, now center-aligned with the rest */

.rates-table tr:last-child td {
  border-bottom: none;
}

.rate-amount {
  font-weight: bold;
  color: #28a745;
  text-align: right;
  width: 120px;
  white-space: nowrap;
}

.actions-cell {
  text-align: center;
}

.rates-table th,
.rates-table td {
  text-align: center;
}

.btn-edit-small, .btn-delete-small {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  margin: 0 0.125rem;
}

.btn-edit-small {
  background: #ffc107;
  color: #212529;
}

.btn-delete-small {
  background: #dc3545;
  color: white;
}

/* Search Styles */
.search-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.search-wrapper {
  display: flex;
  align-items: center;
  position: relative;
  max-width: 500px;
  margin: 0 auto;
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: #a0aec0;
  width: 20px;
  height: 20px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-results {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #718096;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.clear-search-btn {
  background: #e2e8f0;
  border: none;
  border-radius: 4px;
  color: #4a5568;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #cbd5e0;
}

/* Enhanced Form Styles */
.form-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.employee-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1.5rem;
  background: #f8f9fa;
}

.section-title {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.checkbox-group {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-input {
  width: 16px;
  height: 16px;
}

.checkbox-label {
  font-size: 0.85rem;
  color: #666;
  cursor: pointer;
}

.currency-input {
  text-align: right;
}

/* Employee Details Styles */
.employee-card .item-info {
  flex: 1;
  min-width: 0;
}

.detail-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-row span {
  background: #fff;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  white-space: nowrap;
}

.financial-info {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e9ecef;
}

.auto-indicator {
  color: #17a2b8;
  font-weight: bold;
  margin-left: 0.25rem;
}

.cash-advance {
  color: #fd7e14;
  font-weight: 500;
}

.loan-amount {
  color: #dc3545;
  font-weight: 500;
}

/* Modern Employee Management Styles */
.employees-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.header-left {
  flex: 1;
}

.section-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: white;
}

.section-subtitle {
  font-size: 1rem;
  opacity: 0.9;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
}

.header-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
}

.stats-cards {
  display: flex;
  gap: 1rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  min-width: 100px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
  display: block;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-add-primary {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.btn-add-primary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

/* Modern Form Styles */
.employee-form-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
  overflow: hidden;
}

.form-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  text-align: center;
  color: white;
}

.form-header h5 {
  margin: 0 0 0.5rem 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.form-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.employee-form-modern {
  padding: 2rem;
}

.form-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  overflow: hidden;
  transition: all 0.3s ease;
}

.form-card:hover {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.card-header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-icon {
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.card-content {
  padding: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required {
  color: #e53e3e;
}

.field-input {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  background: white;
}

.field-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field-input.currency {
  text-align: right;
  font-family: 'Courier New', monospace;
}

.field-helper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.checkbox-small {
  width: 14px;
  height: 14px;
}

.checkbox-label-small {
  font-size: 0.8rem;
  color: #718096;
  cursor: pointer;
}

.form-actions-modern {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel-modern {
  background: #f7fafc;
  border: 2px solid #e2e8f0;
  color: #4a5568;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-cancel-modern:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
}

.btn-submit-modern {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.btn-submit-modern:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

/* Empty State */
.empty-state-modern {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  margin: 2rem 0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.empty-state-modern h3 {
  color: #2d3748;
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.empty-state-modern p {
  color: #718096;
  margin: 0 0 2rem 0;
  font-size: 1rem;
}

.btn-add-empty {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.btn-add-empty:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

/* Employees Grid */
.employees-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.employee-card-modern {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
}

.employee-card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.employee-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.employee-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.avatar-text {
  text-transform: uppercase;
}

.employee-basic-info {
  flex: 1;
}

.employee-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}

.employee-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #718096;
  background: rgba(113, 128, 150, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.employee-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  background: transparent !important;
  padding: 0 !important;
}

.btn-action.edit {
  background: transparent !important;
}

.btn-action.edit:hover {
  transform: scale(1.1);
}

.btn-action.delete {
  background: transparent !important;
}

.btn-action.delete:hover {
  transform: scale(1.1);
}

.btn-action.edit svg {
  color: #007bff;
  fill: none;
  stroke: #007bff;
  transition: color 0.2s;
}

.btn-action.edit:hover svg {
  color: #0056b3;
  stroke: #0056b3;
}

.btn-action.delete svg {
  color: #dc3545;
  fill: none;
  stroke: #dc3545;
  transition: color 0.2s;
}

.btn-action.delete:hover svg {
  color: #c82333;
  stroke: #c82333;
}

.employee-details {
  padding: 1.5rem;
}

.detail-section,
.government-ids,
.financial-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.detail-section:last-child,
.government-ids:last-child,
.financial-section:last-child {
  margin-bottom: 0;
}

.detail-icon {
  font-size: 1.2rem;
  width: 24px;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.detail-content {
  flex: 1;
}

.detail-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
}

.detail-value {
  font-size: 0.9rem;
  color: #2d3748;
  line-height: 1.4;
}

.id-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.id-badge {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.financial-items {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.financial-item {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  min-width: 120px;
  text-align: center;
}

.financial-item.advance {
  border-color: #fbbf24;
  background: #fefce8;
}

.financial-item.loan {
  border-color: #f56565;
  background: #fef2f2;
}

.amount {
  font-size: 1rem;
  font-weight: 700;
  color: #2d3748;
  display: block;
  margin-bottom: 0.25rem;
}

.label {
  font-size: 0.7rem;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.auto-badge {
  background: #38b2ac;
  color: white;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 700;
  margin-left: 0.25rem;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .settings h3 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .settings-tabs {
    gap: 0.25rem;
    margin-bottom: 1.5rem;
    padding: 0 0.5rem;
  }

  .tab-btn {
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    min-width: 100px;
    flex: 1;
  }

  .employees-header,
  .vehicles-header {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.4rem;
  }

  .section-subtitle {
    font-size: 0.9rem;
  }

  .stats-cards {
    justify-content: center !important;
    flex-wrap: wrap !important;
    gap: 0.5rem !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important; /* Stack vertically on mobile */
    padding: 0.25rem !important;
    box-sizing: border-box !important;
  }

  /* FORCE OVERRIDE: Stat cards must stack vertically and fit container - 50% SIZE */
  .settings .vehicles-header .stats-cards .stat-card {
    max-width: 100% !important;
    width: 100% !important;
    flex: none !important;
    display: block !important;
    margin-bottom: 0.25rem !important;
    padding: 0.25rem 0.15rem !important;
    box-sizing: border-box !important;
  }

  /* Last stat card should not have bottom margin */
  .settings .vehicles-header .stats-cards .stat-card:last-child {
    margin-bottom: 0 !important;
  }

  .stat-number {
    font-size: 1.2rem;
  }

  .stat-label {
    font-size: 0.65rem;
  }

  .header-right {
    align-items: center;
    width: 100%;
  }

  .btn-add-primary {
    width: 100%;
    justify-content: center;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
  }

  .employees-grid,
  .vehicles-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .employee-card-modern,
  .vehicle-card-modern {
    margin-bottom: 1rem;
  }

  .employee-header,
  .vehicle-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
    padding: 1rem;
  }

  .employee-avatar,
  .vehicle-icon {
    width: 45px;
    height: 45px;
    margin: 0 auto;
  }

  .employee-name,
  .vehicle-plate {
    font-size: 1.1rem;
  }

  .employee-meta,
  .vehicle-meta {
    justify-content: center;
    gap: 0.75rem;
  }

  .meta-item {
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
  }

  .employee-actions,
  .vehicle-actions {
    position: absolute;
    top: 1rem;
    right: 1rem;
    gap: 0.25rem;
  }

  .btn-action {
    width: 28px;
    height: 28px;
  }

  .employee-details,
  .vehicle-details {
    padding: 1rem;
  }

  .detail-section,
  .government-ids,
  .financial-section {
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .detail-icon {
    width: 20px;
    font-size: 1rem;
  }

  .detail-label {
    font-size: 0.75rem;
  }

  .detail-value {
    font-size: 0.85rem;
  }

  .id-badges {
    justify-content: center;
  }

  .id-badge {
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
  }

  .financial-items {
    flex-direction: column;
    gap: 0.5rem;
  }

  .financial-item {
    min-width: auto;
    padding: 0.6rem;
  }

  .amount {
    font-size: 0.9rem;
  }

  .label {
    font-size: 0.65rem;
  }

  /* Form Improvements */
  .employee-form-container,
  .vehicle-form-container {
    margin: 0 0.5rem 1.5rem 0.5rem;
  }

  .form-header {
    padding: 1.5rem;
  }

  .form-header h5 {
    font-size: 1.2rem;
  }

  .form-header p {
    font-size: 0.9rem;
  }

  .employee-form-modern,
  .vehicle-form-modern {
    padding: 1.5rem;
  }

  .form-card {
    margin-bottom: 1rem;
  }

  .card-header {
    padding: 0.75rem 1rem;
  }

  .card-icon {
    width: 35px;
    height: 35px;
    font-size: 1rem;
  }

  .card-title {
    font-size: 1rem;
  }

  .card-content {
    padding: 1rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .field-label {
    font-size: 0.85rem;
  }

  .field-input {
    padding: 0.7rem 0.9rem;
    font-size: 0.9rem;
  }

  .field-helper {
    margin-top: 0.2rem;
  }

  .checkbox-label-small {
    font-size: 0.75rem;
  }

  .form-actions-modern {
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
  }

  .btn-cancel-modern,
  .btn-submit-modern {
    width: 100%;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    justify-content: center;
  }

  /* Rates Table Mobile */
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
    margin-bottom: 1rem;
  }

  .section-header h4 {
    font-size: 1.2rem;
    text-align: center;
  }

  .btn-add {
    width: 100%;
    justify-content: center;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  .form-container {
    padding: 1.5rem;
    margin: 0 0.5rem 1.5rem 0.5rem;
  }

  .item-form {
    gap: 1rem;
  }

  .form-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-group {
    width: 100%;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem;
    font-size: 0.9rem;
  }

  .form-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn-cancel,
  .btn-submit {
    width: 100%;
    padding: 0.875rem 1rem;
    font-size: 1rem;
  }

  .province-section {
    margin-bottom: 1.5rem;
  }

  .province-section h5 {
    font-size: 1rem;
    text-align: center;
  }

  .rates-table {
    font-size: 0.8rem;
    margin: 0.5rem 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .rates-table th,
  .rates-table td {
    padding: 0.5rem;
    white-space: nowrap;
  }

  .rate-amount {
    width: auto;
    text-align: center;
  }

  .btn-edit-small,
  .btn-delete-small {
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
    margin: 0 0.1rem;
  }

  /* Modal Improvements */
  .modal-content {
    width: 95%;
    max-width: none;
    margin: 1rem;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-header h4 {
    font-size: 1.1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  /* Empty State */
  .empty-state-modern {
    padding: 2rem 1rem;
    margin: 1rem 0.5rem;
  }

  .empty-icon {
    font-size: 3rem;
  }

  .empty-state-modern h3 {
    font-size: 1.2rem;
  }

  .empty-state-modern p {
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .btn-add-empty {
    width: 100%;
    justify-content: center;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
  }

  /* Touch-friendly improvements */
  .btn-action,
  .btn-edit,
  .btn-delete {
    min-width: 44px;
    min-height: 44px;
  }

  .btn-attachment {
    min-width: 44px;
    min-height: 44px;
  }

  /* Better spacing for mobile */
  .settings {
    padding: 0.5rem;
  }

  .tab-content {
    padding: 0.5rem 0;
  }

  .employees-content,
  .vehicles-content {
    padding: 0;
  }
}

/* Utility Classes */

/* Vehicles Styles */
.vehicles-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.vehicles-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.vehicle-form-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
  overflow: hidden;
}

.vehicle-form-modern {
  padding: 2rem;
}

.vehicles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}

.vehicle-card-modern {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
}

.vehicle-card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.vehicle-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.vehicle-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.icon-text {
  font-size: 1.5rem;
}

.vehicle-basic-info {
  flex: 1;
}

.vehicle-plate {
  font-size: 1.2rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.vehicle-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.class-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.vehicle-actions {
  display: flex;
  gap: 0.5rem;
}

.vehicle-details {
  padding: 1.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .employees-header,
  .vehicles-header {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }

  .stats-cards {
    justify-content: center;
  }

  .header-right {
    align-items: center;
  }

  .employees-grid,
  .vehicles-grid {
    grid-template-columns: 1fr;
  }

  .employee-header,
  .vehicle-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .employee-meta,
  .vehicle-meta {
    justify-content: center;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions-modern {
    flex-direction: column;
  }

  .financial-items {
    flex-direction: column;
  }

  .detail-section,
  .government-ids,
  .financial-section {
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .item-card {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .settings-tabs {
    flex-wrap: wrap;
  }

  .tab-btn {
    flex: 1;
    min-width: 120px;
  }

  .employee-form,
  .vehicle-form-modern {
    gap: 1rem;
  }

  .form-section {
    padding: 1rem;
  }

  .detail-row {
    flex-direction: column;
    gap: 0.5rem;
  }
}

/* Deductions Styles */
.deductions-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.deductions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.deduction-matrix-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  margin-bottom: 2rem;
  overflow-x: auto;
}

.deduction-matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  background: white;
}

.deduction-matrix-table th,
.deduction-matrix-table td {
  padding: 0.75rem;
  text-align: center;
  border-bottom: 1px solid #dee2e6;
  border-right: 1px solid #dee2e6;
}

.deduction-matrix-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 10;
}

.deduction-matrix-table th:last-child,
.deduction-matrix-table td:last-child {
  border-right: none;
}

.employee-header {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.deduction-header {
  font-weight: 500;
}

.deduction-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.deduction-name {
  font-weight: 600;
  color: #333;
  font-size: 0.8rem;
}

.deduction-type {
  font-size: 0.75rem;
  color: #666;
}

.employee-cell {
  min-width: 200px;
}

.employee-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.employee-avatar-small {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.employee-details-small {
  text-align: left;
}

.employee-name-small {
  font-weight: 600;
  color: #333;
  font-size: 0.85rem;
  margin: 0;
}

.config-cell {
  min-width: 120px;
}

.config-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.mode-select {
  width: 100%;
  padding: 0.5rem;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.mode-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn-date-picker {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-date-picker:hover {
  background: #138496;
}

.selected-dates-count {
  font-size: 0.7rem;
  color: #666;
  margin-top: 0.25rem;
}

.instructions-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #667eea;
}

.instruction-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.instruction-icon {
  font-size: 1.5rem;
}

.instruction-header h5 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.instructions-card ul {
  padding-left: 1.5rem;
  margin: 0 0 1rem 0;
}

.instructions-card li {
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.instructions-card p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

/* Date Modal Styles */
.date-modal {
  max-width: 600px;
}

.calendar-section {
  margin-bottom: 2rem;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0 1rem;
}

.calendar-header h5 {
  margin: 0;
  color: #333;
  font-weight: 600;
}

.nav-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: #e9ecef;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 1rem;
}

.day-label {
  padding: 0.5rem;
  text-align: center;
  font-weight: 600;
  color: #666;
  font-size: 0.8rem;
}

.calendar-day {
  padding: 0.75rem;
  text-align: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.calendar-day:hover {
  background: #e9ecef;
}

.calendar-day.current-month {
  background: white;
}

.calendar-day.other-month {
  color: #adb5bd;
  background: #f8f9fa;
}

.calendar-day.selected {
  background: #007bff;
  color: white;
}

.calendar-day.today {
  background: #fff3cd;
  color: #856404;
  font-weight: 600;
}

.selected-dates-section {
  margin-bottom: 2rem;
}

.selected-dates-section h5 {
  margin-bottom: 1rem;
  color: #333;
}

.selected-dates-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.selected-date-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #e9ecef;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.remove-date-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 1rem;
  transition: background 0.2s;
}

.remove-date-btn:hover {
  background: rgba(220, 53, 69, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.btn-clear-dates {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-clear-dates:hover {
  background: #5a6268;
}

.btn-save-dates {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-save-dates:hover {
  background: #218838;
}

/* Configuration Status Classes */
.status-never {
  background: #f8f9fa !important;
}

.mode-never .mode-select {
  background: linear-gradient(to right, #f8f9fa 0%, #e2e8f0 100%) !important;
  border-color: #dee2e6 !important;
}

.status-always {
  background: #d4edda !important;
  border-color: #c3e6cb !important;
}

.mode-always .mode-select {
  background: linear-gradient(to right, #d4edda 0%, #c3e6cb 100%) !important;
  border-color: #28a745 !important;
  color: #155724 !important;
  font-weight: 500 !important;
}

.status-selected {
  background: #cce7ff !important;
  border-color: #b6d9ff !important;
}

.mode-selected_dates .mode-select {
  background: linear-gradient(to right, #cce7ff 0%, #b6d9ff 100%) !important;
  border-color: #007bff !important;
  color: #004085 !important;
  font-weight: 500 !important;
}

/* Configuration Actions */
.config-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-config-action {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-config-action.edit {
  background: #007bff;
  color: white;
}

.btn-config-action.edit:hover {
  background: #0056b3;
  transform: scale(1.1);
}

.btn-config-action.delete {
  background: #dc3545;
  color: white;
}

.btn-config-action.delete:hover {
  background: #c82333;
  transform: scale(1.1);
}

/* Date Preview */
.date-preview {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 0.5rem;
  min-width: 100px;
  font-size: 0.75rem;
  color: #666;
}

.date-count {
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.25rem;
}

.date-list-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.date-chip {
  background: #e9ecef;
  color: #495057;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  white-space: nowrap;
}

.date-range-preview {
  font-style: italic;
  color: #6c757d;
}

/* Always Mode Indicator */
.always-indicator {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Mobile responsiveness for deductions */
@media (max-width: 768px) {
  .deductions-header {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .deduction-matrix-container {
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .deduction-matrix-table {
    font-size: 0.75rem;
  }

  .deduction-matrix-table th,
  .deduction-matrix-table td {
    padding: 0.5rem 0.25rem;
  }

  .employee-cell {
    min-width: 150px;
  }

  .employee-info {
    flex-direction: column;
    gap: 0.5rem;
  }

  .employee-avatar-small {
    width: 30px;
    height: 30px;
    font-size: 0.8rem;
  }

  .employee-details-small {
    text-align: center;
  }

  .config-wrapper {
    gap: 0.25rem;
  }

  .mode-select {
    font-size: 0.75rem;
    padding: 0.4rem;
  }

  .btn-config-action {
    width: 22px;
    height: 22px;
  }

  .date-preview {
    padding: 0.4rem;
    min-width: 80px;
    font-size: 0.7rem;
  }

  .date-count {
    font-size: 0.75rem;
  }

  .btn-date-picker {
    padding: 0.35rem 0.6rem;
    font-size: 0.7rem;
  }

  .instructions-card {
    padding: 1rem;
  }

  .instruction-header {
    gap: 0.5rem;
  }

  .instruction-icon {
    font-size: 1.2rem;
  }

  .instruction-header h5 {
    font-size: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .calendar-section {
    margin-bottom: 1.5rem;
  }

  .calendar-header {
    padding: 0 0.5rem;
  }

  .calendar-header h5 {
    font-size: 0.9rem;
  }

  .calendar-day {
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .selected-dates-section h5 {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .selected-date-item {
    font-size: 0.75rem;
    padding: 0.4rem 0.6rem;
  }

  .modal-actions {
    padding-top: 1rem;
  }

  .btn-clear-dates,
  .btn-save-dates {
    padding: 0.6rem 1.2rem;
    font-size: 0.85rem;
  }
}
</style>
