<template>
  <div class="fuel-container">
    <div class="fuel-header">
      <h2>🚛 Fuel Management</h2>
      <div class="header-actions">
        <button @click="showAddModal = true" class="btn btn-primary">
          <v-icon>add</v-icon>
          Add Entry
        </button>
        <button @click="importData" class="btn btn-secondary">
          <v-icon>upload_file</v-icon>
          Import Data
        </button>
      </div>
    </div>

    <!-- Fuel Table - Excel-like -->
    <div class="fuel-table-wrapper">
      <table class="fuel-table" v-if="!loading && fuelData.length > 0">
        <thead>
          <tr>
            <th class="col-date">DATE</th>
            <th class="col-liters">LITERS</th>
            <th class="col-price">PRICE/LITER</th>
            <th class="col-amount">AMOUNT</th>
            <th class="col-plate">PLATE NUMBER</th>
            <th class="col-po">P.O. NUMBER</th>
            <th class="col-product">PRODUCT</th>
            <th class="col-station">GAS STATION</th>
            <th class="col-status">STATUS</th>
            <th class="col-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody
          @paste="handlePaste"
          @keydown.ctrl="handleKeyDown"
          contenteditable="true"
          class="editable-body"
        >
          <tr v-for="(entry, index) in fuelData" :key="entry.id">
            <td class="col-date">{{ formatDate(entry.date) }}</td>
            <td class="col-liters">{{ parseFloat(entry.liters).toFixed(2) }}</td>
            <td class="col-price">{{ formatCurrency(entry.pricePerLiter) }}</td>
            <td class="col-amount">{{ formatCurrency(entry.amount) }}</td>
            <td class="col-plate">{{ entry.plateNumber || '' }}</td>
            <td class="col-po">{{ entry.poNumber || '' }}</td>
            <td class="col-product">{{ entry.product || '' }}</td>
            <td class="col-station">{{ entry.gasStation || '' }}</td>
            <td class="col-status">
              <span :class="getStatusClass(entry.status)">
                {{ entry.status || 'completed' }}
              </span>
            </td>
            <td class="col-actions">
              <button @click="editEntry(entry)" title="Edit">✏️</button>
              <button @click="deleteEntry(entry.id)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-else-if="!loading" class="empty-state">
        <v-icon size="64" color="grey">local_gas_station</v-icon>
        <h3>No Fuel Records</h3>
        <p>Get started by adding an entry or importing data</p>
        <input
          type="file"
          ref="fileInput"
          accept=".xlsx,.xls,.csv"
          @change="handleFileImport"
          style="display: none;"
        />
        <div class="empty-actions">
          <button @click="showAddModal = true" class="btn btn-primary">
            Add First Entry
          </button>
          <button @click="$refs.fileInput.click()" class="btn btn-secondary">
            Import from Excel/CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingEntry" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingEntry ? 'Edit Fuel Entry' : 'Add Fuel Entry' }}</h3>
          <button @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="onFormSubmit" class="fuel-form">
            <div class="form-row">
              <div class="form-group">
                <label>DATE *</label>
                <input
                  type="date"
                  v-model="formData.date"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>LITERS *</label>
                <input
                  type="number"
                  v-model="formData.liters"
                  step="0.01"
                  min="0.01"
                  required
                  class="form-input"
                  @input="calculateAmount"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>PRICE/LITER *</label>
                <input
                  type="number"
                  v-model="formData.pricePerLiter"
                  step="0.01"
                  min="0.01"
                  required
                  class="form-input"
                  @input="calculateAmount"
                />
              </div>
              <div class="form-group">
                <label>AMOUNT *</label>
                <input
                  type="number"
                  v-model="formData.amount"
                  step="0.01"
                  min="0"
                  required
                  class="form-input"
                  readonly
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>PLATE NUMBER</label>
                <input
                  type="text"
                  v-model="formData.plateNumber"
                  class="form-input"
                  placeholder="e.g. ABC123"
                />
              </div>
              <div class="form-group">
                <label>P.O. NUMBER</label>
                <input
                  type="text"
                  v-model="formData.poNumber"
                  class="form-input"
                  placeholder="Purchase Order"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>PRODUCT</label>
                <select v-model="formData.product" class="form-input">
                  <option value="">Select Type</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Premium Gasoline">Premium Gasoline</option>
                  <option value="Regular Gasoline">Regular Gasoline</option>
                  <option value="LPG">LPG</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>STATUS</label>
                <select v-model="formData.status" class="form-input">
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div class="form-group full-width">
              <label>GAS STATION</label>
              <input
                type="text"
                v-model="formData.gasStation"
                class="form-input"
                placeholder="Gas Station Name"
              />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button @click="onCancelClick" class="btn btn-secondary">Cancel</button>
          <button @click="onSubmitClick" class="btn btn-primary" :disabled="!isFormValid">
            {{ editingEntry ? 'Update Entry' : 'Add Entry' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import Modal - Manual Column Mapping -->
    <div v-if="showImportConfig" class="modal-overlay" @click="closeImportModal">
      <div class="modal-content large-modal" @click.stop>
        <div class="modal-header">
          <h3>🚀 Import Fuel Data</h3>
          <button @click="closeImportModal">×</button>
        </div>
        <div class="modal-body">
          <!-- File Drop Area -->
          <div class="file-drop-area"
               @drop.prevent="handleFileDrop"
               @dragover.prevent
               @click="$refs.importFileInput.click()">
            <v-icon :size="48" :color="importFile ? 'green' : 'grey'">cloud_upload</v-icon>
            <p v-if="!importFile">Drop Excel/CSV file here or click to browse</p>
            <p v-else class="success-text">
              <v-icon>check_circle</v-icon>
              Selected: {{ importFile.name }}
            </p>
            <small>Supported formats: .xlsx, .xls, .csv</small>
          </div>

          <!-- File Input -->
          <input
            type="file"
            ref="importFileInput"
            accept=".xlsx,.xls,.csv"
            @change="handleFileSelect"
            style="display: none;"
          />

          <!-- Manual Mapping Section -->
          <div v-if="importFile" class="mapping-section">
            <h4>📋 Specify Data Range & Column Mapping</h4>

            <!-- Data Range Inputs -->
            <div class="range-inputs">
              <div class="form-group">
                <label>Start Row Number:</label>
                <input
                  type="number"
                  v-model="dataRange.startRow"
                  min="1"
                  class="form-input"
                  placeholder="e.g., 2 (skip header)"
                  @input="updatePreview"
                />
              </div>
              <div class="form-group">
                <label>End Row Number:</label>
                <input
                  type="number"
                  v-model="dataRange.endRow"
                  min="1"
                  class="form-input"
                  placeholder="e.g., 10"
                  @input="updatePreview"
                />
              </div>
            </div>

            <!-- Column Mapping Inputs -->
            <h5>Column Numbers (A=1, B=2, C=3, etc.):</h5>
            <div class="column-mapping-grid">
              <div v-for="(field, key) in fieldMapping" :key="key" class="mapping-input">
                <label>{{ field.label }}:</label>
                <input
                  type="number"
                  v-model="fieldMapping[key].column"
                  min="1"
                  max="26"
                  class="form-input"
                  placeholder="Column #"
                  @input="updatePreview"
                />
              </div>
            </div>

            <!-- Mapping Instructions -->
            <div class="instructions-box">
              <h6>📝 Instructions:</h6>
              <ol>
                <li>Column A=1, B=2, C=3, etc.</li>
                <li>Leave blank columns you don't have</li>
                <li>Start row should skip header row</li>
                <li>Dates can be in any format (will be parsed)</li>
                <li>System auto-calculates missing amounts</li>
              </ol>
            </div>
          </div>

          <!-- Preview Section - Card-based like BillingHistory -->
          <div v-if="importFile && previewData.length > 0" class="preview-section">
            <h4>📊 Data Preview - Mapped Data Cards</h4>
            <div class="preview-info">
              <p>
                <b>Range:</b> Rows {{ dataRange.startRow }} to {{ dataRange.endRow }}
                ({{ previewData.length }} entries)
              </p>
              <p v-if="previewErrors.length > 0" class="warning-text">
                ⚠️ {{ previewErrors.length }} row(s) may have issues
              </p>
              <p class="column-mapping-summary">
                <strong>✓ Mapped Columns:</strong>
                <span v-for="(field, key) in fieldMapping" :key="key" class="mapped-column-chip">
                  {{ field.label }}{{'column' in field && field.column > 0 ? `→ Col ${field.column}` : ''}}
                </span>
              </p>
            </div>

            <!-- Data Preview - Card Layout like BillingHistory -->
            <div class="fuel-preview-cards">
              <div
                v-for="(row, index) in previewData.slice(0, 10)"
                :key="index"
                class="fuel-preview-card"
                :class="{ 'has-errors': checkRowErrors(row, index) }"
              >
                <div class="preview-card-header">
                  <div class="preview-row-number">
                    Row {{ (dataRange.startRow - 1) + index + 1 }}
                  </div>
                  <div v-if="checkRowErrors(row, index)" class="preview-error-indicator">
                    ⚠️ Issues
                  </div>
                </div>

                <div class="preview-card-body">
                  <!-- Only show mapped fields -->
                  <div class="preview-field-grid">
                    <div
                      v-for="field in Object.values(fieldMapping).filter(f => f.column > 0)"
                      :key="field.key"
                      class="preview-field"
                    >
                      <label class="field-label">{{ field.label }}:</label>
                      <span class="field-value">{{ formatFieldValue(row[field.key], field.key) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="previewData.length > 10" class="more-rows-indicator">
                📋 Showing first 10 rows ({{ previewData.length }} total entries) - Import to see all data
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeImportModal" class="btn btn-secondary">Cancel</button>
          <button @click="downloadSampleFile" class="btn btn-secondary">
            📥 Sample File
          </button>
          <button @click="importDataRange" :disabled="!canImport" class="btn btn-primary">
            🚀 Import {{ previewData.length }} Entries
          </button>
        </div>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loading" class="loading">
      <v-icon class="spin">hourglass_empty</v-icon>
      <p>Loading...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'

// Reactive data
const fuelData = ref([])
const loading = ref(false)
const showAddModal = ref(false)
const editingEntry = ref(null)
const showImportConfig = ref(false)
const fileInput = ref(null)

// Form data
const formData = ref({
  date: new Date().toISOString().split('T')[0],
  liters: '',
  pricePerLiter: '',
  amount: '',
  plateNumber: '',
  poNumber: '',
  product: 'Diesel',
  gasStation: '',
  status: 'completed'
})

// Import related
const importStep = ref(1)
const importFile = ref(null)
const rawSheetData = ref([]) // Store the raw sheet data for manual extraction
const dataRange = ref({
  startRow: 2, // Default to skip header
  endRow: 10
})

// Manual column mapping fields - match CSV headers exactly
const fieldMapping = ref({
  date: { label: 'DATE', key: 'date', column: '', required: true },
  liters: { label: 'LITERS', key: 'liters', column: '', required: true },
  pricePerLiter: { label: 'PRICE/LITERS', key: 'pricePerLiter', column: '', required: true },
  amount: { label: 'AMOUNT', key: 'amount', column: '', required: false },
  plateNumber: { label: 'PLATE NO.', key: 'plateNumber', column: '', required: false },
  poNumber: { label: 'PO NUMBER', key: 'poNumber', column: '', required: false },
  product: { label: 'PRODUCT', key: 'product', column: '', required: false },
  gasStation: { label: 'GAS STATION', key: 'gasStation', column: '', required: false }
})

// Preview data for manual mapping
const previewData = ref([])
const previewErrors = ref([])

// Computed properties
const totalFuel = computed(() => {
  return fuelData.value.reduce((sum, entry) => sum + parseFloat(entry.amount), 0)
})

const totalLiters = computed(() => {
  return fuelData.value.reduce((sum, entry) => sum + parseFloat(entry.liters), 0)
})

const isFormValid = computed(() => {
  return formData.value.date &&
         formData.value.liters > 0 &&
         formData.value.pricePerLiter > 0
})

const canImport = computed(() => {
  return importFile.value &&
         dataRange.value.startRow > 0 &&
         dataRange.value.endRow >= dataRange.value.startRow &&
         fieldMapping.value.date.column > 0 &&
         fieldMapping.value.liters.column > 0 &&
         fieldMapping.value.pricePerLiter.column > 0
})

// Debug handlers
const onFormSubmit = (event) => {

  if (!isFormValid.value) {
    event.preventDefault()
    alert('Please fill all required fields correctly.')
    return false
  }

  saveEntry()
}

const onCancelClick = () => {
  closeModal()
}

const onSubmitClick = () => {

  if (!isFormValid.value) {
    alert('Please fill all required fields: Date, Liters, and Price/Liter.')
    return
  }

  saveEntry()
}

// Methods
const fetchFuelData = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/fuel')

    // API returns { fuel: [...], pagination: {...} }
    fuelData.value = response.data.fuel || []

    // Check if data has expected structure
    if (fuelData.value.length > 0) {
      // Data validation passed
    }


  } catch (error) {
    console.error('❌ Error fetching fuel data:', error)
    console.error('❌ Error response:', error.response?.data || error.message)
    console.error('❌ Error status:', error.response?.status)
    console.error('❌ Error headers:', error.response?.headers)
  } finally {
    loading.value = false
  }
}

const saveEntry = async () => {

  try {
    const requestData = {
      date: formData.value.date,
      liters: parseFloat(formData.value.liters),
      pricePerLiter: parseFloat(formData.value.pricePerLiter),
      amount: parseFloat(formData.value.amount),
      plateNumber: formData.value.plateNumber || null,
      poNumber: formData.value.poNumber || null,
      product: formData.value.product || 'Diesel',
      gasStation: formData.value.gasStation || null,
      status: formData.value.status || 'completed'
    }


    if (editingEntry.value) {
      await axios.put(`/api/fuel/${editingEntry.value.id}`, requestData)
    } else {
      const response = await axios.post('/api/fuel', requestData)
    }

    await fetchFuelData()

    closeModal()

  } catch (error) {
    console.error('❌ Error saving entry:', error)
    console.error('❌ Error details:', error.response?.data || error.message)
    alert(`Error saving entry: ${error.response?.data?.error || error.message}`)
  }
}

const editEntry = (entry) => {
  editingEntry.value = entry
  formData.value = {
    date: entry.date,
    liters: parseFloat(entry.liters).toFixed(2),
    pricePerLiter: parseFloat(entry.pricePerLiter).toFixed(2),
    amount: parseFloat(entry.amount).toFixed(2),
    plateNumber: entry.plateNumber || '',
    poNumber: entry.poNumber || '',
    product: entry.product || 'Diesel',
    gasStation: entry.gasStation || '',
    status: entry.status || 'completed'
  }
  showAddModal.value = true
}

const deleteEntry = async (id) => {
  if (confirm('Delete this entry?')) {
    try {
      await axios.delete(`/api/fuel/${id}`)
      fetchFuelData()
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingEntry.value = null
  resetForm()
}

const resetForm = () => {
  formData.value = {
    date: new Date().toISOString().split('T')[0],
    liters: '',
    pricePerLiter: '',
    amount: '',
    plateNumber: '',
    poNumber: '',
    product: 'Diesel',
    gasStation: '',
    status: 'completed'
  }
}

const calculateAmount = () => {
  const liters = parseFloat(formData.value.liters) || 0
  const price = parseFloat(formData.value.pricePerLiter) || 0
  formData.value.amount = (liters * price).toFixed(2)
}

// Paste functionality
const handlePaste = async (event) => {
  event.preventDefault()
  const text = event.clipboardData.getData('text')

  try {
    const rows = parseExcelData(text)
    if (rows.length === 0) {
      alert('No valid data found in paste.')
      return
    }

    if (confirm(`Import ${rows.length} rows from paste?`)) {
      for (const row of rows) {
        await axios.post('/api/fuel', row)
      }
      fetchFuelData()
    }
  } catch (error) {
    console.error('Paste error:', error)
  }
}

const handleKeyDown = (event) => {
  // Handle Ctrl+V
  if (event.ctrlKey && event.key === 'v') {
    // Already handled by paste event
  }
}

const parseExcelData = (text) => {
  const lines = text.split('\n').filter(line => line.trim())
  const entries = []

  for (let i = 1; i < lines.length; i++) { // Skip header
    const columns = lines[i].split('\t')
    if (columns.length >= 3) {
      const entry = {
        date: columns[0]?.trim(),
        liters: parseFloat(columns[1]?.trim()) || 0,
        pricePerLiter: parseFloat(columns[2]?.trim()) || 0,
        amount: columns[3] ? parseFloat(columns[3].replace(/[₱$,]/g, '')) : 0,
        plateNumber: columns[4]?.trim() || null,
        poNumber: columns[5]?.trim() || null,
        product: columns[6]?.trim() || null,
        gasStation: columns[7]?.trim() || null,
        status: 'completed'
      }

      if (entry.amount === 0) {
        entry.amount = entry.liters * entry.pricePerLiter
      }

      if (entry.liters > 0 && entry.pricePerLiter > 0) {
        entries.push(entry)
      }
    }
  }

  return entries
}

// Import functionality
const importData = () => {
  showImportConfig.value = true
}

const closeImportModal = () => {
  showImportConfig.value = false
  importStep.value = 1
  importFile.value = null
  resetImportMapping()
}

const resetImportMapping = () => {
  fieldMapping.value = {
    date: { label: 'Date', key: 'date', column: '' },
    liters: { label: 'Liters', key: 'liters', column: '' },
    pricePerLiter: { label: 'Price/Liter', key: 'pricePerLiter', column: '' },
    amount: { label: 'Amount', key: 'amount', column: '' },
    plateNumber: { label: 'Plate Number', key: 'plateNumber', column: '' },
    poNumber: { label: 'P.O. Number', key: 'poNumber', column: '' },
    product: { label: 'Product', key: 'product', column: '' },
    gasStation: { label: 'Gas Station', key: 'gasStation', column: '' }
  }
  previewData.value = []
}

const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (file) {
    processImportFile(file)
  }
}

const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file) {
    processImportFile(file)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    importFile.value = file
    extractColumnsAndPreview(file)
  }
}

const processImportFile = (file) => {
  importFile.value = file
  extractColumnsAndPreview(file)
}

const extractColumnsAndPreview = async (file) => {
  try {
    const data = await readFileData(file)

    // Store raw sheet data for manual mapping
    rawSheetData.value = data.rawSheet || []

    // Set default preview (first few rows)
    updatePreview()


  } catch (error) {
    console.error('Error reading file:', error)
    alert('Error reading file. Please check the format.')
  }
}

const readFileData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        let rawSheet // 2D array of raw sheet data

        if (file.name.endsWith('.csv')) {
          rawSheet = parseCSV(e.target.result)
        } else {
          const workbook = XLSX.read(e.target.result, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          rawSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        }

        const columns = rawSheet[0] || [] // First row is headers
        const rows = rawSheet.slice(1) // Skip header for processed rows

        resolve({
          rawSheet, // 2D array for manual column mapping
          columns,
          rows: rows.map(row => {
            const obj = {}
            columns.forEach((col, index) => {
              obj[col] = row[index]
            })
            return obj
          })
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = reject

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsBinaryString(file)
    }
  })
}

