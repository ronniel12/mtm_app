<template>
  <div class="maintenance-view">
    <!-- Mobile Header -->
    <div class="mobile-header" v-if="isMobile">
      <button @click="toggleMobileMenu" class="mobile-menu-btn">
        <span class="hamburger-icon">☰</span>
      </button>
      <h1 class="mobile-title">🚛 Maintenance</h1>
      <div class="mobile-actions">
        <button @click="refreshData" class="refresh-btn" :disabled="loading">
          <span v-if="loading">⟳</span>
          <span v-else>🔄</span>
        </button>
      </div>
    </div>

    <!-- Desktop Header -->
    <div class="desktop-header" v-else>
      <div class="header-content">
        <h1>🚛 Vehicle Maintenance System</h1>
        <p>Track preventive maintenance schedules and document expiry</p>
      </div>
      <div class="header-actions">
        <button @click="refreshData" class="refresh-btn" :disabled="loading">
          <span v-if="loading">⟳</span>
          <span v-else>🔄</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <div v-if="isMobile && showMobileMenu" class="mobile-menu-overlay" @click="toggleMobileMenu">
      <div class="mobile-menu" @click.stop>
        <div class="menu-header">
          <h3>Menu</h3>
          <button @click="toggleMobileMenu" class="close-menu-btn">✕</button>
        </div>
        <div class="menu-items">
          <button @click="setActiveTab('dashboard')" :class="{ active: activeTab === 'dashboard' }">
            📊 Dashboard
          </button>
          <button @click="setActiveTab('schedules')" :class="{ active: activeTab === 'schedules' }">
            📅 Schedules
          </button>
          <button @click="setActiveTab('documents')" :class="{ active: activeTab === 'documents' }">
            📄 Documents
          </button>
          <button @click="setActiveTab('settings')" :class="{ active: activeTab === 'settings' }">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !dashboardData" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading maintenance data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Failed to load maintenance data</h3>
      <p>{{ error }}</p>
      <button @click="refreshData" class="retry-btn">Try Again</button>
    </div>

    <!-- Main Content -->
    <div v-else class="maintenance-content">
      <!-- Tab Navigation (Desktop) -->
      <div class="tab-navigation" v-if="!isMobile">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="setActiveTab(tab.key)"
          :class="{ active: activeTab === tab.key }"
          class="tab-btn"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Dashboard Tab -->
      <div v-if="activeTab === 'dashboard'" class="tab-content">
        <div class="dashboard-grid">
          <!-- Statistics Cards -->
          <div class="stats-section">
            <h2>📊 Overview</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">📋</div>
                <div class="stat-content">
                  <div class="stat-value">{{ dashboardData?.stats?.totalSchedules || 0 }}</div>
                  <div class="stat-label">Total Schedules</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-content">
                  <div class="stat-value">{{ dashboardData?.stats?.activeSchedules || 0 }}</div>
                  <div class="stat-label">Active Schedules</div>
                </div>
              </div>
              <div class="stat-card urgent">
                <div class="stat-icon">🚨</div>
                <div class="stat-content">
                  <div class="stat-value">{{ dashboardData?.stats?.overdue || 0 }}</div>
                  <div class="stat-label">Overdue</div>
                </div>
              </div>
              <div class="stat-card warning">
                <div class="stat-icon">⚠️</div>
                <div class="stat-content">
                  <div class="stat-value">{{ dashboardData?.stats?.dueSoon || 0 }}</div>
                  <div class="stat-label">Due Soon</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Upcoming Maintenance -->
          <div class="upcoming-section">
            <h2>📅 Upcoming Maintenance</h2>
            <div v-if="dashboardData?.upcomingMaintenance?.length" class="maintenance-list">
              <div
                v-for="item in dashboardData.upcomingMaintenance"
                :key="item.id"
                class="maintenance-item"
                :class="{ urgent: isOverdue(item.next_due_date), warning: isDueSoon(item.next_due_date) }"
              >
                <div class="item-header">
                  <span class="vehicle-plate">{{ item.plate_number }}</span>
                  <span class="maintenance-type">{{ item.maintenance_type }}</span>
                </div>
                <div class="item-details">
                  <span class="due-date">{{ formatDate(item.next_due_date) }}</span>
                  <span class="days-left">{{ getDaysUntil(item.next_due_date) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <div class="empty-icon">✅</div>
              <p>No upcoming maintenance scheduled</p>
            </div>
          </div>

          <!-- Expiring Documents -->
          <div class="documents-section">
            <h2>📄 Expiring Documents</h2>
            <div v-if="dashboardData?.expiringDocuments?.length" class="documents-list">
              <div
                v-for="doc in dashboardData.expiringDocuments"
                :key="doc.id"
                class="document-item"
                :class="{ urgent: isOverdue(doc.expiry_date), warning: isDueSoon(doc.expiry_date) }"
              >
                <div class="doc-header">
                  <span class="vehicle-plate">{{ doc.plate_number }}</span>
                  <span class="doc-type">{{ doc.document_type }}</span>
                </div>
                <div class="doc-details">
                  <span class="expiry-date">{{ formatDate(doc.expiry_date) }}</span>
                  <span class="days-left">{{ getDaysUntil(doc.expiry_date) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <div class="empty-icon">✅</div>
              <p>No documents expiring soon</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Schedules Tab -->
      <div v-if="activeTab === 'schedules'" class="tab-content">
        <div class="schedules-header">
          <h2>📅 Maintenance Schedules</h2>
          <button @click="showScheduleForm = true" class="add-btn">
            <span>+</span>
            Add Schedule
          </button>
        </div>

        <div v-if="schedules.length" class="schedules-list">
          <div
            v-for="schedule in schedules"
            :key="schedule.id"
            class="schedule-card"
            :class="{ urgent: isOverdue(schedule.next_due_date), warning: isDueSoon(schedule.next_due_date) }"
          >
            <div class="schedule-header">
              <div class="schedule-info">
                <h3>{{ schedule.maintenance_type }}</h3>
                <p class="vehicle-name">{{ getVehicleName(schedule.vehicle_id) }}</p>
              </div>
              <div class="schedule-status">
                <span class="status-badge" :class="schedule.status">
                  {{ schedule.status }}
                </span>
              </div>
            </div>
            <div class="schedule-details">
              <div class="detail-item">
                <span class="label">Category:</span>
                <span class="value">{{ schedule.category }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Frequency:</span>
                <span class="value">Every {{ schedule.frequency_value }} {{ schedule.frequency_unit }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Next Due:</span>
                <span class="value">{{ formatDate(schedule.next_due_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Reminder:</span>
                <span class="value">{{ schedule.reminder_days }} days before</span>
              </div>
            </div>
            <div class="schedule-actions">
              <button @click="markCompleted(schedule)" class="complete-btn">✅ Complete</button>
              <button @click="editSchedule(schedule)" class="edit-btn">✏️ Edit</button>
              <button @click="deleteSchedule(schedule)" class="delete-btn">🗑️ Delete</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>No maintenance schedules</h3>
          <p>Create your first maintenance schedule to get started</p>
          <button @click="showScheduleForm = true" class="add-btn">Add Schedule</button>
        </div>
      </div>

      <!-- Documents Tab -->
      <div v-if="activeTab === 'documents'" class="tab-content">
        <div class="documents-header">
          <h2>📄 Vehicle Documents</h2>
          <button @click="showDocumentForm = true" class="add-btn">
            <span>+</span>
            Add Document
          </button>
        </div>

        <div v-if="documents.length" class="documents-list">
          <div
            v-for="doc in documents"
            :key="doc.id"
            class="document-card"
            :class="{ urgent: isOverdue(doc.expiry_date), warning: isDueSoon(doc.expiry_date) }"
          >
            <div class="document-header">
              <div class="document-info">
                <h3>{{ doc.document_type }}</h3>
                <p class="vehicle-name">{{ getVehicleName(doc.vehicle_id) }}</p>
              </div>
              <div class="document-status">
                <span v-if="doc.document_number" class="doc-number">{{ doc.document_number }}</span>
              </div>
            </div>
            <div class="document-details">
              <div class="detail-item">
                <span class="label">Issued:</span>
                <span class="value">{{ doc.issue_date ? formatDate(doc.issue_date) : 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Expires:</span>
                <span class="value">{{ formatDate(doc.expiry_date) }}</span>
              </div>
              <div class="detail-item" v-if="doc.issuing_authority">
                <span class="label">Authority:</span>
                <span class="value">{{ doc.issuing_authority }}</span>
              </div>
              <div class="detail-item" v-if="doc.cost">
                <span class="label">Cost:</span>
                <span class="value">₱{{ doc.cost }}</span>
              </div>
            </div>
            <div class="document-actions">
              <button @click="editDocument(doc)" class="edit-btn">✏️ Edit</button>
              <button @click="deleteDocument(doc)" class="delete-btn">🗑️ Delete</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>No vehicle documents</h3>
          <p>Add vehicle registration, insurance, and other documents</p>
          <button @click="showDocumentForm = true" class="add-btn">Add Document</button>
        </div>
      </div>

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <h2>⚙️ Notification Settings</h2>
        <div class="settings-section">
          <div class="settings-group">
            <h3>Default Preferences</h3>
            <div class="setting-item">
              <label class="setting-label">
                <span>Reminder Days Before Due</span>
                <input
                  v-model.number="settings.reminderDays"
                  type="number"
                  min="1"
                  max="30"
                  class="setting-input"
                />
              </label>
            </div>
            <div class="setting-item">
              <label class="setting-label">
                <input
                  v-model="settings.enableInApp"
                  type="checkbox"
                  class="setting-checkbox"
                />
                <span>Enable In-App Notifications</span>
              </label>
            </div>
            <div class="setting-item">
              <label class="setting-label">
                <input
                  v-model="settings.enableEmail"
                  type="checkbox"
                  class="setting-checkbox"
                />
                <span>Enable Email Notifications</span>
              </label>
            </div>
          </div>
          <div class="settings-actions">
            <button @click="saveSettings" class="save-btn">💾 Save Settings</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule Form Modal -->
    <div v-if="showScheduleForm" class="modal-overlay" @click="closeScheduleForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingSchedule ? 'Edit Schedule' : 'Add Maintenance Schedule' }}</h3>
          <button @click="closeScheduleForm" class="close-btn">✕</button>
        </div>
        <form @submit.prevent="saveSchedule" class="schedule-form">
          <div class="form-group">
            <label>Vehicle *</label>
            <select v-model="scheduleForm.vehicleId" required class="form-select">
              <option value="">Select Vehicle</option>
              <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                {{ vehicle.plate_number }} - {{ vehicle.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Maintenance Type *</label>
            <input v-model="scheduleForm.maintenanceType" required class="form-input" placeholder="e.g., Oil Change, Brake Inspection" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Category *</label>
              <select v-model="scheduleForm.category" required class="form-select">
                <option value="preventive">Preventive</option>
                <option value="documentation">Documentation</option>
                <option value="safety">Safety</option>
              </select>
            </div>
            <div class="form-group">
              <label>Schedule Type *</label>
              <select v-model="scheduleForm.scheduleType" required class="form-select">
                <option value="time_based">Time Based</option>
                <option value="mileage_based">Mileage Based</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Frequency Value *</label>
              <input v-model.number="scheduleForm.frequencyValue" required type="number" min="1" class="form-input" />
            </div>
            <div class="form-group">
              <label>Frequency Unit *</label>
              <select v-model="scheduleForm.frequencyUnit" required class="form-select">
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
                <option value="km">Kilometers</option>
                <option value="miles">Miles</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Reminder Days Before</label>
            <input v-model.number="scheduleForm.reminderDays" type="number" min="0" max="30" class="form-input" />
          </div>
          <div class="form-group">
            <label>Last Completed Date</label>
            <input v-model="scheduleForm.lastCompletedDate" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="scheduleForm.notes" class="form-textarea" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeScheduleForm" class="cancel-btn">Cancel</button>
            <button type="submit" class="submit-btn">Save Schedule</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Document Form Modal -->
    <div v-if="showDocumentForm" class="modal-overlay" @click="closeDocumentForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingDocument ? 'Edit Document' : 'Add Vehicle Document' }}</h3>
          <button @click="closeDocumentForm" class="close-btn">✕</button>
        </div>
        <form @submit.prevent="saveDocument" class="document-form">
          <div class="form-group">
            <label>Vehicle *</label>
            <select v-model="documentForm.vehicleId" required class="form-select">
              <option value="">Select Vehicle</option>
              <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                {{ vehicle.plate_number }} - {{ vehicle.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Document Type *</label>
            <select v-model="documentForm.documentType" required class="form-select">
              <option value="">Select Type</option>
              <option value="registration">Registration</option>
              <option value="insurance">Insurance</option>
              <option value="permit">Permit</option>
              <option value="fitness_certificate">Fitness Certificate</option>
              <option value="emission_certificate">Emission Certificate</option>
              <option value="road_tax">Road Tax</option>
            </select>
          </div>
          <div class="form-group">
            <label>Document Number</label>
            <input v-model="documentForm.documentNumber" class="form-input" placeholder="Document reference number" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Issue Date</label>
              <input v-model="documentForm.issueDate" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label>Expiry Date *</label>
              <input v-model="documentForm.expiryDate" required type="date" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label>Issuing Authority</label>
            <input v-model="documentForm.issuingAuthority" class="form-input" placeholder="e.g., LTO, Insurance Company" />
          </div>
          <div class="form-group">
            <label>Cost (₱)</label>
            <input v-model.number="documentForm.cost" type="number" step="0.01" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="documentForm.notes" class="form-textarea" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeDocumentForm" class="cancel-btn">Cancel</button>
            <button type="submit" class="submit-btn">Save Document</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'

// Reactive data
const loading = ref(false)
const error = ref(null)
const isMobile = ref(window.innerWidth < 768)
const showMobileMenu = ref(false)
const activeTab = ref('dashboard')

// Data
const dashboardData = ref(null)
const schedules = ref([])
const documents = ref([])
const vehicles = ref([])

// Forms
const showScheduleForm = ref(false)
const showDocumentForm = ref(false)
const editingSchedule = ref(null)
const editingDocument = ref(null)

// Form data
const scheduleForm = ref({
  vehicleId: '',
  maintenanceType: '',
  category: 'preventive',
  scheduleType: 'time_based',
  frequencyValue: 1,
  frequencyUnit: 'months',
  reminderDays: 7,
  lastCompletedDate: '',
  notes: ''
})

const documentForm = ref({
  vehicleId: '',
  documentType: '',
  documentNumber: '',
  issueDate: '',
  expiryDate: '',
  issuingAuthority: '',
  cost: null,
  notes: ''
})

// Settings
const settings = ref({
  reminderDays: 7,
  enableInApp: true,
  enableEmail: false
})

// Tabs configuration
const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'schedules', label: 'Schedules', icon: '📅' },
  { key: 'documents', label: 'Documents', icon: '📄' },
  { key: 'settings', label: 'Settings', icon: '⚙️' }
]

// Methods
const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value
}

const setActiveTab = (tab) => {
  activeTab.value = tab
  showMobileMenu.value = false
}

const refreshData = async () => {
  await loadAllData()
}

const loadAllData = async () => {
  loading.value = true
  error.value = null

  try {
    // Load dashboard data
    const dashboardResponse = await axios.get(`${API_BASE_URL}/maintenance/dashboard`)
    dashboardData.value = dashboardResponse.data

    // Load schedules
    const schedulesResponse = await axios.get(`${API_BASE_URL}/maintenance/schedules`)
    schedules.value = schedulesResponse.data

    // Load documents
    const documentsResponse = await axios.get(`${API_BASE_URL}/maintenance/documents`)
    documents.value = documentsResponse.data

    // Load vehicles
    const vehiclesResponse = await axios.get(`${API_BASE_URL}/vehicles`)
    vehicles.value = vehiclesResponse.data

  } catch (err) {
    console.error('Error loading maintenance data:', err)
    error.value = err.response?.data?.error || 'Failed to load maintenance data'
  } finally {
    loading.value = false
  }
}

// Schedule methods
const markCompleted = async (schedule) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    await axios.put(`${API_BASE_URL}/maintenance/schedules/${schedule.id}`, {
      lastCompletedDate: today,
      status: 'active'
    })
    await loadAllData()
  } catch (err) {
    console.error('Error marking schedule complete:', err)
  }
}

const editSchedule = (schedule) => {
  editingSchedule.value = schedule
  scheduleForm.value = {
    vehicleId: schedule.vehicle_id,
    maintenanceType: schedule.maintenance_type,
    category: schedule.category,
    scheduleType: schedule.schedule_type,
    frequencyValue: schedule.frequency_value,
    frequencyUnit: schedule.frequency_unit,
    reminderDays: schedule.reminder_days,
    lastCompletedDate: schedule.last_completed_date,
    notes: schedule.notes
  }
  showScheduleForm.value = true
}

const deleteSchedule = async (schedule) => {
  if (confirm(`Delete maintenance schedule for "${schedule.maintenance_type}"?`)) {
    try {
      await axios.delete(`${API_BASE_URL}/maintenance/schedules/${schedule.id}`)
      await loadAllData()
    } catch (err) {
      console.error('Error deleting schedule:', err)
    }
  }
}

const saveSchedule = async () => {
  try {
    const data = { ...scheduleForm.value }

    if (editingSchedule.value) {
      await axios.put(`${API_BASE_URL}/maintenance/schedules/${editingSchedule.value.id}`, data)
    } else {
      await axios.post(`${API_BASE_URL}/maintenance/schedules`, data)
    }

    closeScheduleForm()
    await loadAllData()
  } catch (err) {
    console.error('Error saving schedule:', err)
  }
}

const closeScheduleForm = () => {
  showScheduleForm.value = false
  editingSchedule.value = null
  scheduleForm.value = {
    vehicleId: '',
    maintenanceType: '',
    category: 'preventive',
    scheduleType: 'time_based',
    frequencyValue: 1,
    frequencyUnit: 'months',
    reminderDays: 7,
    lastCompletedDate: '',
    notes: ''
  }
}

// Document methods
const editDocument = (document) => {
  editingDocument.value = document
  documentForm.value = {
    vehicleId: document.vehicle_id,
    documentType: document.document_type,
    documentNumber: document.document_number,
    issueDate: document.issue_date,
    expiryDate: document.expiry_date,
    issuingAuthority: document.issuing_authority,
    cost: document.cost,
    notes: document.notes
  }
  showDocumentForm.value = true
}

const deleteDocument = async (document) => {
  if (confirm(`Delete document "${document.document_type}"?`)) {
    try {
      await axios.delete(`${API_BASE_URL}/maintenance/documents/${document.id}`)
      await loadAllData()
    } catch (err) {
      console.error('Error deleting document:', err)
    }
  }
}

const saveDocument = async () => {
  try {
    const data = { ...documentForm.value }

    if (editingDocument.value) {
      await axios.put(`${API_BASE_URL}/maintenance/documents/${editingDocument.value.id}`, data)
    } else {
      await axios.post(`${API_BASE_URL}/maintenance/documents`, data)
    }

    closeDocumentForm()
    await loadAllData()
  } catch (err) {
    console.error('Error saving document:', err)
  }
}

const closeDocumentForm = () => {
  showDocumentForm.value = false
  editingDocument.value = null
  documentForm.value = {
    vehicleId: '',
    documentType: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    cost: null,
    notes: ''
  }
}

// Settings methods
const saveSettings = async () => {
  try {
    // Save notification preferences
    await axios.post(`${API_BASE_URL}/maintenance/notifications/preferences`, {
      userId: 1, // Default user for now
      maintenanceType: 'all',
      reminderDays: settings.value.reminderDays,
      notificationMethods: [
        settings.value.enableInApp ? 'in_app' : null,
        settings.value.enableEmail ? 'email' : null
      ].filter(Boolean)
    })

    alert('Settings saved successfully!')
  } catch (err) {
    console.error('Error saving settings:', err)
  }
}

// Utility methods
const getVehicleName = (vehicleId) => {
  const vehicle = vehicles.value.find(v => v.id === vehicleId)
  return vehicle ? `${vehicle.plate_number} - ${vehicle.name || 'Unnamed'}` : 'Unknown Vehicle'
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

const isOverdue = (dateString) => {
  if (!dateString) return false
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const isDueSoon = (dateString) => {
  if (!dateString) return false
  const date = new Date(dateString)
  const today = new Date()
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  return date >= today && date <= sevenDaysFromNow
}

const getDaysUntil = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `${diffDays} days`
}

// Responsive handling
const handleResize = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  loadAllData()
})

// Cleanup
const onUnmounted = () => {
  window.removeEventListener('resize', handleResize)
}
</script>

<style scoped>
.maintenance-view {
  min-height: 100vh;
  background: #f8f9fa;
}

/* Mobile Header */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.mobile-menu-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.mobile-title {
  font-size: 1.2rem;
  margin: 0;
  font-weight: 600;
}

.mobile-actions {
  display: flex;
  gap: 0.5rem;
}

.refresh-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.refresh-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Desktop Header */
.desktop-header {
  background: white;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #333;
}

.header-content p {
  margin: 0;
  color: #666;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* Mobile Menu */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
}

.mobile-menu {
  position: absolute;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background: white;
  box-shadow: 2px 0 8px rgba(0,0,0,0.2);
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.menu-header h3 {
  margin: 0;
}

.close-menu-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}

.menu-items {
  padding: 1rem 0;
}

.menu-items button {
  display: block;
  width: 100%;
  padding: 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.menu-items button:hover,
.menu-items button.active {
  background: #f8f9fa;
  font-weight: 600;
}

/* Tab Navigation */
.tab-navigation {
  background: white;
  border-bottom: 1px solid #dee2e6;
  display: flex;
}

.tab-btn {
  flex: 1;
  padding: 1rem;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.tab-btn:hover,
.tab-btn.active {
  background: #f8f9fa;
  border-bottom-color: #007bff;
  color: #007bff;
}

.tab-icon {
  font-size: 1.5rem;
}

.tab-label {
  font-size: 0.8rem;
  font-weight: 500;
}

/* Tab Content */
.tab-content {
  padding: 2rem;
}

/* Dashboard */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.stats-section h2,
.upcoming-section h2,
.documents-section h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-card.urgent {
  border-left: 4px solid #dc3545;
}

.stat-card.warning {
  border-left: 4px solid #ffc107;
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.25rem;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
}

/* Lists */
.maintenance-list,
.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.maintenance-item,
.document-item {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.maintenance-item.urgent,
.document-item.urgent {
  border-left: 4px solid #dc3545;
}

.maintenance-item.warning,
.document-item.warning {
  border-left: 4px solid #ffc107;
}

.item-header,
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.vehicle-plate {
  font-weight: bold;
  color: #333;
}

.maintenance-type,
.doc-type {
  color: #666;
  font-size: 0.9rem;
}

.item-details,
.doc-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.due-date,
.expiry-date {
  color: #666;
}

.days-left {
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.maintenance-item.urgent .days-left,
.document-item.urgent .days-left {
  background: #f8d7da;
  color: #721c24;
}

.maintenance-item.warning .days-left,
.document-item.warning .days-left {
  background: #fff3cd;
  color: #856404;
}

/* Schedules */
.schedules-header,
.documents-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.schedules-header h2,
.documents-header h2 {
  margin: 0;
}

.add-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-btn:hover {
  background: #218838;
}

.schedules-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.schedule-card,
.document-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.schedule-card.urgent,
.document-card.urgent {
  border-left: 4px solid #dc3545;
}

.schedule-card.warning,
.document-card.warning {
  border-left: 4px solid #ffc107;
}

.schedule-header,
.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.schedule-info h3,
.document-info h3 {
  margin: 0 0 0.25rem 0;
  color: #333;
}

.vehicle-name {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

.schedule-status {
  text-align: right;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.paused {
  background: #fff3cd;
  color: #856404;
}

.status-badge.completed {
  background: #d1ecf1;
  color: #0c5460;
}

.schedule-details,
.document-details {
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f8f9fa;
}

.detail-item:last-child {
  border-bottom: none;
}

.label {
  color: #666;
  font-weight: 500;
}

.value {
  color: #333;
  text-align: right;
}

.schedule-actions,
.document-actions {
  display: flex;
  gap: 0.5rem;
}

.complete-btn,
.edit-btn,
.delete-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}

.complete-btn {
  background: #28a745;
  color: white;
}

.complete-btn:hover {
  background: #218838;
}

.edit-btn {
  background: #007bff;
  color: white;
}

.edit-btn:hover {
  background: #0056b3;
}

.delete-btn {
  background: #dc3545;
  color: white;
}

.delete-btn:hover {
  background: #c82333;
}

/* Settings */
.settings-section {
  max-width: 600px;
}

.settings-group {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.settings-group h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.setting-item {
  margin-bottom: 1rem;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 500;
}

.setting-input,
.setting-checkbox {
  margin-left: auto;
}

.setting-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.setting-checkbox {
  width: 18px;
  height: 18px;
}

.settings-actions {
  text-align: right;
}

.save-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.save-btn:hover {
  background: #0056b3;
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  color: #666;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

/* Forms */
.schedule-form,
.document-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.cancel-btn,
.submit-btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background: #5a6268;
}

.submit-btn {
  background: #007bff;
  color: white;
}

.submit-btn:hover {
  background: #0056b3;
}

/* Loading and Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-state h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.error-state p {
  margin: 0 0 1.5rem 0;
  color: #666;
}

.retry-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.retry-btn:hover {
  background: #0056b3;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .desktop-header {
    padding: 1rem;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }

  .tab-content {
    padding: 1rem;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-label {
    font-size: 0.8rem;
  }

  .schedules-list {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .schedule-card,
  .document-card {
    padding: 1rem;
  }

  .modal-content {
    margin: 1rem;
    max-width: none;
    width: calc(100vw - 2rem);
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .cancel-btn,
  .submit-btn {
    width: 100%;
  }
}
</style>
