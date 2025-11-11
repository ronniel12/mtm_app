<template>
  <div class="billing-statement">
    <!-- Filters Section -->
    <div class="filters-section">
      <div class="date-filters">
        <div class="filter-group">
          <label for="start-date">Start Date:</label>
          <input type="date" id="start-date" v-model="startDate" class="date-input" @input="filterTripsByDate" />
        </div>
        <div class="filter-group">
          <label for="end-date">End Date:</label>
          <input type="date" id="end-date" v-model="endDate" class="date-input" @input="filterTripsByDate" />
        </div>
      </div>

      <!-- Signature Section -->
      <div class="signature-section">
        <div class="signature-group">
          <label for="prepared-by">Prepared by:</label>
          <input type="text" id="prepared-by" v-model="preparedBy" class="signature-input" placeholder="Enter name" />
        </div>
      </div>
    </div>

    <!-- Company Header - Centered -->
    <div class="company-header">
      <div class="company-info-centered">
        <div class="logo-container">
          <img src="/mtmlogo.jpeg" alt="MTM Enterprise Logo" class="company-logo-large" />
        </div>
        <h1 class="company-name-small">MTM ENTERPRISE</h1>
        <div class="company-details-small">
          <p>0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan</p>
          <p>TIN # 175-434-337-000</p>
          <p>Mobile No. 09605638462 / Telegram No. +358-044-978-8592</p>
        </div>
        <h2 class="billing-statement-title">BILLING STATEMENT</h2>
      </div>
    </div>

    <!-- Billed To Section - Left-aligned with table -->
    <div class="billed-to-left">
      <div class="billed-to-label-small">
        <strong>BILLED TO:</strong>
      </div>
      <div class="billed-to-info-small">
        <p class="client-name-small">Premium Feeds Corp.</p>
        <p>798 Maharlika Highway, Dampol 2nd A</p>
        <p>Pulilan Bulacan, 3005</p>
        <p>TIN #007-932-128-000</p>
        <p>Business Style: 007-932-128-000</p>
      </div>
    </div>

    <!-- Period and Billing Number Combined Section -->
    <div class="period-billing-section">
      <div class="left-side">
        <div class="billing-number-info">
          <strong>Billing Number:</strong> {{ billingNumber }}
        </div>
        <div class="period-info">
          <strong>Period Covered:</strong> {{ formatPeriod() }}
        </div>
      </div>
      <div class="right-side">
        <div class="generated-info">
          <strong>Date Generated:</strong> {{ formatDate(new Date()) }}
        </div>
      </div>
    </div>

    <!-- Billing Table -->
    <div class="billing-table-container">
      <table class="billing-table">
        <thead>
          <tr class="header-row">
            <th class="date-col">DATE</th>
            <th class="plate-col">PLATE NUMBER</th>
            <th class="invoice-col">INVOICE NUMBER</th>
            <th class="destination-col">DESTINATION</th>
            <th class="bags-col">NUMBER OF BAGS</th>
            <th class="rate-col">RATE PER BAG</th>
            <th class="total-col">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <!-- Data rows -->
          <tr v-for="(trip, index) in filteredTrips" :key="trip.id" class="data-row" :class="{ 'alt-row': index % 2 === 1 }">
            <td class="date-cell">{{ formatDateShort(trip.date) }}</td>
            <td class="plate-cell">{{ trip.truckPlate }}</td>
            <td class="invoice-cell">{{ trip.invoiceNumber }}</td>
            <td class="destination-cell">{{ trip.fullDestination }}</td>
            <td class="bags-cell text-center">{{ trip.numberOfBags }}</td>
            <td class="rate-cell text-right">{{ trip._rate ? formatCurrency(trip._rate) : '0.00' }}</td>
            <td class="total-cell text-right">{{ trip._total ? formatCurrency(trip._total) : '0.00' }}</td>
          </tr>

          <!-- Spacer row -->
          <tr class="spacer-row">
            <td colspan="7"></td>
          </tr>

          <!-- Totals row -->
          <tr class="totals-row">
            <td class="text-left fw-bold totals-label">GRAND TOTAL:</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="text-center fw-bold totals-bags">{{ totalBags }}</td>
            <td></td>
            <td class="text-right fw-bold totals-amount">₱{{ formatCurrency(totalRevenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Prepared by Section -->
    <div class="prepared-by-section">
      <div class="prepared-by-info">
        <strong>Prepared by:</strong> {{ preparedBy || '_______________________________' }}
      </div>
    </div>

    <!-- Control Buttons -->
    <div class="billing-controls">
      <button class="btn btn-save" @click="saveBilling">Save Billing</button>
      <button class="btn btn-excel" @click="exportExcel">Export to Excel</button>
      <button class="btn btn-print" @click="printStatement">Print Statement</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from '@/api/config'

// Data
const trips = ref([])
const startDate = ref('')
const endDate = ref('')
const filteredTrips = ref([])
const preparedBy = ref('')
const preparedDate = ref('')
const billingNumber = ref('')

// Computed properties
const totalRevenue = computed(() => {
  return filteredTrips.value.reduce((sum, trip) => {
    if (trip._total) {
      return sum + trip._total
    }
    return sum
  }, 0)
})

const totalBags = computed(() => {
  return filteredTrips.value.reduce((sum, trip) => {
    return sum + (trip.numberOfBags || 0)
  }, 0)
})

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

const exportPDF = () => {
  // Create a new window for PDF export
  const pdfWindow = window.open('', '_blank')
  if (!pdfWindow) {
    alert('Please allow popups for PDF export to work.')
    return
  }

  const billToInfo = `Premium Feeds Corp.<br>
798 Maharlika Highway, Dampol 2nd A<br>
Pulilan Bulacan, 3005<br>
TIN #007-932-128-000<br>
Business Style: 007-932-128-000`

  const companyInfo = `MTM ENTERPRISE<br>
0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan<br>
TIN # 175-434-337-000<br>
Mobile No. 09605638462 / Telegram No. +358-044-978-8592`

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

  filteredTrips.value.forEach((trip, index) => {
    const bgColor = index % 2 === 1 ? '#fafafa' : 'white'
    tableHTML += `
<tr style="background: ${bgColor};">
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${formatDateShort(trip.date)}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.truckPlate}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.invoiceNumber}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.fullDestination}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.numberOfBags}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip._rate ? formatCurrency(trip._rate) : '0.00'}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip._total ? formatCurrency(trip._total) : '0.00'}</td>
</tr>`
  })

  tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td colspan="4" style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 12px;">GRAND TOTAL:</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 14px;">${totalBags.value}</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 14px;">₱${formatCurrency(totalRevenue.value)}</td>
</tr>
<tr style="background: white; font-weight: normal;">
<td colspan="7" style="border: 1px solid #000; padding: 15px 10px; text-align: left; font-size: 14px;"><strong>Prepared by:</strong> ${preparedBy.value || '_______________________________'}</td>
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
  body { font-family: Arial, sans-serif; color: #000; padding: 20mm; }
  .company-name-pdf { font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 20px; }
  .company-details-pdf { font-size: 12px; text-align: center; line-height: 1.4; margin-bottom: 20px; }
  .bill-to-pdf { margin-bottom: 20px; }
  .bill-to-title { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
  .bill-to-details { font-size: 11px; line-height: 1.4; margin-bottom: 15px; }
  .billing-info-pdf { font-size: 11px; margin-bottom: 15px; text-align: left; line-height: 1.4; }
  @page { size: A4; margin: 25mm; orientation: portrait; }
}
</style>
</head>
<body style="font-family: Arial, sans-serif; color: #000; background: white; margin: 0; padding: 20px;">
<div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
<h1 class="company-name-pdf">MTM ENTERPRISE</h1>
<div class="company-details-pdf">
${companyInfo}
</div>
<h2 style="font-size: 18px; font-weight: bold; margin: 15px 0;">BILLING STATEMENT</h2>
</div>

<div class="bill-to-pdf">
<strong style="font-weight: bold;">BILLED TO:</strong><br>
<div style="margin-top: 5px;">${billToInfo}</div>
</div>

<div class="billing-info-pdf" style="margin-top: 15px; line-height: 1.6;">
<strong>Billing Number:</strong> ${billingNumber.value}<br>
<strong>Period Covered:</strong> ${formatPeriod()}<br>
<strong>Date Generated:</strong> ${formatDate(new Date())}
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
  // Create Excel data
  const data = [
    ['DATE', 'PLATE NUMBER', 'INVOICE NUMBER', 'DESTINATION', 'NUMBER OF BAGS', 'RATE PER BAG', 'TOTAL'],
    ...filteredTrips.value.map(trip => [
      formatDateShort(trip.date),
      trip.truckPlate,
      trip.invoiceNumber,
      trip.fullDestination,
      trip.numberOfBags,
      `₱${trip._rate ? formatCurrency(trip._rate) : '0.00'}`,
      `₱${trip._total ? formatCurrency(trip._total) : '0.00'}`
    ]),
    ['GRAND TOTAL:', '', '', '', totalBags.value, '', `₱${formatCurrency(totalRevenue.value)}`]
  ]

  // Add prepared by information to CSV data
  data.push([])
  data.push(['Prepared by:', preparedBy.value || '_______________________________'])

  // Create CSV content
  const csvContent = data.map(row =>
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n')

  // Download as CSV (which can be opened in Excel)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `billing_statement_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  alert('Excel export ready! CSV file has been downloaded and can be opened in Excel or similar spreadsheet applications.')
}

const printStatement = () => {
  // Create print-friendly version
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

  filteredTrips.value.forEach((trip, index) => {
    const bgColor = index % 2 === 1 ? '#fafafa' : 'white'
    tableHTML += `
<tr style="background: ${bgColor};">
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${formatDateShort(trip.date)}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.truckPlate}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.invoiceNumber}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.fullDestination}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.numberOfBags}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip._rate ? formatCurrency(trip._rate) : '0.00'}</td>
<td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip._total ? formatCurrency(trip._total) : '0.00'}</td>
</tr>`
  })

  tableHTML += `
<tr style="background: #e0e0e0; font-weight: bold;">
<td colspan="4" style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 12px;">GRAND TOTAL:</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 14px;">${totalBags.value}</td>
<td style="border: 2px solid #000; padding: 10px; text-align: center;"></td>
<td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 14px;">₱${formatCurrency(totalRevenue.value)}</td>
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
  .company-name-print { font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 15px; }
  .company-details-print { font-size: 14px; text-align: center; line-height: 1.4; margin-bottom: 20px; }
  .billing-title-print { font-size: 20px; font-weight: bold; text-align: center; margin: 15px 0 20px 0; }
  .bill-to-print { margin-bottom: 20px; }
  .bill-to-title-print { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
  .bill-to-details-print { font-size: 12px; line-height: 1.4; margin-bottom: 15px; }
  .billing-info-print { font-size: 12px; margin-bottom: 15px; text-align: left; line-height: 1.4; }
  @page { size: A4; margin: 25mm; }
}
</style>
</head>
<body>
<div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">
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
<strong>Billing Number:</strong> ${billingNumber.value}<br>
<strong>Period Covered:</strong> ${formatPeriod()}<br>
<strong>Date Generated:</strong> ${formatDate(new Date())}
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

const filterTripsByDate = () => {
  if (!startDate.value || !endDate.value) {
    filteredTrips.value = [...trips.value]
    return
  }

  // Create start date at the beginning of the day (00:00:00.000)
  const start = new Date(startDate.value)
  start.setHours(0, 0, 0, 0)

  // Create end date at the end of the day (23:59:59.999)
  const end = new Date(endDate.value)
  end.setHours(23, 59, 59, 999)

  console.log('Filtering trips:', {
    startDate: startDate.value,
    endDate: endDate.value,
    startFilter: start.toISOString(),
    endFilter: end.toISOString()
  })

  filteredTrips.value = trips.value.filter(trip => {
    const tripDate = new Date(trip.date)
    const isIncluded = tripDate >= start && tripDate <= end

    if (!isIncluded) {
      console.log('Excluded trip:', {
        tripDate: trip.date,
        parsedTripDate: tripDate.toISOString(),
        isAfterStart: tripDate >= start,
        isBeforeEnd: tripDate <= end
      })
    }

    return isIncluded
  })

  console.log(`Filtered ${filteredTrips.value.length} trips out of ${trips.value.length}`)
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
        foundRate = exactMatch.newRates || exactMatch.rate
      }
    }

    // Store on trip object
    trip._rate = foundRate
    trip._total = foundRate ? foundRate * (trip.numberOfBags || 0) : 0
  })
}

const generateBillingNumber = async () => {
  try {
    // Format: YYYY-MMDD-MMDD-XXXX (year-start date-end date-4 random unique chars)
    const currentYear = new Date().getFullYear()

    // Format start date as MMDD
    const startDateObj = new Date(startDate.value)
    const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0')
    const startDay = String(startDateObj.getDate()).padStart(2, '0')
    const startFormatted = `${startMonth}${startDay}`

    // Format end date as MMDD
    const endDateObj = new Date(endDate.value)
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0')
    const endDay = String(endDateObj.getDate()).padStart(2, '0')
    const endFormatted = `${endMonth}${endDay}`

    // Generate 4 random unique characters (letters and numbers)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let randomChars = ''
    const usedChars = new Set()

    while (randomChars.length < 4) {
      const randomIndex = Math.floor(Math.random() * chars.length)
      const char = chars[randomIndex]
      if (!usedChars.has(char)) {
        usedChars.add(char)
        randomChars += char
      }
    }

    // Combine all parts
    billingNumber.value = `${currentYear}-${startFormatted}-${endFormatted}-${randomChars}`

    console.log('Generated billing number:', billingNumber.value)
  } catch (error) {
    console.error('Error generating billing number:', error)
    // Fallback format
    const currentYear = new Date().getFullYear()
    const fallbackRandom = Math.random().toString(36).substring(2, 6).toUpperCase()
    billingNumber.value = `${currentYear}-0000-0000-${fallbackRandom}`
  }
}

const saveBilling = async () => {
  if (!preparedBy.value) {
    alert('Please enter the prepared by name before saving.')
    return
  }

  if (filteredTrips.value.length === 0) {
    alert('No trips selected for billing. Please select a date range with completed trips.')
    return
  }

  // Generate billing number when saving
  await generateBillingNumber()

  const billingData = {
    id: Date.now().toString(),
    billingNumber: billingNumber.value,
    period: {
      startDate: startDate.value,
      endDate: endDate.value,
      periodText: formatPeriod()
    },
    client: {
      name: 'Premium Feeds Corp.',
      address: '798 Maharlika Highway, Dampol 2nd A',
      city: 'Pulilan Bulacan',
      zipCode: '3005',
      tin: '007-932-128-000'
    },
    trips: filteredTrips.value.map(trip => ({
      id: trip.id,
      date: trip.date,
      truckPlate: trip.truckPlate,
      invoiceNumber: trip.invoiceNumber,
      destination: trip.fullDestination,
      numberOfBags: trip.numberOfBags,
      rate: trip._rate,
      total: trip._total
    })),
    totals: {
      totalBags: totalBags.value,
      totalRevenue: totalRevenue.value
    },
    preparedBy: preparedBy.value,
    createdDate: new Date().toISOString(),
    status: 'pending',
    paymentStatus: 'pending'
  }

  try {
    // Save via API to database
    const response = await axios.post(`${API_BASE_URL}/billings`, billingData)

    if (response.status === 201) {
      console.log('Billing saved to database:', billingData.billingNumber)
      alert(`Billing ${billingNumber.value} saved successfully!\n\nSaved to database with ID: ${response.data.id}\n\nCurrent status: Pending Payment`)

      // Generate new billing number for next use
      generateBillingNumber()
    } else {
      throw new Error('Server response error')
    }

  } catch (error) {
    console.error('Error saving billing to server:', error)

    // Fallback: try to save to localStorage if server fails
    try {
      const localBillings = JSON.parse(localStorage.getItem('billingHistory') || '[]')
      localBillings.push(billingData)
      localStorage.setItem('billingHistory', JSON.stringify(localBillings))

      alert(`Billing saved locally (server unavailable).\n\nBilling ${billingNumber.value} saved to browser storage.\nCurrent status: Pending Payment`)
      generateBillingNumber()

    } catch (localError) {
      console.error('Local storage fallback failed:', localError)
      alert('Error saving billing. All storage methods failed. Please try again.')
    }
  }
}

const fetchBillingData = async () => {
  try {
    const [tripsRes, ratesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/trips?limit=all`), // Get all trips for billing
      axios.get(`${API_BASE_URL}/rates`)
    ])

    const tripsData = tripsRes.data.trips || tripsRes.data // Handle response
    const rawTrips = Array.isArray(tripsData) ? tripsData : []

    // Backend already provides camelCase fields, no need to remap
    const mappedTrips = rawTrips

    const rawRates = ratesRes.data
    // Map database snake_case fields to camelCase
    const mappedRates = rawRates.map(rate => ({
      ...rate,
      newRates: rate.new_rates || rate.newRates,
      origin: rate.origin,
      province: rate.province,
      town: rate.town
    }))

    // Calculate rates and totals for trips
    calculateTripRates(mappedTrips, mappedRates)

    trips.value = mappedTrips
    filteredTrips.value = [...mappedTrips] // Initially show all trips

    // Optional: Set default date range to current month instead of all trips
    // Uncomment the lines below if you prefer current month default:
    // const now = new Date()
    // const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    // const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    // startDate.value = firstDay.toISOString().split('T')[0]
    // endDate.value = lastDay.toISOString().split('T')[0]
    // filterTripsByDate()

  } catch (error) {
    console.error('Error fetching billing data:', error)
  }
}

// Lifecycle
onMounted(() => {
  fetchBillingData()
})
</script>

<style scoped>
/* Professional Billing Statement Styles */
.billing-statement {
  font-family: 'Arial', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  color: #000;
}

/* Filters Section */
.filters-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.signature-section {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #dee2e6;
}

.signature-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.signature-input {
  padding: 0.5rem;
  border: 2px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  background: white;
  width: 200px;
}

.date-filters {
  display: flex;
  gap: 2rem;
  align-items: center;
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
  color: #495057;
}

.date-input {
  padding: 0.5rem;
  border: 2px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  background: white;
  width: 180px;
}

.date-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.btn-filter {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white !important;
  border: 2px solid #007bff !important;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-filter:hover {
  background: #0056b3 !important;
  border-color: #0056b3 !important;
  color: white !important;
}

/* Centered Company Header */
.company-header {
  text-align: center;
  margin-bottom: 1rem;
  border-bottom: 2px solid #000;
  padding-bottom: 0.5rem;
}

.company-info-centered {
  justify-content: center;
  align-items: center;
  flex-direction: column;
  display: flex;
  gap: 0;
}

.company-logo-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.logo-container {
  text-align: center;
  margin-bottom: 0.25px;
}

.company-logo-large {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.company-name-small {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
  color: #000;
  letter-spacing: 1px;
}

.company-details-small {
  font-size: 0.8rem;
  line-height: 1.2;
  margin-bottom: 0.5rem;
}

.company-details-small p {
  margin: 0;
}

.billing-statement-title {
  font-size: 1.2rem;
  font-weight: bold;
  color: #000;
  margin: 0;
  letter-spacing: 1px;
}

/* Billed To Section - Left-aligned, left-justified text */
.billed-to-left {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.billed-to-label-small {
  font-size: 0.85rem;
  font-weight: bold;
  min-width: 70px;
  margin-top: 2px;
}

.billed-to-info-small {
  font-size: 0.8rem;
  line-height: 1.2;
  text-align: left;
}

.client-name-small {
  font-weight: bold;
  margin: 0 0 0.15rem 0;
  text-align: left;
}

.billed-to-info-small p {
  margin: 0.15rem 0;
  text-align: left;
}

/* Period and Billing Number Combined Section */
.period-billing-section {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  align-items: flex-start;
}

.left-side {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
}

.billing-number-info,
.period-info {
  font-weight: bold;
}

.right-side {
  display: flex;
  align-items: flex-end;
}

.generated-info {
  font-weight: bold;
}

/* Billing Table */
.billing-table-container {
  margin-bottom: 2rem;
}

.billing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  border: 1px solid #000;
}

.billing-table .header-row th {
  background: #f0f0f0;
  border: 1px solid #000;
  padding: 0.5rem 0.25rem;
  text-align: center;
  font-weight: bold;
  font-size: 0.7rem;
  vertical-align: middle;
}

.billing-table .data-row {
  border: 1px solid #000;
}

.billing-table .data-row:hover {
  background: #f9f9f9;
}

.billing-table .alt-row {
  background: #fafafa;
}

.billing-table .data-row td {
  padding: 0.5rem 0.25rem;
  border: none;
  text-align: center;
  vertical-align: middle;
}

/* Table column widths */
.date-cell { min-width: 80px; }
.plate-cell { min-width: 70px; }
.invoice-cell { min-width: 90px; }
.destination-cell { min-width: 200px; }
.bags-cell { min-width: 60px; text-align: center; }
.rate-cell { min-width: 80px; text-align: right; }
.total-cell { min-width: 100px; text-align: right; }

.date-col { width: auto; }
.plate-col { width: auto; }
.invoice-col { width: auto; }
.destination-col { width: auto; }
.bags-col { width: 15%; }
.rate-col { width: 12%; }
.total-col { width: 15%; }

/* Totals Row */
.totals-row {
  background: #e0e0e0;
  font-size: 0.8rem;
  font-weight: bold;
  border: 2px solid #000;
}

.totals-row td {
  padding: 0.75rem 0.25rem;
  border: none;
}

.totals-label {
  font-size: 0.9rem;
}

.totals-bags {
  text-align: center;
}

.totals-amount {
  font-size: 1rem;
  color: #000;
}

/* Prepared by Section */
.prepared-by-section {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.prepared-by-info {
  font-weight: bold;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.fw-bold {
  font-weight: bold;
}

/* Footer Information */
.billing-footer {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  border-top: 1px solid #000;
  padding-top: 1rem;
}

.summary-info {
  flex: 1;
}

.info-row {
  display: flex;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.info-row .label {
  font-weight: bold;
  display: inline-block;
  min-width: 150px;
}

.info-row .value {
  font-weight: normal;
}

.payment-instructions {
  flex: 1;
  text-align: right;
}

.payment-instructions h4 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #000;
}

.payment-instructions p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Control Buttons */
.billing-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #ccc;
}

.btn {
  padding: 0.75rem 2rem;
  border: 2px solid #000;
  background: white;
  color: #000;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: 'Courier New', monospace;
}

.btn:hover {
  background: #f0f0f0;
}

.btn-pdf {
  border-color: #1565c0;
  color: #1565c0;
}

.btn-pdf:hover {
  background: #e3f2fd;
}

.btn-excel {
  border-color: #2e7d32;
  color: #2e7d32;
}

.btn-excel:hover {
  background: #e8f5e8;
}

.btn-print {
  border-color: #424242;
  color: #424242;
}

.btn-print:hover {
  background: #f5f5f5;
}

/* Mobile Responsive Design */
@media (max-width: 768px) {
  .billing-statement {
    padding: 0.75rem;
    font-size: 0.85rem;
  }

  .filters-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
  }

  .date-filters {
    gap: 1rem;
  }

  .filter-group {
    flex: 1;
  }

  .date-input {
    width: 100%;
    font-size: 0.9rem;
  }

  .company-header {
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
  }

  .company-info-centered {
    gap: 0.5rem;
  }

  .company-logo-large {
    width: 80px;
    height: 80px;
  }

  .company-name-small {
    font-size: 1.2rem;
  }

  .company-details-small {
    font-size: 0.7rem;
  }

  .billing-statement-title {
    font-size: 1rem;
  }

  .billed-to-left {
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .billed-to-label-small {
    min-width: 60px;
    font-size: 0.8rem;
  }

  .billed-to-info-small {
    font-size: 0.75rem;
  }

  .period-billing-section {
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
  }

  /* Horizontal Scrolling Table Container */
  .billing-table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    max-width: 100%;
  }

  .billing-table {
    width: auto; /* Allow table to expand freely based on content */
    min-width: 100%; /* Ensure at least container width */
    font-size: 0.7rem;
    border: 1px solid #000;
    table-layout: auto !important; /* Override global fixed layout */
    margin: 0 auto; /* Center the table */
  }

  .billing-table .header-row th {
    padding: 0.5rem 0.25rem;
    font-size: 0.65rem;
    font-weight: bold;
    white-space: nowrap;
  }

  /* Header Column Widths - Match data column widths */
  .header-row .date-col { width: auto; min-width: 100px; }
  .header-row .plate-col { width: auto; min-width: 120px; }
  .header-row .invoice-col { width: auto; min-width: 140px; }
  .header-row .destination-col { width: auto; min-width: 250px; }
  .header-row .bags-col { width: auto; min-width: 80px; }
  .header-row .rate-col { width: auto; min-width: 100px; }
  .header-row .total-col { width: auto; min-width: 110px; }

  .billing-table .data-row td {
    padding: 0.5rem 0.25rem;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  /* Auto-adjusting Column Widths with generous minimums */
  .date-col { width: auto; min-width: 100px; }
  .plate-col { width: auto; min-width: 120px; }
  .invoice-col { width: auto; min-width: 140px; }
  .destination-col {
    width: auto;
    min-width: 250px; /* Increased significantly for long destination names */
    white-space: normal; /* Allow wrapping for very long destinations */
    word-wrap: break-word;
  }
  .bags-col { width: auto; min-width: 80px; }
  .rate-col { width: auto; min-width: 100px; }
  .total-col { width: auto; min-width: 110px; }

  /* Totals Row */
  .totals-row {
    font-size: 0.75rem;
  }

  .totals-row td {
    padding: 0.75rem 0.25rem;
  }

  .prepared-by-section {
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
  }

  .billing-controls {
    gap: 0.75rem;
    padding-top: 0.75rem;
  }

  .btn {
    padding: 0.6rem 1.5rem;
    font-size: 0.9rem;
  }
}

/* Extra Small Mobile Devices */
@media (max-width: 480px) {
  .billing-statement {
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .filters-section {
    padding: 0.75rem;
    margin-bottom: 1rem;
  }

  .company-logo-large {
    width: 60px;
    height: 60px;
  }

  .company-name-small {
    font-size: 1rem;
  }

  .billing-statement-title {
    font-size: 0.9rem;
  }

  .billing-table-container {
    border-radius: 4px;
  }

  .billing-table {
    min-width: 700px; /* Slightly narrower for very small screens */
    font-size: 0.65rem;
    table-layout: auto; /* Allow columns to auto-size based on content */
  }

  .billing-table .header-row th {
    padding: 0.4rem 0.2rem;
    font-size: 0.6rem;
    white-space: nowrap;
  }

  .billing-table .data-row td {
    padding: 0.4rem 0.2rem;
    font-size: 0.65rem;
    white-space: nowrap;
  }

  /* Auto-adjusting Column Widths for small screens */
  .date-col { width: auto; min-width: 70px; }
  .plate-col { width: auto; min-width: 80px; }
  .invoice-col { width: auto; min-width: 100px; }
  .destination-col { width: auto; min-width: 180px; }
  .bags-col { width: auto; min-width: 50px; }
  .rate-col { width: auto; min-width: 70px; }
  .total-col { width: auto; min-width: 80px; }

  .totals-row {
    font-size: 0.7rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }
}

/* Print Styles */
@media print {
  .billing-statement {
    max-width: none;
    margin: 0;
    padding: 1rem;
  }

  .billing-controls {
    display: none;
  }

  .billing-table-container {
    overflow: visible;
  }

  .billing-table {
    min-width: auto;
    font-size: 0.75rem;
  }

  .header-row th,
  .data-row td {
    padding: 0.5rem 0.25rem;
  }
}
</style>