const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line && line.trim())
  const result = []

  for (const line of lines) {
    // Handle different delimiters and quoted fields
    const fields = []
    let currentField = ''
    let inQuotes = false
    let quoteChar = null

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (!inQuotes && (char === '"' || char === "'")) {
        // Start of quoted field
        inQuotes = true
        quoteChar = char
      } else if (inQuotes && char === quoteChar && nextChar === char) {
        // Escaped quote
        currentField += char
        i++ // Skip next quote
      } else if (inQuotes && char === quoteChar && nextChar !== char) {
        // End of quoted field
        inQuotes = false
        quoteChar = null
      } else if (!inQuotes && (char === ',' || char === '\t' || char === '|')) {
        // Field separator
        fields.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }

    // Add last field
    fields.push(currentField.trim())

    // Clean up extra quotes that might remain
    const cleanedFields = fields.map(field => {
      if ((field.startsWith('"') && field.endsWith('"')) ||
          (field.startsWith("'") && field.endsWith("'"))) {
        return field.slice(1, -1)
      }
      return field
    })

    result.push(cleanedFields)
  }

  return result
}

const autoMapColumns = (columns) => {
  const mappingRules = {
    date: ['date', 'date_col', 'transaction_date', 'fuel_date'],
    liters: ['liters', 'quantity', 'l', 'liter', 'volume'],
    pricePerLiter: ['price/liter', 'price_per_liter', 'unit_price', 'price'],
    amount: ['amount', 'total', 'cost', 'total_cost'],
    plateNumber: ['plate', 'plate_number', 'vehicle', 'vehicle_plate', 'truck'],
    poNumber: ['po', 'po_number', 'purchase_order', 'P.O.'],
    product: ['product', 'fuel_type', 'fuel'],
    gasStation: ['station', 'gas_station', 'location', 'gas']
  }

  columns.forEach(col => {
    const lowerCol = col.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const [field, keywords] of Object.entries(mappingRules)) {
      if (keywords.some(keyword => lowerCol.includes(keyword.replace(/[^a-z0-9]/g, '')))) {
        fieldMapping.value[field].column = col
        break
      }
    }
  })
}

