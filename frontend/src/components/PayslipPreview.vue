<template>
  <div class="payslip-preview">
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
        <h2 class="payroll-statement-title">PAYSLIP</h2>
      </div>
    </div>

    <!-- Employee Information -->
    <div class="employee-info-section">
      <div class="employee-info-left">
        <div class="employee-name-info">
          <strong>Employee Name:</strong> {{ (payslip.employee || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).employee : null))?.name || 'N/A' }}
        </div>
        <div class="employee-position-info">
          <strong>Position:</strong> {{ (payslip.employee || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).employee : null))?.position || 'N/A' }}
        </div>
      </div>
      <div class="employee-info-right">
        <div class="payslip-number-info">
          <strong>Payslip Number:</strong> {{ payslip.payslip_number || payslip.payslipNumber || 'N/A' }}
        </div>
        <div class="period-info">
          <strong>Period Covered:</strong> {{ (payslip.period || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).period : null))?.periodText || 'N/A' }}
        </div>
        <div class="generated-info">
          <strong>Date Generated:</strong> {{ formatDate(payslip.created_date || payslip.createdDate) }}
        </div>
      </div>
    </div>

    <!-- Payroll Table -->
    <div class="payroll-table-container">
      <div class="table-scroll-wrapper">
        <table class="payroll-table">
        <thead>
          <tr class="header-row">
            <th class="date-col">DATE</th>
            <th class="plate-col">TRUCK PLATE</th>
            <th class="invoice-col">INVOICE NUMBER</th>
            <th class="destination-col">DESTINATION</th>
            <th class="bags-col">BAGS</th>
            <th class="position-col">POS</th>
            <th class="rate-col">RATE</th>
            <th class="trip-value-col">TRIP VALUE</th>
            <th class="commission-col">COMM %</th>
            <th class="total-col">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <!-- Data rows -->
          <tr v-for="(trip, index) in (payslip.trips || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).trips : []) || [])" :key="'trip-' + index" class="data-row" :class="{ 'alt-row': index % 2 === 1 }">
            <td class="date-cell">{{ formatDate(trip.date) }}</td>
            <td class="plate-cell">{{ trip.truckPlate || trip.truck_plate }}</td>
            <td class="invoice-cell">{{ trip.invoiceNumber }}</td>
            <td class="destination-cell">{{ trip.destination || trip.fullDestination }}</td>
            <td class="bags-cell text-center">{{ trip.numberOfBags || trip.number_of_bags }}</td>
            <td class="position-cell text-center">{{ trip._role === 'D' ? 'Driver' : trip._role === 'H' ? 'Helper' : 'UNK' }}</td>
            <td class="rate-cell text-right">{{ trip.adjustedRate ? formatCurrency(trip.adjustedRate) : '0.00' }}</td>
            <td class="trip-value-cell text-right">{{ (trip.adjustedRate || 0) && (trip.numberOfBags || trip.number_of_bags || 0) ? formatCurrency((trip.adjustedRate) * (trip.numberOfBags || trip.number_of_bags)) : '0.00' }}</td>
            <td class="commission-cell text-center">{{ trip._commission ? (trip._commission * 100).toFixed(0) + '%' : '--%' }}</td>
            <td class="total-cell text-right">{{ trip.total ? formatCurrency(trip.total) : '0.00' }}</td>
          </tr>

          <!-- Separator row -->
          <tr class="separator-row">
            <td colspan="10" class="separator-cell"></td>
          </tr>

          <!-- Gross Pay row - aligned with same 10-column structure -->
          <tr class="totals-row">
            <td class="date-cell text-left fw-bold">GROSS PAY:</td>
            <td class="plate-cell"></td>
            <td class="invoice-cell"></td>
            <td class="destination-cell"></td>
            <td class="bags-cell text-center fw-bold">{{ (payslip.totals || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).totals : null))?.totalBags || 0 }}</td>
            <td class="position-cell"></td>
            <td class="rate-cell"></td>
            <td class="trip-value-cell"></td>
            <td class="commission-cell"></td>
            <td class="total-cell text-right fw-bold">₱{{ formatCurrency((payslip.totals || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).totals : null))?.totalPay || 0) }}</td>
          </tr>

          <!-- Individual Deductions rows - aligned with same 10-column structure -->
          <tr v-for="(deduction, index) in ((payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).deductions : null) || payslip.deductions || [])" :key="deduction.name + index" class="deduction-row">
            <td class="date-cell text-left fw-bold">{{ deduction.name }} ({{ deduction.type === 'percentage' ? deduction.value + '%' : '₱' + formatCurrency(deduction.value) }}):</td>
            <td class="plate-cell"></td>
            <td class="invoice-cell"></td>
            <td class="destination-cell"></td>
            <td class="bags-cell"></td>
            <td class="position-cell"></td>
            <td class="rate-cell"></td>
            <td class="trip-value-cell"></td>
            <td class="commission-cell"></td>
            <td class="total-cell text-right fw-bold">-₱{{ formatCurrency(deduction.calculatedAmount || (deduction.type === 'percentage' ? (((payslip.totals || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).totals : null))?.totalPay || 0) * deduction.value / 100) : deduction.value)) }}</td>
          </tr>

          <!-- Total Deductions row - only show if deductions exist -->
          <tr v-if="((payslip.deductions || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).deductions : []) || []).length > 0)" class="total-deductions-row">
            <td class="date-cell text-left fw-bold">TOTAL DEDUCTIONS:</td>
            <td class="plate-cell"></td>
            <td class="invoice-cell"></td>
            <td class="destination-cell"></td>
            <td class="bags-cell"></td>
            <td class="position-cell"></td>
            <td class="rate-cell"></td>
            <td class="trip-value-cell"></td>
            <td class="commission-cell"></td>
            <td class="total-cell text-right fw-bold">-₱{{ formatCurrency((payslip.totals || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).totals : null))?.totalDeductions || 0) }}</td>
          </tr>

          <!-- Net Pay row - only show if deductions exist -->
          <tr v-if="((payslip.deductions || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).deductions : []) || []).length > 0)" class="net-pay-row">
            <td class="date-cell text-left fw-bold">NET PAY:</td>
            <td class="plate-cell"></td>
            <td class="invoice-cell"></td>
            <td class="destination-cell"></td>
            <td class="bags-cell"></td>
            <td class="position-cell"></td>
            <td class="rate-cell"></td>
            <td class="trip-value-cell"></td>
            <td class="commission-cell"></td>
            <td class="total-cell text-right fw-bold">₱{{ formatCurrency((payslip.totals || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).totals : null))?.netPay || 0) }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Prepared by Section -->
    <div class="prepared-by-section">
      <div class="prepared-by-info">
        <strong>Prepared by:</strong> {{ payslip.preparedBy || (payslip.details ? (typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details).preparedBy : null) || 'N/A' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'
import { usePayslipStyling } from '@/composables/usePayslipStyling'

const props = defineProps({
  payslip: {
    type: Object,
    required: true
  }
})

// Use shared payslip styling
const { payslipVars, payslipStyles } = usePayslipStyling()

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
</script>

<style scoped>
/* Use shared payslip styles */
.payslip-preview {
  background: var(--payslip-bg);
  font-family: var(--payslip-font);
  color: var(--payslip-text);
  margin: 0;
  padding: 0;
}

/* Centered Company Header */
.company-header {
  text-align: center;
  margin-bottom: 1rem;
  border-bottom: 2px solid #000;
  padding-bottom: 0.5rem;
  page-break-inside: avoid;
}

.company-info-centered {
  justify-content: center;
  align-items: center;
  flex-direction: column;
  display: flex;
  gap: 0;
}

.logo-container {
  text-align: center;
  margin-bottom: 0.25px;
}

.company-logo-large {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.company-name-small {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0;
  color: #000;
  letter-spacing: 1px;
}

.company-details-small {
  font-size: 0.7rem;
  line-height: 1.1;
  margin-bottom: 0.5rem;
}

.company-details-small p {
  margin: 0;
}

.payroll-statement-title {
  font-size: 1rem;
  font-weight: bold;
  color: #000;
  margin: 0;
  letter-spacing: 1px;
}

/* Employee Information Section */
.employee-info-section {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  align-items: flex-start;
  page-break-inside: avoid;
}

.employee-info-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  flex: 1;
}

.employee-name-info,
.employee-position-info {
  font-weight: bold;
}

.employee-info-right {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
  flex: 1;
}

.payslip-number-info,
.period-info,
.generated-info {
  font-weight: bold;
  text-align: right;
}

/* Payroll Table */
.payroll-table-container {
  margin-bottom: 1rem;
  page-break-inside: avoid;
}

.table-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.payroll-table {
  width: auto !important; /* Allow table to expand based on content */
  min-width: 100%; /* Ensure at least container width */
  border-collapse: collapse;
  font-size: 0.65rem;
  border: 1px solid #000;
  table-layout: auto !important; /* Override global fixed layout */
  margin: 0 auto; /* Center the table */
}

.payroll-table .header-row th {
  background: #f0f0f0;
  border: 1px solid #000;
  padding: 0.4rem 0.15rem;
  text-align: center;
  font-weight: bold;
  font-size: 0.6rem;
  vertical-align: middle;
}

.payroll-table .data-row {
  border: 1px solid #000;
}

.payroll-table .alt-row {
  background: #fafafa;
}

.payroll-table .data-row td {
  padding: 0.3rem 0.15rem;
  border: none;
  text-align: center;
  vertical-align: middle;
}

/* Table column widths */
.date-cell { min-width: 60px; }
.plate-cell { min-width: 50px; }
.invoice-cell { min-width: 70px; }
.destination-cell { min-width: 150px; }
.bags-cell { min-width: 40px; text-align: center; }
.rate-cell { min-width: 60px; text-align: right; }
.total-cell { min-width: 70px; text-align: right; }

.date-col { width: 12%; }
.plate-col { width: 10%; }
.invoice-col { width: 15%; }
.destination-col { width: 30%; }
.bags-col { width: 8%; }
.rate-col { width: 12%; }
.total-col { width: 13%; }

.separator-row {
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}

.separator-cell {
  height: 8px;
  background: #000;
}

.totals-bags {
  text-align: center;
}

/* Print Styles */
@media print {
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .payslip-preview { font-family: 'Courier New', monospace; color: #000; padding: 6mm 5mm; font-size: 9px; line-height: 1.2; }
  .payroll-controls { display: none; }
  .company-name-small { font-size: 14px; font-weight: bold; margin: 3px 0; letter-spacing: 1px; }
  .company-details-small { font-size: 8px; line-height: 1.1; margin-bottom: 5px; }
  .company-details-small p { margin: 1px 0; }
  .payroll-statement-title { font-size: 12px; font-weight: bold; margin: 4px 0; letter-spacing: 1px; }
  .employee-info-section { margin-bottom: 8px; font-size: 8px; }
  .company-logo-large { width: 60px; height: 60px; }
  .payroll-statement-title { font-size: 0.75rem; }
  @page { size: A4; margin: 8mm; }
  .payroll-table { font-size: 7px; border: 1px solid #000; }
  .payroll-table .header-row th { padding: 2px 1px; font-size: 6px; }
  .payroll-table .data-row td { padding: 1px 1px; font-size: 7px; }
  .totals-row td { padding: 3px 1px; font-size: 8px; }
  .total-deductions-row td { padding: 3px 1px; font-size: 8px; }
  .net-pay-row td { padding: 4px 1px; font-size: 9px; }
  .individual-deduction-row td { padding: 2px 1px; font-size: 7px; }
}

/* Responsive Design */
@media screen and (max-width: 768px) {
  .payslip-preview {
    padding: 0;
  }

  .company-header {
    flex-direction: column;
    gap: 1rem;
  }

  .invoice-header {
    text-align: left;
  }

  .payroll-footer {
    flex-direction: column;
    gap: 1rem;
  }

  .payment-instructions {
    text-align: left;
  }

  .payroll-controls {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .ledger-table {
    font-size: 0.75rem;
  }

  .header-row th,
  .data-row td {
    padding: 0.5rem 0.25rem;
  }

  /* Mobile Table Column Widths - Auto-adjusting like BillingHistory */
  .payroll-table {
    font-size: 0.7rem;
    min-width: 100%;
  }

  .payroll-table .header-row th,
  .payroll-table .data-row td {
    padding: 0.5rem 0.25rem;
    font-size: 0.7rem;
  }

  /* Auto-adjusting Column Widths */
  .payroll-table .header-row th:nth-child(1),
  .payroll-table .data-row td:nth-child(1) { /* Date */
    width: auto;
    min-width: 100px;
  }

  .payroll-table .header-row th:nth-child(2),
  .payroll-table .data-row td:nth-child(2) { /* Plate */
    width: auto;
    min-width: 120px;
  }

  .payroll-table .header-row th:nth-child(3),
  .payroll-table .data-row td:nth-child(3) { /* Invoice */
    width: auto;
    min-width: 140px;
  }

  .payroll-table .header-row th:nth-child(4),
  .payroll-table .data-row td:nth-child(4) { /* Destination */
    width: auto;
    min-width: 250px;
    white-space: normal;
    word-wrap: break-word;
  }

  .payroll-table .header-row th:nth-child(5),
  .payroll-table .data-row td:nth-child(5) { /* Bags */
    width: auto;
    min-width: 80px;
  }

  .payroll-table .header-row th:nth-child(6),
  .payroll-table .data-row td:nth-child(6) { /* POS */
    width: auto;
    min-width: 70px;
  }

  .payroll-table .header-row th:nth-child(7),
  .payroll-table .data-row td:nth-child(7) { /* Rate (-₱4) */
    width: auto;
    min-width: 90px;
  }

  .payroll-table .header-row th:nth-child(8),
  .payroll-table .data-row td:nth-child(8) { /* Trip Value */
    width: auto;
    min-width: 100px;
  }

  .payroll-table .header-row th:nth-child(9),
  .payroll-table .data-row td:nth-child(9) { /* Comm % */
    width: auto;
    min-width: 70px;
  }

  .payroll-table .header-row th:nth-child(10),
  .payroll-table .data-row td:nth-child(10) { /* Total */
    width: auto;
    min-width: 90px;
  }
}
</style>
