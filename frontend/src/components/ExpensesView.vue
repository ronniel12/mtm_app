<template>
  <div class="expenses-view">
    <div class="expenses-header">
      <div class="header-actions">
        <button @click="showAddExpense = true" class="btn-primary">
          + Add Expense
        </button>
        <div class="filter-controls">
          <select v-model="selectedCategory" @change="filterExpenses" class="filter-select">
            <option value="">All Categories</option>
            <option value="office_supplies">Office Supplies</option>
            <option value="parts">Parts</option>
            <option value="labor">Labor</option>
            <option value="bookkeeping">Bookkeeping</option>
            <option value="services">Services</option>
            <option value="parking_fee">Parking Fee</option>
            <option value="coordinator">Coordinator</option>
            <option value="rfid_service_charge">RFID Service Charge</option>
            <option value="others">Others</option>
          </select>
          <input
            type="month"
            v-model="selectedMonth"
            @change="filterExpenses"
            class="filter-month"
          />
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-icon">💰</div>
        <div class="card-content">
          <h3>Total Expenses</h3>
          <p class="amount">{{ formatCurrency(totalExpenses) }}</p>
          <span class="period">This Month</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">⛽</div>
        <div class="card-content">
          <h3>Fuel Costs</h3>
          <p class="amount">{{ formatCurrency(fuelTotal) }}</p>
          <span class="period">This Month</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">🔧</div>
        <div class="card-content">
          <h3>Maintenance</h3>
          <p class="amount">{{ formatCurrency(maintenanceTotal) }}</p>
          <span class="period">This Month</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h3>Avg per Trip</h3>
          <p class="amount">{{ formatCurrency(avgPerTrip) }}</p>
          <span class="period">This Month</span>
        </div>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="expenses-table-container">
      <table class="expenses-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Vehicle</th>
            <th>Amount</th>
            <th>Attachment</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="expense in filteredExpenses" :key="expense.id" class="expense-row">
            <td>{{ formatDate(expense.date) }}</td>
            <td>
              <span class="category-badge" :class="`category-${expense.category}`">
                {{ getCategoryLabel(expense.category) }}
              </span>
            </td>
            <td>{{ expense.description }}</td>
            <td>{{ expense.vehicle || 'N/A' }}</td>
            <td class="amount-cell">{{ formatCurrency(expense.amount) }}</td>
            <td>
              <div v-if="expense.receipt_filename" class="attachment-cell">
                <button @click="viewAttachment(expense)" class="btn-attachment" title="View/Download Receipt">
                  📎 {{ getFileTypeIcon(expense.receipt_mimetype) }}
                </button>
                <span class="file-info">{{ formatFileSize(expense.receipt_size) }}</span>
              </div>
              <span v-else class="no-attachment">—</span>
            </td>
            <td>
              <div class="action-buttons">
                <button @click="editExpense(expense)" class="btn-edit">✏️</button>
                <button @click="deleteExpense(expense.id)" class="btn-delete">🗑️</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredExpenses.length === 0" class="empty-row">
            <td colspan="7" class="empty-message">
              No expenses found for the selected filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card Layout -->
    <div class="expenses-mobile-cards">
      <div v-for="expense in filteredExpenses" :key="`mobile-${expense.id}`" class="expense-card">
        <div class="card-header">
          <div class="card-date">{{ formatDate(expense.date) }}</div>
          <span class="category-badge" :class="`category-${expense.category}`">
            {{ getCategoryLabel(expense.category) }}
          </span>
        </div>

        <div class="card-content">
          <div class="card-row">
            <strong>Description:</strong>
            <span>{{ expense.description }}</span>
          </div>

          <div class="card-row">
            <strong>Vehicle:</strong>
            <span>{{ expense.vehicle || 'N/A' }}</span>
          </div>

          <div class="card-row">
            <strong>Amount:</strong>
            <span class="amount-cell">{{ formatCurrency(expense.amount) }}</span>
          </div>

          <div v-if="expense.receipt_filename" class="card-row">
            <strong>Attachment:</strong>
            <div class="attachment-cell">
              <button @click="viewAttachment(expense)" class="btn-attachment" title="View/Download Receipt">
                📎 {{ getFileTypeIcon(expense.receipt_mimetype) }}
              </button>
              <span class="file-info">{{ formatFileSize(expense.receipt_size) }}</span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button @click="editExpense(expense)" class="btn-edit-mobile">
            <span class="btn-icon">✏️</span>
            <span class="btn-text">Edit</span>
          </button>
          <button @click="deleteExpense(expense.id)" class="btn-delete-mobile">
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">Delete</span>
          </button>
        </div>
      </div>

      <div v-if="filteredExpenses.length === 0" class="empty-mobile">
        <div class="empty-message">
          No expenses found for the selected filters.
        </div>
      </div>
    </div>

    <!-- Add/Edit Expense Modal -->
    <div v-if="showAddExpense || editingExpense" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingExpense ? 'Edit Expense' : 'Add New Expense' }}</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveExpense" class="expense-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date *</label>
              <input
                type="date"
                v-model="expenseForm.date"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Category *</label>
              <select v-model="expenseForm.category" required class="form-input">
                <option value="">Select Category</option>
                <option value="office_supplies">Office Supplies</option>
                <option value="parts">Parts</option>
                <option value="labor">Labor</option>
                <option value="bookkeeping">Bookkeeping</option>
                <option value="services">Services</option>
                <option value="parking_fee">Parking Fee</option>
                <option value="coordinator">Coordinator</option>
                <option value="rfid_service_charge">RFID Service Charge</option>
                <option value="others">Others</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Description *</label>
              <input
                type="text"
                v-model="expenseForm.description"
                placeholder="Enter expense description"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Vehicle</label>
              <select v-model="expenseForm.vehicle" class="form-input">
                <option value="">Select Vehicle (Optional)</option>
                <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.plateNumber">
                  {{ vehicle.plateNumber }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount *</label>
              <input
                type="number"
                v-model="expenseForm.amount"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Payment Method</label>
              <select v-model="expenseForm.paymentMethod" class="form-input">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Receipt Attachment</label>
            <input
              type="file"
              @change="handleFileChange"
              accept=".jpg,.jpeg,.png,.pdf"
              class="form-input"
            />
            <small class="file-hint">Supported formats: JPG, PNG, PDF (Max 5MB)</small>
            <div v-if="selectedFile" class="file-preview">
              <span class="file-name">📎 {{ selectedFile.name }}</span>
              <button type="button" @click="clearFile" class="file-remove">✕</button>
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea
              v-model="expenseForm.notes"
              placeholder="Additional notes (optional)"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">
              {{ editingExpense ? 'Update Expense' : 'Add Expense' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'

// Reactive data
const expenses = ref([])
const vehicles = ref([])
const showAddExpense = ref(false)
const editingExpense = ref(null)
const selectedCategory = ref('')
const selectedMonth = ref(new Date().toISOString().slice(0, 7)) // Current month
const selectedFile = ref(null)

// Form data
const expenseForm = ref({
  date: new Date().toISOString().slice(0, 10),
  category: '',
  description: '',
  vehicle: '',
  amount: '',
  paymentMethod: 'cash',
  notes: ''
})

// Computed properties
const filteredExpenses = computed(() => {
  let filtered = expenses.value

  if (selectedCategory.value) {
    filtered = filtered.filter(expense => expense.category === selectedCategory.value)
  }

  if (selectedMonth.value) {
    filtered = filtered.filter(expense => {
      const expenseMonth = new Date(expense.date).toISOString().slice(0, 7)
      return expenseMonth === selectedMonth.value
    })
  }

  return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const totalExpenses = computed(() => {
  return filteredExpenses.value.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0)
})

const fuelTotal = computed(() => {
  return filteredExpenses.value
    .filter(expense => expense.category === 'fuel')
    .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0)
})

const maintenanceTotal = computed(() => {
  return filteredExpenses.value
    .filter(expense => expense.category === 'maintenance')
    .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0)
})

const avgPerTrip = computed(() => {
  // This would need trip data to calculate properly
  // For now, return a placeholder calculation
  return totalExpenses.value / 10 // Placeholder: assume 10 trips per month
})

// Methods
const fetchExpenses = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/expenses`)
    expenses.value = response.data || []
  } catch (error) {
    console.error('Error fetching expenses:', error)
    // For demo purposes, use mock data if API fails
    expenses.value = [
      {
        id: 1,
        date: '2025-01-15',
        category: 'fuel',
        description: 'Diesel fuel for delivery truck',
        vehicle: 'ABC-123',
        amount: 2500.00,
        paymentMethod: 'cash',
        notes: 'Regular fuel refill'
      },
      {
        id: 2,
        date: '2025-01-10',
        category: 'maintenance',
        description: 'Oil change and tire rotation',
        vehicle: 'ABC-123',
        amount: 1200.00,
        paymentMethod: 'card',
        notes: 'Scheduled maintenance'
      }
    ]
  }
}

const fetchVehicles = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/vehicles`)
    vehicles.value = response.data || []
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    // Fallback to empty array if API fails
    vehicles.value = []
  }
}

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      event.target.value = ''
      return
    }
    selectedFile.value = file
  } else {
    selectedFile.value = null
  }
}