const downloadSampleFile = () => {
  // Create sample Excel data
  const sampleData = [
    ['Date', 'Liters', 'Price/Liter', 'Amount', 'Plate Number', 'P.O. Number', 'Product', 'Gas Station'],
    ['2025-01-15', 50, 65.00, 3250.00, 'NGU 9174', 'PO-2025-001', 'Diesel', 'Petron Station'],
    ['2025-01-16', 45.5, 66.50, 3027.50, 'ABDJ 305', 'PO-2025-002', 'Diesel', 'Shell Station'],
    ['2025-01-17', 72.3, 64.80, 4682.64, 'NGU 9174', '', 'Diesel', 'Caltex Station']
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sampleData)
  XLSX.utils.book_append_sheet(wb, ws, 'Fuel Data Sample')

  // Auto-size columns
  const colWidths = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }]
  ws['!cols'] = colWidths

  // Format as currency
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let row = 1; row <= range.e.r; row++) {
    if (ws[XLSX.utils.encode_cell({ r: row, c: 3 })]?.t === 'n') {
      // Format Amount column as currency (D column = 3)
      ws[XLSX.utils.encode_cell({ r: row, c: 3 })].t = 'n'
      ws[XLSX.utils.encode_cell({ r: row, c: 3 })].z = '#,##0.00'
    }
  }

  XLSX.writeFile(wb, 'fuel_data_sample.xlsx')
}

