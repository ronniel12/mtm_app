<template>
  <div class="maintenance-system">
    <!-- Header -->
    <div class="maintenance-header">
      <div class="header-content">
        <div class="header-icon">🔧</div>
        <div class="header-text">
          <h1>Vehicle Maintenance Tracker</h1>
          <p>Preventive maintenance scheduling and document management</p>
        </div>
      </div>
    </div>

    <!-- Quick Stats Dashboard -->
    <div class="stats-dashboard">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>{{ stats.totalSchedules }}</h3>
          <p>Total Schedules</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <h3>{{ stats.dueSoon }}</h3>
          <p>Due Soon</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚨</div>
        <div class="stat-content">
          <h3>{{ stats.overdue }}</h3>
          <p>Overdue</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <h3>{{ stats.completedThisMonth }}</h3>
          <p>Completed This Month</p>
        </div>
      </div>
    </div>

    <!-- Main Content Tabs -->
    <div class="maintenance-tabs">
      <div class="tab-buttons">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="{ active: activeTab === tab.id }"
          class="tab-button"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-text">{{ tab.name }}</span>
        </button>
      </div>

      <!-- Schedules Tab -->
      <div v-if="activeTab === 'schedules'" class="tab-content">
        <div class="tab-header">
          <h2>Maintenance Schedules</h2>
          <button @click="showScheduleForm = true" class="btn-primary">
            + Add Schedule
          </button>
        </div>

        <div class="filters-section">
          <select v-model="scheduleFilters.vehicle_id" @change="loadSchedules" class="filter-select">
            <option value="">All Vehicles</option>
            <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
              {{ vehicle.plate_number }}
            </option>
          </select>
          <select v-model="scheduleFilters.status" @change="loadSchedules" class="filter-select">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select v-model="scheduleFilters.category" @change="loadSchedules" class="filter-select">
            <option value="">All Categories</option>
            <option value="preventive">Preventive</option>
            <option value="documentation">Documentation</option>
            <option value="safety">Safety</option>
          </select>
        </div>

        <!-- Desktop Table View -->
        <div class="schedules-table-container desktop-view">
          <table class="schedules-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Maintenance Type</th>
                <th>Category</th>
                <th>Schedule Type</th>
                <th>Frequency</th>
                <th>Next Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="schedule in schedules" :key="schedule.id" :class="getScheduleRowClass(schedule)">
                <td>{{ getVehicleName(schedule.vehicle_id) }}</td>
                <td>{{ schedule.maintenance_type }}</td>
                <td><span class="category-badge" :class="`category-${schedule.category}`">{{ schedule.category }}</span></td>
                <td>{{ schedule.schedule_type }}</td>
                <td>{{ schedule.frequency_value }} {{ schedule.frequency_unit }}</td>
                <td>{{ formatDate(schedule.next_due_date) }}</td>
                <td><span class="status-badge" :class="`status-${schedule.status}`">{{ schedule.status }}</span></td>
                <td>
                  <div class="action-buttons">
                    <button @click="editSchedule(schedule)" class="btn-edit">✏️</button>
                    <button @click="markCompleted(schedule)" class="btn-complete">✅</button>
                    <button @click="deleteSchedule(schedule.id)" class="btn-delete">🗑️</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="schedules-mobile-cards mobile-view">
          <div v-for="schedule in schedules" :key="`mobile-${schedule.id}`" class="schedule-card" :class="getScheduleRowClass(schedule)">
            <div class="card-header">
              <div class="card-title">{{ schedule.maintenance_type }}</div>
              <span class="status-badge" :class="`status-${schedule.status}`">{{ schedule.status }}</span>
            </div>

            <div class="card-content">
              <div class="card-row">
                <strong>Vehicle:</strong>
                <span>{{ getVehicleName(schedule.vehicle_id) }}</span>
              </div>
              <div class="card-row">
                <strong>Category:</strong>
                <span class="category-badge" :class="`category-${schedule.category}`">{{ schedule.category }}</span>
              </div>
              <div class="card-row">
                <strong>Schedule:</strong>
                <span>{{ schedule.schedule_type }} - {{ schedule.frequency_value }} {{ schedule.frequency_unit }}</span>
              </div>
              <div class="card-row">
                <strong>Next Due:</strong>
                <span>{{ formatDate(schedule.next_due_date) }}</span>
              </div>
            </div>

            <div class="card-actions">
              <button @click="editSchedule(schedule)" class="btn-edit-mobile">
                <span class="btn-icon">✏️</span>
                <span class="btn-text">Edit</span>
              </button>
              <button @click="markCompleted(schedule)" class="btn-complete-mobile">
                <span class="btn-icon">✅</span>
                <span class="btn-text">Complete</span>
              </button>
              <button @click="deleteSchedule(schedule.id)" class="btn-delete-mobile">
                <span class="btn-icon">🗑️</span>
                <span class="btn-text">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents Tab -->
      <div v-if="activeTab === 'documents'" class="tab-content">
        <div class="tab-header">
          <h2>Vehicle Documents</h2>
          <button @click="showDocumentForm = true" class="btn-primary">
            + Add Document
          </button>
        </div>

        <div class="filters-section">
          <select v-model="documentFilters.vehicle_id" @change="loadDocuments" class="filter-select">
            <option value="">All Vehicles</option>
            <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
              {{ vehicle.plate_number }}
            </option>
          </select>
          <select v-model="documentFilters.document_type" @change="loadDocuments" class="filter-select">
            <option value="">All Types</option>
            <option value="registration">Registration</option>
            <option value="insurance">Insurance</option>
            <option value="permit">Permit</option>
            <option value="fitness_certificate">Fitness Certificate</option>
            <option value="emission_certificate">Emission Certificate</option>
          </select>
        </div>

        <!-- Desktop Table View -->
        <div class="documents-table-container desktop-view">
          <table class="documents-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Document Type</th>
                <th>Document Number</th>
                <th>Issue Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in documents" :key="doc.id" :class="getDocumentRowClass(doc)">
                <td>{{ getVehicleName(doc.vehicle_id) }}</td>
                <td>{{ doc.document_type.replace('_', ' ') }}</td>
                <td>{{ doc.document_number || 'N/A' }}</td>
                <td>{{ formatDate(doc.issue_date) }}</td>
                <td>{{ formatDate(doc.expiry_date) }}</td>
                <td><span class="status-badge" :class="getDocumentStatusClass(doc)">{{ getDocumentStatus(doc) }}</span></td>
                <td>
                  <div class="action-buttons">
                    <button @click="editDocument(doc)" class="btn-edit">✏️</button>
                    <button @click="deleteDocument(doc.id)" class="btn-delete">🗑️</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="documents-mobile-cards mobile-view">
          <div v-for="doc in documents" :key="`mobile-${doc.id}`" class="document-card" :class="getDocumentRowClass(doc)">
            <div class="card-header">
              <div class="card-title">{{ doc.document_type.replace('_', ' ') }}</div>
              <span class="status-badge" :class="getDocumentStatusClass(doc)">{{ getDocumentStatus(doc) }}</span>
            </div>

            <div class="card-content">
              <div class="card-row">
                <strong>Vehicle:</strong>
                <span>{{ getVehicleName(doc.vehicle_id) }}</span>
              </div>
              <div class="card-row">
                <strong>Document #:</strong>
                <span>{{ doc.document_number || 'N/A' }}</span>
              </div>
              <div class="card-row">
                <strong>Issue Date:</strong>
                <span>{{ formatDate(doc.issue_date) }}</span>
              </div>
              <div class="card-row">
                <strong>Expiry Date:</strong>
                <span>{{ formatDate(doc.expiry_date) }}</span>
              </div>
            </div>

            <div class="card-actions">
              <button @click="editDocument(doc)" class="btn-edit-mobile">
                <span class="btn-icon">✏️</span>
                <span class="btn-text">Edit</span>
              </button>
              <button @click="deleteDocument(doc.id)" class="btn-delete-mobile">
                <span class="btn-icon">🗑️</span>
                <span class="btn-text">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications Tab -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="tab-header">
          <h2>Notification Preferences</h2>
          <button @click="showNotificationForm = true" class="btn-primary">
            + Add Preference
          </button>
        </div>

        <div class="notifications-list">
          <div v-for="pref in notificationPreferences" :key="pref.id" class="notification-card">
            <div class="notification-content">
              <div class="notification-header">
                <h4>{{ pref.maintenance_type || 'All Types' }}</h4>
                <span class="active-status" :class="{ active: pref.is_active }">
                  {{ pref.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="notification-details">
                <p><strong>Reminder Days:</strong> {{ pref.reminder_days }}</p>
                <p><strong>Methods:</strong> {{ formatNotificationMethods(pref.notification_methods) }}</p>
              </div>
            </div>
            <div class="notification-actions">
              <button @click="editNotificationPreference(pref)" class="btn-edit">✏️</button>
              <button @click="deleteNotificationPreference(pref.id)" class="btn-delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule Form Modal -->
    <div v-if="showScheduleForm" class="modal-overlay" @click="closeScheduleForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingSchedule ? 'Edit Maintenance Schedule' : 'Add Maintenance Schedule' }}</h3>
          <button @click="closeScheduleForm" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveSchedule" class="schedule-form">
          <div class="form-row">
            <div class="form-group">
              <label>Vehicle *</label>
              <select v-model="scheduleForm.vehicle_id" required class="form-input">
                <option value="">Select Vehicle</option>
                <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                  {{ vehicle.plate_number }} - {{ vehicle.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Maintenance Type *</label>
              <input
                type="text"
                v-model="scheduleForm.maintenance_type"
                placeholder="e.g., Oil Change, Brake Inspection"
                required
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Category *</label>
              <select v-model="scheduleForm.category" required class="form-input">
                <option value="">Select Category</option>
                <option value="preventive">Preventive Maintenance</option>
                <option value="documentation">Documentation</option>
                <option value="safety">Safety Inspection</option>
              </select>
            </div>
            <div class="form-group">
              <label>Schedule Type *</label>
              <select v-model="scheduleForm.schedule_type" required class="form-input">
                <option value="">Select Type</option>
                <option value="time_based">Time Based</option>
                <option value="mileage_based">Mileage Based</option>
                <option value="document_based">Document Based</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Frequency Value *</label>
              <input
                type="number"
                v-model="scheduleForm.frequency_value"
                min="1"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Frequency Unit *</label>
              <select v-model="scheduleForm.frequency_unit" required class="form-input">
                <option value="">Select Unit</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
                <option value="km">Kilometers</option>
                <option value="miles">Miles</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Reminder Days</label>
              <input
                type="number"
                v-model="scheduleForm.reminder_days"
                min="0"
                placeholder="7"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="scheduleForm.status" class="form-input">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Last Completed Date</label>
            <input
              type="date"
              v-model="scheduleForm.last_completed_date"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea
              v-model="scheduleForm.notes"
              placeholder="Additional notes"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeScheduleForm" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">
              {{ editingSchedule ? 'Update Schedule' : 'Add Schedule' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Document Form Modal -->
    <div v-if="showDocumentForm" class="modal-overlay" @click="closeDocumentForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingDocument ? 'Edit Vehicle Document' : 'Add Vehicle Document' }}</h3>
          <button @click="closeDocumentForm" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveDocument" class="document-form">
          <div class="form-row">
            <div class="form-group">
              <label>Vehicle *</label>
              <select v-model="documentForm.vehicle_id" required class="form-input">
                <option value="">Select Vehicle</option>
                <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                  {{ vehicle.plate_number }} - {{ vehicle.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Document Type *</label>
              <select v-model="documentForm.document_type" required class="form-input">
                <option value="">Select Type</option>
                <option value="registration">Registration</option>
                <option value="insurance">Insurance</option>
                <option value="permit">Permit</option>
                <option value="fitness_certificate">Fitness Certificate</option>
                <option value="emission_certificate">Emission Certificate</option>
                <option value="road_tax">Road Tax</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Document Number</label>
              <input
                type="text"
                v-model="documentForm.document_number"
                placeholder="Document number (optional)"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Issuing Authority</label>
              <input
                type="text"
                v-model="documentForm.issuing_authority"
                placeholder="e.g., LTO, Insurance Company"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Issue Date</label>
              <input
                type="date"
                v-model="documentForm.issue_date"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Expiry Date *</label>
              <input
                type="date"
                v-model="documentForm.expiry_date"
                required
                class="form-input"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Cost</label>
              <input
                type="number"
                v-model="documentForm.cost"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Document File Path</label>
              <input
                type="text"
                v-model="documentForm.document_file_path"
                placeholder="Path to uploaded document"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea
              v-model="documentForm.notes"
              placeholder="Additional notes"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeDocumentForm" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">
              {{ editingDocument ? 'Update Document' : 'Add Document' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Notification Preference Form Modal -->
    <div v-if="showNotificationForm" class="modal-overlay" @click="closeNotificationForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingNotification ? 'Edit Notification Preference' : 'Add Notification Preference' }}</h3>
          <button @click="closeNotificationForm" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveNotificationPreference" class="notification-form">
          <div class="form-row">
            <div class="form-group">
              <label>Maintenance Type</label>
              <input
                type="text"
                v-model="notificationForm.maintenance_type"
                placeholder="Specific type or 'all' for all types"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Reminder Days *</label>
              <input
                type="number"
                v-model="notificationForm.reminder_days"
                min="0"
                required
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Notification Methods *</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" value="sms" v-model="notificationForm.notification_methods_list">
                SMS
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="whatsapp" v-model="notificationForm.notification_methods_list">
                WhatsApp
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="facebook" v-model="notificationForm.notification_methods_list">
                Facebook Messenger
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="viber" v-model="notificationForm.notification_methods_list">
                Viber
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="in_app" v-model="notificationForm.notification_methods_list">
                In-App Notification
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="push" v-model="notificationForm.notification_methods_list">
                Push Notification
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="notificationForm.is_active">
              Active
            </label>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeNotificationForm" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">
              {{ editingNotification ? 'Update Preference' : 'Add Preference' }}
            </button>
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
const stats = ref({
  totalSchedules: 0,
  activeSchedules: 0,
  dueSoon: 0,
  overdue: 0,
  completedThisMonth: 0
})

const vehicles = ref([])
const schedules = ref([])
const documents = ref([])
const notificationPreferences = ref([])

const activeTab = ref('schedules')
const showScheduleForm = ref(false)
const showDocumentForm = ref(false)
const showNotificationForm = ref(false)

const editingSchedule = ref(null)
const editingDocument = ref(null)
const editingNotification = ref(null)

// Filters
const scheduleFilters = ref({
  vehicle_id: '',
  status: '',
  category: ''
})

const documentFilters = ref({
  vehicle_id: '',
  document_type: ''
})

// Form data
const scheduleForm = ref({
  vehicle_id: '',
  maintenance_type: '',
  category: '',
  schedule_type: '',
  frequency_value: '',
  frequency_unit: '',
  reminder_days: 7,
  last_completed_date: '',
  status: 'active',
  notes: ''
})

const documentForm = ref({
  vehicle_id: '',
  document_type: '',
  document_number: '',
  issue_date: '',
  expiry_date: '',
  issuing_authority: '',
  cost: '',
  document_file_path: '',
  notes: ''
})

const notificationForm = ref({
  maintenance_type: '',
  reminder_days: 7,
  notification_methods_list: ['in_app'],
  is_active: true
})

// Tabs configuration
const tabs = [
  { id: 'schedules', name: 'Schedules', icon: '📅' },
  { id: 'documents', name: 'Documents', icon: '📄' },
  { id: 'notifications', name: 'Notifications', icon: '🔔' }
]

// Methods
const loadDashboardStats = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/maintenance/dashboard`)
    stats.value = response.data.stats
  } catch (error) {
    console.error('Error loading dashboard stats:', error)
  }
}

const loadVehicles = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/vehicles`)
    vehicles.value = response.data
  } catch (error) {
    console.error('Error loading vehicles:', error)
  }
}

const loadSchedules = async () => {
  try {
    const params = new URLSearchParams()
    if (scheduleFilters.value.vehicle_id) params.append('vehicle_id', scheduleFilters.value.vehicle_id)
    if (scheduleFilters.value.status) params.append('status', scheduleFilters.value.status)
    if (scheduleFilters.value.category) params.append('category', scheduleFilters.value.category)

    const response = await axios.get(`${API_BASE_URL}/maintenance/schedules?${params}`)
    schedules.value = response.data
  } catch (error) {
    console.error('Error loading schedules:', error)
  }
}

const loadDocuments = async () => {
  try {
    const params = new URLSearchParams()
    if (documentFilters.value.vehicle_id) params.append('vehicle_id', documentFilters.value.vehicle_id)
    if (documentFilters.value.document_type) params.append('document_type', documentFilters.value.document_type)

    const response = await axios.get(`${API_BASE_URL}/maintenance/documents?${params}`)
    documents.value = response.data
  } catch (error) {
    console.error('Error loading documents:', error)
  }
}

const loadNotificationPreferences = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/maintenance/notifications/preferences`)
    notificationPreferences.value = response.data
  } catch (error) {
    console.error('Error loading notification preferences:', error)
  }
}

const getVehicleName = (vehicleId) => {
  const vehicle = vehicles.value.find(v => v.id === vehicleId)
  return vehicle ? `${vehicle.plate_number} ${vehicle.name ? `(${vehicle.name})` : ''}` : 'Unknown Vehicle'
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getScheduleRowClass = (schedule) => {
  if (schedule.status === 'completed') return 'completed'
  if (schedule.next_due_date) {
    const dueDate = new Date(schedule.next_due_date)
    const today = new Date()
    const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

    if (daysDiff < 0) return 'overdue'
    if (daysDiff <= 7) return 'due-soon'
  }
  return ''
}

const getDocumentRowClass = (doc) => {
  if (doc.expiry_date) {
    const expiryDate = new Date(doc.expiry_date)
    const today = new Date()
    const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))

    if (daysDiff < 0) return 'expired'
    if (daysDiff <= 30) return 'expiring-soon'
  }
  return ''
}

const getDocumentStatus = (doc) => {
  if (!doc.expiry_date) return 'Unknown'

  const expiryDate = new Date(doc.expiry_date)
  const today = new Date()
  const daysDiff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))

  if (daysDiff < 0) return 'Expired'
  if (daysDiff <= 30) return 'Expiring Soon'
  return 'Valid'
}

const getDocumentStatusClass = (doc) => {
  const status = getDocumentStatus(doc)
  switch (status) {
    case 'Expired': return 'status-expired'
    case 'Expiring Soon': return 'status-warning'
    default: return 'status-valid'
  }
}

const formatNotificationMethods = (methodsJson) => {
  try {
    const methods = JSON.parse(methodsJson || '[]')
    return methods.map(method => method.replace('_', ' ')).join(', ')
  } catch {
    return 'None'
  }
}

// CRUD operations for schedules
const saveSchedule = async () => {
  try {
    const formData = { ...scheduleForm.value }

    if (editingSchedule.value) {
      await axios.put(`${API_BASE_URL}/maintenance/schedules/${editingSchedule.value.id}`, formData)
    } else {
      await axios.post(`${API_BASE_URL}/maintenance/schedules`, formData)
    }

    closeScheduleForm()
    loadSchedules()
    loadDashboardStats()
  } catch (error) {
    console.error('Error saving schedule:', error)
  }
}

const editSchedule = (schedule) => {
  editingSchedule.value = schedule
  scheduleForm.value = { ...schedule }
  showScheduleForm.value = true
}

const markCompleted = async (schedule) => {
  try {
    const updatedSchedule = {
      ...schedule,
      last_completed_date: new Date().toISOString().split('T')[0],
      status: 'completed'
    }

    await axios.put(`${API_BASE_URL}/maintenance/schedules/${schedule.id}`, updatedSchedule)
    loadSchedules()
    loadDashboardStats()
  } catch (error) {
    console.error('Error marking schedule as completed:', error)
  }
}

const deleteSchedule = async (id) => {
  if (confirm('Are you sure you want to delete this maintenance schedule?')) {
    try {
      await axios.delete(`${API_BASE_URL}/maintenance/schedules/${id}`)
      loadSchedules()
      loadDashboardStats()
    } catch (error) {
      console.error('Error deleting schedule:', error)
    }
  }
}

const closeScheduleForm = () => {
  showScheduleForm.value = false
  editingSchedule.value = null
  scheduleForm.value = {
    vehicle_id: '',
    maintenance_type: '',
    category: '',
    schedule_type: '',
    frequency_value: '',
    frequency_unit: '',
    reminder_days: 7,
    last_completed_date: '',
    status: 'active',
    notes: ''
  }
}

// CRUD operations for documents
const saveDocument = async () => {
  try {
    const formData = { ...documentForm.value }

    if (editingDocument.value) {
      await axios.put(`${API_BASE_URL}/maintenance/documents/${editingDocument.value.id}`, formData)
    } else {
      await axios.post(`${API_BASE_URL}/maintenance/documents`, formData)
    }

    closeDocumentForm()
    loadDocuments()
  } catch (error) {
    console.error('Error saving document:', error)
  }
}

const editDocument = (document) => {
  editingDocument.value = document
  documentForm.value = { ...document }
  showDocumentForm.value = true
}

const deleteDocument = async (id) => {
  if (confirm('Are you sure you want to delete this document?')) {
    try {
      await axios.delete(`${API_BASE_URL}/maintenance/documents/${id}`)
      loadDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }
}

const closeDocumentForm = () => {
  showDocumentForm.value = false
  editingDocument.value = null
  documentForm.value = {
    vehicle_id: '',
    document_type: '',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    cost: '',
    document_file_path: '',
    notes: ''
  }
}

// CRUD operations for notification preferences
const saveNotificationPreference = async () => {
  try {
    const formData = {
      ...notificationForm.value,
      notification_methods: JSON.stringify(notificationForm.value.notification_methods_list)
    }

    if (editingNotification.value) {
      await axios.put(`${API_BASE_URL}/maintenance/notifications/preferences/${editingNotification.value.id}`, formData)
    } else {
      await axios.post(`${API_BASE_URL}/maintenance/notifications/preferences`, formData)
    }

    closeNotificationForm()
    loadNotificationPreferences()
  } catch (error) {
    console.error('Error saving notification preference:', error)
  }
}

const editNotificationPreference = (preference) => {
  editingNotification.value = preference
  notificationForm.value = {
    ...preference,
    notification_methods_list: JSON.parse(preference.notification_methods || '[]')
  }
  showNotificationForm.value = true
}

const deleteNotificationPreference = async (id) => {
  if (confirm('Are you sure you want to delete this notification preference?')) {
    try {
      await axios.delete(`${API_BASE_URL}/maintenance/notifications/preferences/${id}`)
      loadNotificationPreferences()
    } catch (error) {
      console.error('Error deleting notification preference:', error)
    }
  }
}

const closeNotificationForm = () => {
  showNotificationForm.value = false
  editingNotification.value = null
  notificationForm.value = {
    maintenance_type: '',
    reminder_days: 7,
    notification_methods_list: ['in_app'],
    is_active: true
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadDashboardStats(),
    loadVehicles(),
    loadSchedules(),
    loadDocuments(),
    loadNotificationPreferences()
  ])
})
</script>

<style scoped>
.maintenance-system {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  min-height: 100vh;
}

.maintenance-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-icon {
  font-size: 3rem;
  opacity: 0.9;
}

.header-text h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.header-text p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.stats-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.8;
}

.stat-content h3 {
  margin: 0 0 0.25rem 0;
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-content p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.maintenance-tabs {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.tab-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.tab-button:hover {
  background: #f1f5f9;
  color: #374151;
}

.tab-button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: white;
}

.tab-icon {
  font-size: 1.1rem;
}

.tab-text {
  font-size: 0.9rem;
}

.tab-content {
  padding: 2rem;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.tab-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 600;
}

.filters-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  min-width: 150px;
}

/* Table Styles */
.schedules-table-container,
.documents-table-container {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.schedules-table,
.documents-table {
  width: 100%;
  min-width: 1000px;
  border-collapse: collapse;
  background: white;
}

.schedules-table th,
.schedules-table td,
.documents-table th,
.documents-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.schedules-table th,
.documents-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.schedules-table tbody tr:hover,
.documents-table tbody tr:hover {
  background: #f8fafc;
}

/* Status and Category Badges */
.status-badge,
.category-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-paused {
  background: #fef3c7;
  color: #92400e;
}

.status-completed {
  background: #e0e7ff;
  color: #3730a3;
}

.status-expired {
  background: #fee2e2;
  color: #dc2626;
}

.status-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-valid {
  background: #dcfce7;
  color: #166534;
}

.category-preventive {
  background: #dbeafe;
  color: #1e40af;
}

.category-documentation {
  background: #fef3c7;
  color: #92400e;
}

.category-safety {
  background: #fee2e2;
  color: #dc2626;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-delete, .btn-complete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 1rem;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #dbeafe;
}

.btn-delete:hover {
  background: #fee2e2;
}

.btn-complete:hover {
  background: #dcfce7;
}

/* Row Classes */
.overdue {
  background: #fef2f2 !important;
}

.due-soon {
  background: #fef3c7 !important;
}

.completed {
  background: #f0fdf4 !important;
  opacity: 0.7;
}

.expired {
  background: #fef2f2 !important;
}

.expiring-soon {
  background: #fef3c7 !important;
}

/* Mobile Card Views */
.mobile-view {
  display: none;
}

.schedules-mobile-cards,
.documents-mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.schedule-card,
.document-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.card-content {
  margin-bottom: 1rem;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.card-row strong {
  font-weight: 600;
  color: #374151;
  min-width: 100px;
  flex-shrink: 0;
}

.card-row span {
  color: #6b7280;
  text-align: right;
  flex: 1;
  word-wrap: break-word;
}

.card-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-edit-mobile,
.btn-delete-mobile,
.btn-complete-mobile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
  justify-content: center;
}

.btn-edit-mobile {
  background: #dbeafe;
  color: #1e40af;
}

.btn-edit-mobile:hover {
  background: #bfdbfe;
}

.btn-delete-mobile {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete-mobile:hover {
  background: #fecaca;
}

.btn-complete-mobile {
  background: #dcfce7;
  color: #166534;
}

.btn-complete-mobile:hover {
  background: #bbf7d0;
}

.btn-icon {
  font-size: 1rem;
}

.btn-text {
  font-size: 0.85rem;
}

/* Notifications */
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-content {
  flex: 1;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.notification-header h4 {
  margin: 0;
  color: #1f2937;
}

.active-status {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.active-status.active {
  background: #dcfce7;
  color: #166534;
}

.active-status:not(.active) {
  background: #fee2e2;
  color: #dc2626;
}

.notification-details {
  color: #6b7280;
  font-size: 0.9rem;
}

.notification-details p {
  margin: 0.25rem 0;
}

.notification-actions {
  display: flex;
  gap: 0.5rem;
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
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
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

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Form Styles */
.schedule-form,
.document-form,
.notification-form {
  padding: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.form-input,
.form-textarea {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #4b5563;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .maintenance-system {
    padding: 1rem;
  }

  .maintenance-header {
    padding: 1.5rem;
  }

  .header-text h1 {
    font-size: 2rem;
  }

  .header-text p {
    font-size: 1rem;
  }

  .stats-dashboard {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-content h3 {
    font-size: 1.5rem;
  }

  .tab-buttons {
    flex-direction: column;
  }

  .tab-button {
    justify-content: flex-start;
    padding: 0.75rem 1rem;
  }

  .tab-content {
    padding: 1.5rem;
  }

  .tab-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .filters-section {
    flex-direction: column;
  }

  .filter-select {
    min-width: auto;
    width: 100%;
  }

  /* Show mobile cards, hide tables */
  .desktop-view {
    display: none;
  }

  .mobile-view {
    display: block;
  }

  .card-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .card-row strong {
    min-width: auto;
  }

  .card-row span {
    text-align: left;
  }

  .card-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn-edit-mobile,
  .btn-delete-mobile,
  .btn-complete-mobile {
    width: 100%;
    justify-content: center;
  }

  .notification-card {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .notification-actions {
    width: 100%;
    justify-content: stretch;
  }

  .modal-content {
    margin: 1rem;
    max-width: none;
    width: calc(100vw - 2rem);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .checkbox-group {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .maintenance-system {
    padding: 0.5rem;
  }

  .maintenance-header {
    padding: 1rem;
    border-radius: 8px;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .header-text h1 {
    font-size: 1.5rem;
  }

  .stats-dashboard {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 0.75rem;
  }

  .stat-content h3 {
    font-size: 1.25rem;
  }

  .tab-content {
    padding: 1rem;
  }

  .schedule-card,
  .document-card {
    padding: 1rem;
  }

  .modal-content {
    margin: 0.5rem;
    width: calc(100vw - 1rem);
  }
}