const clearFile = () => {
  selectedFile.value = null
  // Reset the file input
  const fileInput = document.querySelector('input[type="file"]')
  if (fileInput) {
    fileInput.value = ''
  }
}

const saveExpense = async () => {
  try {
    if (editingExpense.value) {
      // Update existing expense (without file support for now)
      const expenseData = { ...expenseForm.value }
      await axios.put(`${API_BASE_URL}/expenses/${editingExpense.value.id}`, expenseData)
      const index = expenses.value.findIndex(e => e.id === editingExpense.value.id)
      if (index !== -1) {
        expenses.value[index] = { ...expenseData, id: editingExpense.value.id }
      }
    } else {
      // Add new expense with file support
      const formData = new FormData()

      // Add form fields
      Object.keys(expenseForm.value).forEach(key => {
        if (expenseForm.value[key] !== null && expenseForm.value[key] !== undefined && expenseForm.value[key] !== '') {
          formData.append(key, expenseForm.value[key])
        }
      })

      // Add file if selected
      if (selectedFile.value) {
        formData.append('receipt', selectedFile.value)
      }

      const response = await axios.post(`${API_BASE_URL}/expenses`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      expenses.value.push(response.data)
    }

    closeModal()
    resetForm()
  } catch (error) {
    console.error('Error saving expense:', error)
    // For demo, simulate adding to local array
    if (!editingExpense.value) {
      const newExpense = {
        ...expenseForm.value,
        id: Date.now(),
        amount: parseFloat(expenseForm.value.amount)
      }
      expenses.value.push(newExpense)
    }
    closeModal()
    resetForm()
  }
}

const editExpense = (expense) => {
  editingExpense.value = expense
  expenseForm.value = { ...expense }
  showAddExpense.value = true
}

const deleteExpense = async (id) => {
  if (confirm('Are you sure you want to delete this expense?')) {
    try {
      await axios.delete(`${API_BASE_URL}/expenses/${id}`)
      expenses.value = expenses.value.filter(e => e.id !== id)
    } catch (error) {
      console.error('Error deleting expense:', error)
      // For demo, remove from local array
      expenses.value = expenses.value.filter(e => e.id !== id)
    }
  }
}

const filterExpenses = () => {
  // Filtering is handled by computed property
}

const closeModal = () => {
  showAddExpense.value = false
  editingExpense.value = null
  resetForm()
}

const resetForm = () => {
  expenseForm.value = {
    date: new Date().toISOString().slice(0, 10),
    category: '',
    description: '',
    vehicle: '',
    amount: '',
    paymentMethod: 'cash',
    notes: ''
  }
  selectedFile.value = null
  // Reset the file input
  const fileInput = document.querySelector('input[type="file"]')
  if (fileInput) {
    fileInput.value = ''
  }
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const viewAttachment = (expense) => {
  if (expense.receipt_filename) {
    // Open file from database BLOB via API endpoint
    const fileUrl = `${API_BASE_URL}/expenses/${expense.id}/receipt`
    window.open(fileUrl, '_blank')
  }
}

const getFileTypeIcon = (mimetype) => {
  if (mimetype?.includes('pdf')) return '📄'
  if (mimetype?.includes('image')) return '🖼️'
  return '📎'
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const getCategoryLabel = (category) => {
  const labels = {
    office_supplies: 'Office Supplies',
    parts: 'Parts',
    labor: 'Labor',
    bookkeeping: 'Bookkeeping',
    services: 'Services',
    parking_fee: 'Parking Fee',
    coordinator: 'Coordinator',
    rfid_service_charge: 'RFID Service Charge',
    others: 'Others'
  }
  return labels[category] || category
}

// Lifecycle
onMounted(() => {
  fetchExpenses()
  fetchVehicles()
})
</script>

<style scoped>
.expenses-view {
  padding: 1rem;
}

.expenses-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filter-controls {
  display: flex;
  gap: 1rem;
}

.filter-select, .filter-month {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.9rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.card-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.card-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.period {
  font-size: 0.8rem;
  color: #9ca3af;
}

.expenses-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.expenses-table {
  width: 100%;
  border-collapse: collapse;
}

.expenses-table th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.expenses-table td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.expense-row:hover {
  background: #f9fafb;
}

.category-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.category-office_supplies {
  background: #e0e7ff;
  color: #3730a3;
}

.category-parts {
  background: #dbeafe;
  color: #1e40af;
}

.category-labor {
  background: #fef3c7;
  color: #92400e;
}

.category-bookkeeping {
  background: #d1fae5;
  color: #065f46;
}

.category-services {
  background: #f3e8ff;
  color: #6b21a8;
}

.category-parking_fee {
  background: #fef2f2;
  color: #dc2626;
}

.category-coordinator {
  background: #ecfdf5;
  color: #047857;
}

.category-rfid_service_charge {
  background: #f0f9ff;
  color: #0369a1;
}

.category-others {
  background: #f3f4f6;
  color: #374151;
}

.amount-cell {
  font-weight: 600;
  color: #1f2937;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #dbeafe;
}

.btn-delete:hover {
  background: #fee2e2;
}

.attachment-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-attachment {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 1.2rem;
  transition: background 0.2s;
}

.btn-attachment:hover {
  background: #dbeafe;
}

.file-info {
  font-size: 0.8rem;
  color: #6b7280;
}

.no-attachment {
  color: #9ca3af;
  font-style: italic;
}

.empty-row {
  text-align: center;
}

.empty-message {
  padding: 3rem;
  color: #6b7280;
  font-style: italic;
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
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
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
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
}

.expense-form {
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
}

.form-input, .form-textarea {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.file-hint {
  color: #6b7280;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.file-name {
  font-size: 0.9rem;
  color: #374151;
  flex: 1;
}

.file-remove {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.file-remove:hover {
  background: #dc2626;
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
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.btn-secondary:hover {
  background: #5a6268;
}

/* Mobile Card Layout */
.expenses-mobile-cards {
  display: none;
}

.expense-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.card-date {
  font-weight: 600;
  color: #374151;
  font-size: 1rem;
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

.btn-edit-mobile, .btn-delete-mobile {
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

.btn-icon {
  font-size: 1rem;
}

.btn-text {
  font-size: 0.85rem;
}

.empty-mobile {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }

  .expenses-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-controls {
    flex-direction: column;
  }

  /* Hide table and show cards on mobile */
  .expenses-table-container {
    display: none;
  }

  .expenses-mobile-cards {
    display: block;
  }

  /* Make buttons more touch-friendly on mobile */
  .btn-edit-mobile, .btn-delete-mobile {
    padding: 0.875rem 1.25rem;
    font-size: 1rem;
    min-width: 100px;
  }

  .btn-icon {
    font-size: 1.2rem;
  }

  .btn-text {
    font-size: 0.9rem;
  }

  /* Improve card spacing on mobile */
  .expense-card {
    padding: 1.25rem;
  }

  .card-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .card-row strong {
    min-width: auto;
    margin-bottom: 0.25rem;
  }

  .card-row span {
    text-align: left;
  }
}
</style>