const updatePreview = () => {
  if (!rawSheetData.value.length || !dataRange.value.startRow || !dataRange.value.endRow) {
    previewData.value = []
    previewErrors.value = []
    return
  }


  try {
    const startRow = dataRange.value.startRow - 1 // Convert to 0-based index
    const endRow = dataRange.value.endRow - 1 // Convert to 0-based index

    // Extract data from the selected rows
    const selectedRows = rawSheetData.value.slice(startRow, endRow + 1)

    const mappedData = []
    const errors = []


      // FIRST, validate ALL column mappings are valid for this CSV
      const csvColumnCount = rawSheetData.value[0]?.length || 0
      const invalidMappings = []
      for (const [fieldKey, fieldConfig] of Object.entries(fieldMapping.value)) {
        const colNum = fieldConfig.column
        if (colNum && colNum > 0) {
          if (colNum > csvColumnCount) {
            invalidMappings.push(`${fieldKey}: Column ${colNum} doesn't exist (CSV only has ${csvColumnCount} columns)`)
          }
        }
      }

      if (invalidMappings.length > 0) {
        console.error('❌ COLUMN MAPPING ERRORS:', invalidMappings)
        errors.push(`Invalid column mappings: ${invalidMappings.join(', ')}`)
        // Skip this CSV processing batch - return early
        return
      }

      for (let i = 0; i < selectedRows.length; i++) {
        const rowIndex = startRow + i + 1 // For display (1-based)
        const row = selectedRows[i]


        // DIRECT COLUMN MAPPING - CRITICAL: FuelField = Excel[ColumnNumber - 1]
        const mappedEntry = {}
        let hasError = false

        // CRITICAL: Each field gets data from EXACTLY its specified column
        const fieldMappingsApplied = []

        // DATE field mapping
        if (fieldMapping.value.date.column && fieldMapping.value.date.column > 0) {
          const excelColIdx = fieldMapping.value.date.column - 1
          const value = row[excelColIdx]
          mappedEntry.date = value || ''
          fieldMappingsApplied.push(`DATE (ExcelCol${fieldMapping.value.date.column}=Row[${excelColIdx}]):"${value}"`)
        } else {
        }

        // LITERS field mapping
        if (fieldMapping.value.liters.column && fieldMapping.value.liters.column > 0) {
          const excelColIdx = fieldMapping.value.liters.column - 1
          const rawValue = row[excelColIdx]
          const numValue = parseFloat(rawValue)
          mappedEntry.liters = isNaN(numValue) ? 0 : numValue
          fieldMappingsApplied.push(`LITERS (ExcelCol${fieldMapping.value.liters.column}=Row[${excelColIdx}]):"${rawValue}"→${mappedEntry.liters}`)
        } else {
        }

        // PRICE/PER LITER field mapping
        if (fieldMapping.value.pricePerLiter.column && fieldMapping.value.pricePerLiter.column > 0) {
          const excelColIdx = fieldMapping.value.pricePerLiter.column - 1
          const rawValue = row[excelColIdx]
          const numValue = parseFloat(rawValue)
          mappedEntry.pricePerLiter = isNaN(numValue) ? 0 : numValue
          fieldMappingsApplied.push(`PRICE/LITER (ExcelCol${fieldMapping.value.pricePerLiter.column}=Row[${excelColIdx}]):"${rawValue}"→${mappedEntry.pricePerLiter}`)
        } else {
        }

        // AMOUNT: If mapped, use specified column; if not, auto-calculate
        if (fieldMapping.value.amount.column && fieldMapping.value.amount.column > 0) {
          const excelColIdx = fieldMapping.value.amount.column - 1
          const rawValue = row[excelColIdx]
          const numValue = parseFloat(rawValue)
          mappedEntry.amount = isNaN(numValue) ? 0 : numValue
          fieldMappingsApplied.push(`AMOUNT (ExcelCol${fieldMapping.value.amount.column}=Row[${excelColIdx}]):"${rawValue}"→${mappedEntry.amount}`)
        } else {
          // Auto-calculate amount if not explicitly mapped
          mappedEntry.amount = (parseFloat(mappedEntry.liters) || 0) * (parseFloat(mappedEntry.pricePerLiter) || 0)
          fieldMappingsApplied.push(`AMOUNT: Auto-calculated = ${mappedEntry.liters} × ${mappedEntry.pricePerLiter} = ${mappedEntry.amount}`)
        }

        if (fieldMapping.value.plateNumber.column && fieldMapping.value.plateNumber.column > 0) {
          const excelColIdx = fieldMapping.value.plateNumber.column - 1
          const value = row[excelColIdx]
          mappedEntry.plateNumber = value || null
          fieldMappingsApplied.push(`PLATE NUMBER (ExcelCol${fieldMapping.value.plateNumber.column}=Row[${excelColIdx}]):"${value}"`)
        } else {
        }

        if (fieldMapping.value.poNumber.column && fieldMapping.value.poNumber.column > 0) {
          const excelColIdx = fieldMapping.value.poNumber.column - 1
          const value = row[excelColIdx]
          mappedEntry.poNumber = value || null
          fieldMappingsApplied.push(`P.O. NUMBER (ExcelCol${fieldMapping.value.poNumber.column}=Row[${excelColIdx}]):"${value}"`)
        } else {
        }

        if (fieldMapping.value.product.column && fieldMapping.value.product.column > 0) {
          const excelColIdx = fieldMapping.value.product.column - 1
          const value = row[excelColIdx]
          mappedEntry.product = value || null
          fieldMappingsApplied.push(`PRODUCT (ExcelCol${fieldMapping.value.product.column}=Row[${excelColIdx}]):"${value}"`)
        } else {
        }

        if (fieldMapping.value.gasStation.column && fieldMapping.value.gasStation.column > 0) {
          const excelColIdx = fieldMapping.value.gasStation.column - 1
          const value = row[excelColIdx]
          mappedEntry.gasStation = value || null
          fieldMappingsApplied.push(`GAS STATION (ExcelCol${fieldMapping.value.gasStation.column}=Row[${excelColIdx}]):"${value}"`)
        } else {
        }


      // Validate required fields
      if (fieldMapping.value.date.column > 0 && !mappedEntry.date) {
        hasError = true
        errors.push(`Row ${rowIndex}: Missing date`)
      }
      if (fieldMapping.value.liters.column > 0 && (!mappedEntry.liters || mappedEntry.liters <= 0)) {
        hasError = true
        errors.push(`Row ${rowIndex}: Invalid or missing liters`)
      }
      if (fieldMapping.value.pricePerLiter.column > 0 && (!mappedEntry.pricePerLiter || mappedEntry.pricePerLiter <= 0)) {
        hasError = true
        errors.push(`Row ${rowIndex}: Invalid or missing price/liter`)
      }

      // Add row number for display
      mappedEntry.rowNumber = rowIndex

      if (!hasError) {
        mappedData.push(mappedEntry)
      }
    }

    previewData.value = mappedData.slice(0, 100) // Show all data for verification
    previewErrors.value = errors.slice(0, 10) // Limit error display

  } catch (error) {
    console.error('❌ Error updating preview:', error)
    previewData.value = []
    previewErrors.value = [`Error processing data: ${error.message}`]
  }
}

const importDataRange = async () => {
  if (!canImport.value) {
    alert('Please complete the mapping configuration.')
    return
  }

  try {

    if (confirm(`Import ${previewData.value.length} fuel entries using fast bulk import?`)) {
      loading.value = true

      // Prepare entries for bulk import (remove rowNumber, keep raw data)
      const entries = previewData.value.map(entry => {
        const { rowNumber, ...apiEntry } = entry

        // Format entry for API but keep original data - let server handle parsing
        return {
          date: apiEntry.date,
          liters: apiEntry.liters,
          pricePerLiter: apiEntry.pricePerLiter,
          amount: apiEntry.amount,
          plateNumber: apiEntry.plateNumber || null,
          poNumber: apiEntry.poNumber || null,
          product: apiEntry.product || null,
          gasStation: apiEntry.gasStation || null,
          // Remove rowNumber, add basic fields
          notes: null
        }
      })


      try {
        // Use BULK IMPORT endpoint for fast multi-entry import
        const response = await axios.post('/api/fuel/bulk', {
          entries: entries
        })


        const { message, inserted, failed, errors, insertedIds } = response.data

        // Show detailed results
        if (failed === 0) {
          alert(`🎉 ${message}\n\n${inserted} entries imported successfully!`)
        } else if (inserted > 0) {
          alert(`⚠️ ${message}\n\n✅ ${inserted} imported\n❌ ${failed} failed\n\n${errors.slice(0, 3).map(e => e.error).join('\n')}`)
        } else {
          alert(`❌ Import failed:\n\n${errors.map(e => e.error).join('\n')}`)
        }

        if (inserted > 0) {
          fetchFuelData()
        }

      } catch (bulkError) {
        console.error('❌ Bulk import failed:', bulkError)

        // Fallback: Try individual imports if bulk fails (for compatibility)
        alert('Bulk import failed. Falling back to individual imports...')

        let imported = 0
        let errors = []

        // Process one by one as fallback
        for (const entry of entries) {
          try {
            await axios.post('/api/fuel', entry)
            imported++
          } catch (individualError) {

            console.error('Individual import error:', individualError)
            errors.push(`Entry ${imported + errors.length + 1}: ${individualError.response?.data?.error || individualError.message}`)
          }
        }

        const total = entries.length
        if (imported === total) {
          alert(`✅ Fallback: Successfully imported all ${total} entries!`)
        } else if (imported > 0) {
          alert(`⚠️ Fallback: Imported ${imported}/${total} entries. ${errors.length} failed.`)
        } else {
          alert(`❌ Fallback also failed: No entries imported.`)
        }

        fetchFuelData()
      }

      closeImportModal()
    }

  } catch (error) {
    console.error('❌ Import error:', error)
    alert(`Import failed: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const processImport = async () => {
  try {
    if (!validateMapping()) {
      return
    }

    const data = await readFileData(importFile.value)
    const mappedData = mapImportData(data.rows)

    if (confirm(`Import ${mappedData.length} fuel entries?`)) {
      loading.value = true
      let imported = 0

      for (const entry of mappedData) {
        try {
          await axios.post('/api/fuel', entry)
          imported++
        } catch (error) {
          console.error('Import error for entry:', entry, error)
        }
      }

      alert(`Successfully imported ${imported}/${mappedData.length} entries.`)
      fetchFuelData()
      closeImportModal()
    }
  } catch (error) {
    console.error('Import error:', error)
    alert('Error during import. Check console for details.')
  } finally {
    loading.value = false
  }
}

const validateMapping = () => {
  const required = ['date', 'liters', 'pricePerLiter']
  const missing = required.filter(field => !fieldMapping.value[field].column)

  if (missing.length > 0) {
    alert(`Please map required fields: ${missing.join(', ')}`)
    return false
  }
  return true
}

const mapImportData = (rows) => {
  return rows.map(row => {
    const entry = {
      date: row[fieldMapping.value.date.column] || '',
      liters: parseFloat(row[fieldMapping.value.liters.column]) || 0,
      pricePerLiter: parseFloat(row[fieldMapping.value.pricePerLiter.column]) || 0,
      amount: fieldMapping.value.amount.column ?
              (parseFloat(row[fieldMapping.value.amount.column]) || 0) :
              ((parseFloat(row[fieldMapping.value.liters.column]) || 0) * (parseFloat(row[fieldMapping.value.pricePerLiter.column]) || 0)),
      plateNumber: row[fieldMapping.value.plateNumber.column] || null,
      poNumber: row[fieldMapping.value.poNumber.column] || null,
      product: row[fieldMapping.value.product.column] || null,
      gasStation: row[fieldMapping.value.gasStation.column] || null,
      status: 'completed'
    }

    // Ensure date is in ISO format if possible
    if (entry.date) {
      const dateObj = new Date(entry.date)
      if (!isNaN(dateObj.getTime())) {
        entry.date = dateObj.toISOString().split('T')[0]
      }
    }

    return entry
  }).filter(entry => entry.liters > 0 && entry.pricePerLiter > 0)
}

const checkRowErrors = (row, index) => {
  // Check if this row has validation errors
  if (previewErrors.value.length === 0) return false

  const rowIndex = (dataRange.value.startRow - 1) + index + 1
  return previewErrors.value.some(error => error.includes(`Row ${rowIndex}`))
}

const formatFieldValue = (value, fieldKey) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  // Format numbers appropriately
  if (fieldKey === 'liters' || fieldKey === 'pricePerLiter' || fieldKey === 'amount') {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      if (fieldKey === 'amount') {
        return `₱${num.toFixed(2)}`
      }
      return num.toFixed(2)
    }
  }

  // Format dates if possible
  if (fieldKey === 'date') {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }
    } catch (e) {
      // Keep as string if not a valid date
    }
  }

  return value.toString()
}

// Utility functions
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0)
}

const getStatusClass = (status) => {
  const classes = {
    completed: 'status-completed',
    pending: 'status-pending',
    cancelled: 'status-cancelled'
  }
  return classes[status] || 'status-completed'
}

// Lifecycle
onMounted(() => {
  fetchFuelData()
})
</script>

<style scoped>
.fuel-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.fuel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.fuel-header h2 {
  margin: 0;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #374151;
  transform: translateY(-1px);
}

.fuel-table-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 2rem;
}

.fuel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.fuel-table th,
.fuel-table td {
  padding: 1rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.fuel-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
  z-index: 10;
}

.fuel-table tbody tr:hover {
  background: #f9fafb;
}

.col-date { width: 120px; }
.col-liters { width: 100px; text-align: right; }
.col-price { width: 120px; text-align: right; }
.col-amount { width: 120px; text-align: right; color: #059669; font-weight: 600; }
.col-actions { width: 120px; text-align: center; }

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.empty-state h3 {
  margin: 1rem 0 0.5rem 0;
  color: #374151;
}

.empty-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.large-modal {
  max-width: 800px;
}

.modal-header {
  padding: 1.5rem 2rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
}

.modal-header button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 2rem;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 2rem;
  background: #fafbfc;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.fuel-form {
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

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.form-input {
  padding: 0.75rem;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #4f46e5;
}

.editable-body {
  outline: none;
}

.editable-body[contenteditable]:focus {
  box-shadow: inset 0 0 0 2px #4f46e5;
}

.status-completed {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending {
  background: #fef3c7;
  color: #9a6c00;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-cancelled {
  background: #fee2e2;
  color: #dc2626;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.col-actions button {
  margin: 0 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.col-actions button:hover {
  background: #e5e7eb;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.loading .spin {
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.file-drop-area {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.file-drop-area:hover {
  border-color: #4f46e5;
}

.success-text {
  color: #059669;
  font-weight: 600;
  margin-top: 0.5rem;
}

.import-instructions {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.import-instructions h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.import-instructions ol {
  margin: 0;
  padding-left: 1.5rem;
}

.import-instructions li {
  margin-bottom: 0.5rem;
  color: #6b7280;
  line-height: 1.5;
}

/* Mapping section styles */
.mapping-section h4 {
  margin: 0 0 1.5rem 0;
  color: #374151;
  font-size: 1.1rem;
}

.range-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.column-mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.mapping-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mapping-input label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}

.instructions-box {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.instructions-box h6 {
  margin: 0 0 0.5rem 0;
  color: #0c4a6e;
  font-size: 0.9rem;
}

.instructions-box ol {
  margin: 0;
  padding-left: 1.25rem;
}

.instructions-box li {
  margin-bottom: 0.25rem;
  color: #374151;
  font-size: 0.85rem;
  line-height: 1.4;
}

/* Import preview styles */
.import-preview {
  margin-top: 1.5rem;
}

.preview-info {
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.warning-text {
  color: #dc2626;
  font-weight: 600;
}

.column-mapping-summary {
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.mapped-column-chip {
  display: inline-block;
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.fuel-preview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  max-height: 600px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.fuel-preview-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}

.fuel-preview-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.fuel-preview-card.has-errors {
  border-color: #dc2626;
  background: #fef2f2;
}

.preview-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.preview-row-number {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.preview-error-indicator {
  color: #dc2626;
  font-weight: 600;
  font-size: 0.8rem;
}

.preview-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.preview-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 0.85rem;
}

.field-label {
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.field-value {
  color: #374151;
  text-align: right;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-rows-indicator {
  grid-column: 1 / -1;
  text-align: center;
  padding: 1rem;
  color: #6b7280;
  font-style: italic;
  font-size: 0.9rem;
}

.preview-table-container {
  max-height: 500px;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.preview-table {
  width: 100%;
  min-width: 1000px; /* Increased to accommodate more data */
  border-collapse: collapse;
  font-size: 0.85rem; /* Slightly larger for readability */
}

.preview-table th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  z-index: 10;
  border: 1px solid #e5e7eb;
  padding: 0.75rem 1rem;
  white-space: nowrap;
}

.preview-table td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
}

.row-col {
  min-width: 80px;
  background: #f8fafc;
  font-weight: 600;
  text-align: center;
  position: sticky;
  left: 0;
  background: #f9fafb;
}

.data-col {
  min-width: 150px; /* Wider for data readability */
  max-width: 250px; /* Allow more content */
}

/* Scoped to preview cards only to prevent affecting main table */
.fuel-preview-cards .cell-value,
.fuel-preview-cards .cell-value-wrapper {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 0.85rem !important;
  line-height: 1.4 !important;
  word-break: break-word !important;
  white-space: normal !important;
  overflow: visible !important;
  text-orientation: mixed !important;
  writing-mode: horizontal-tb !important;
  transform: none !important;
  display: block !important;
  text-align: left !important;
  color: inherit !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  min-height: 1.4em !important;
}

.summary-row {
  background: #f0f9ff;
  font-weight: 600;
  text-align: center;
}

.more-rows {
  color: #0c4a6e;
  font-weight: 600;
}

.mapping-summary p {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: #374151;
}

.mapping-summary ul {
  margin: 0;
  padding-left: 1.5rem;
}

.mapping-summary li {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.field-name {
  font-weight: 600;
  color: #374151;
  margin-right: 0.5rem;
}

.mapped-column {
  color: #059669;
  font-weight: 600;
}

.not-detected {
  color: #dc2626;
  font-weight: 600;
}

.mapping-hint {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #92400e;
}

.preview-section {
  max-height: 300px;
  overflow-y: auto;
}

.preview-section h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.preview-table th,
.preview-table td {
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.preview-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.preview-table tr:nth-child(even) {
  background: #f8fafc;
}

/* Responsive design */
@media (max-width: 768px) {
  .fuel-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .fuel-table-wrapper {
    overflow-x: auto;
  }

  .fuel-table {
    min-width: 1200px; /* Increased to fit all 10 columns (120px each) */
    font-size: 0.8rem;
  }

  /* Force no text wrapping in table cells */
  .fuel-table td {
    white-space: nowrap !important; /* Prevent text wrapping */
    overflow: hidden; /* Hide overflow */
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal-content {
    margin: 1rem;
    width: calc(100% - 2rem);
  }
}
</style>
