// Shared Payslip Rendering Utility for Client-side
// This provides consistent styling and layout for client-side HTML generation
class PayslipRenderer {

  // Generate the complete payslip HTML
  static generatePayslipHTML(payslipData, isForPDF = false) {
    const employee = payslipData.employee || { name: 'Employee Name' };
    const period = payslipData.period || {};
    const totals = payslipData.totals || {};
    const deductions = payslipData.deductions || [];
    const trips = payslipData.trips || [];

    const periodText = period.periodText || (period.startDate && period.endDate ?
      `${this.formatDate(period.startDate)} to ${this.formatDate(period.endDate)}` :
      'Pay Period');

    const tableRows = this.generateTableRows(trips, isForPDF);
    const deductionRows = this.generateDeductionRows(deductions, totals, isForPDF);

    const cssStyles = this.getStyles(isForPDF);

    // For client-side, always use the public path for logo
    const logoSrc = '/mtmlogo.jpeg';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${payslipData.payslipNumber}</title>
  <style>${cssStyles}</style>
</head>
<body>
  <div class="payslip-preview">
    <!-- Company Header - Centered -->
    <div class="company-header">
      <div class="company-info-centered">
        <div class="logo-container">
          <img src="${logoSrc}" alt="MTM Enterprise Logo" class="company-logo-large" />
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

    <div class="employee-info-section">
      <div class="employee-info-left">
        <div class="employee-name-info">
          <strong>Employee Name:</strong> ${employee.name}
        </div>
        <div class="employee-position-info">
          <strong>Position:</strong> ${employee.position || 'N/A'}
        </div>
      </div>
      <div class="employee-info-right">
        <div class="payslip-number-info">
          <strong>Payslip Number:</strong> ${payslipData.payslipNumber || 'N/A'}
        </div>
        <div class="period-info">
          <strong>Period Covered:</strong> ${periodText}
        </div>
        <div class="generated-info">
          <strong>Date Generated:</strong> ${this.formatDate(payslipData.createdDate)}
        </div>
      </div>
    </div>

    <div class="payroll-table-container">
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
          ${tableRows}
          <!-- GROSS PAY row - aligned with same 10-column structure -->
          <tr class="totals-row">
            <td class="date-cell text-left fw-bold">GROSS PAY:</td>
            <td class="plate-cell"></td>
            <td class="invoice-cell"></td>
            <td class="destination-cell"></td>
            <td class="bags-cell text-center fw-bold">${totals.totalBags || 0}</td>
            <td class="position-cell"></td>
            <td class="rate-cell"></td>
            <td class="trip-value-cell"></td>
            <td class="commission-cell"></td>
            <td class="total-cell text-right fw-bold">₱${this.formatCurrency(totals.totalPay || 0)}</td>
          </tr>
          ${deductionRows}
        </tbody>
      </table>
    </div>

    <div class="prepared-by-section">
      <div class="prepared-by-info">
        <strong>Prepared by:</strong> ${payslipData.preparedBy || 'MTM Enterprise System'}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Generate table rows for trips
  static generateTableRows(trips, isForPDF = false) {
    if (!trips || trips.length === 0) return '';

    return trips.map((trip, index) => {
      const rowClass = index % 2 === 1 ? 'alt-row' : '';
      const position = trip._role === 'D' ? 'Driver' : trip._role === 'H' ? 'Helper' : 'UNK';
      const rateValue = trip.adjustedRate || (trip.rate ? trip.rate - 4 : 0);
      const bags = trip.numberOfBags || trip.number_of_bags || 0;
      const tripValue = rateValue * bags;

      return `
        <tr class="${rowClass}">
          <td class="date-cell">${this.formatDate(trip.date)}</td>
          <td class="plate-cell">${trip.truckPlate || trip.truck_plate || ''}</td>
          <td class="invoice-cell">${trip.invoiceNumber || ''}</td>
          <td class="destination-cell">${trip.destination || trip.fullDestination || ''}</td>
          <td class="bags-cell text-center">${bags}</td>
          <td class="position-col text-center">${position}</td>
          <td class="rate-cell text-right">₱${this.formatCurrency(rateValue)}</td>
          <td class="trip-value-cell text-right">₱${this.formatCurrency(tripValue)}</td>
          <td class="commission-cell text-center">${trip._commission ? (trip._commission * 100).toFixed(0) + '%' : '--%'}</td>
          <td class="total-cell text-right">₱${this.formatCurrency(trip.total || tripValue)}</td>
        </tr>`;
    }).join('');
  }

  // Generate deduction rows
  static generateDeductionRows(deductions, totals, isForPDF = false) {
    if (!deductions || deductions.length === 0) {
      return `<tr class="net-pay-row">
        <td class="date-cell text-left fw-bold">NET PAY:</td>
        <td class="plate-cell"></td>
        <td class="invoice-cell"></td>
        <td class="destination-cell"></td>
        <td class="bags-cell"></td>
        <td class="position-cell"></td>
        <td class="rate-cell"></td>
        <td class="trip-value-cell"></td>
        <td class="commission-cell"></td>
        <td class="total-cell text-right fw-bold">₱${this.formatCurrency(totals.netPay || 0)}</td>
      </tr>`;
    }

    let rows = '';

    // Individual deduction rows
    deductions.forEach(deduction => {
      const deductionAmount = deduction.type === 'percentage'
        ? ((totals.totalPay || 0) * (deduction.value / 100))
        : deduction.value;

      rows += `<tr class="individual-deduction-row">
        <td class="date-cell text-left fw-bold">
          ${deduction.name}
          <span class="deduction-type-indicator">
            (${deduction.type === 'percentage' ? deduction.value + '%' : '₱' + this.formatCurrency(deduction.value)})
          </span>
        </td>
        <td class="plate-cell"></td>
        <td class="invoice-cell"></td>
        <td class="destination-cell"></td>
        <td class="bags-cell"></td>
        <td class="position-cell"></td>
        <td class="rate-cell"></td>
        <td class="trip-value-cell"></td>
        <td class="commission-cell"></td>
        <td class="total-cell text-right fw-bold">-₱${this.formatCurrency(deductionAmount)}</td>
      </tr>`;
    });

    // Total deductions row
    rows += `<tr class="total-deductions-row">
      <td class="date-cell text-left fw-bold">TOTAL DEDUCTIONS:</td>
      <td class="plate-cell"></td>
      <td class="invoice-cell"></td>
      <td class="destination-cell"></td>
      <td class="bags-cell"></td>
      <td class="position-cell"></td>
      <td class="rate-cell"></td>
      <td class="trip-value-cell"></td>
      <td class="commission-cell"></td>
      <td class="total-cell text-right fw-bold">-₱${this.formatCurrency(totals.totalDeductions || 0)}</td>
    </tr>`;

    // Net pay row
    rows += `<tr class="net-pay-row">
      <td class="date-cell text-left fw-bold">NET PAY:</td>
      <td class="plate-cell"></td>
      <td class="invoice-cell"></td>
      <td class="destination-cell"></td>
      <td class="bags-cell"></td>
      <td class="position-cell"></td>
      <td class="rate-cell"></td>
      <td class="trip-value-cell"></td>
      <td class="commission-cell"></td>
      <td class="total-cell text-right fw-bold">₱${this.formatCurrency(totals.netPay || 0)}</td>
    </tr>`;

    return rows;
  }

  // Shared CSS styles
  static getStyles(isForPDF = false) {
    const baseFontSize = isForPDF ? '10px' : '0.65rem';
    const padding = isForPDF ? '6px' : '0.3rem 0.15rem';

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Courier New', monospace;
        color: #000;
        background: white;
        ${isForPDF ? 'padding: 20px;' : ''}
        line-height: 1.4;
      }

      .payslip-container {
        max-width: ${isForPDF ? '800px' : 'none'};
        margin: 0 auto;
        padding: ${isForPDF ? '20px' : '0'};
        background: white;
      }

      .company-header {
        text-align: center;
        margin-bottom: 1rem;
        border-bottom: 2px solid #000;
        padding-bottom: 0.5rem;
      }

      .company-logo-section {
        flex-shrink: 0;
      }

      .company-logo {
        width: ${isForPDF ? '80px' : '100px'};
        height: ${isForPDF ? '80px' : '100px'};
        object-fit: contain;
        margin-bottom: 10px;
      }

      .company-logo-large {
        width: ${isForPDF ? '60px' : '100px'};
        height: ${isForPDF ? '60px' : '100px'};
        object-fit: contain;
      }

      .company-name {
        font-size: ${isForPDF ? '18px' : '1.2rem'};
        font-weight: bold;
        margin: 5px 0;
        letter-spacing: 1px;
        color: #1f2937;
      }

      .company-details {
        font-size: ${isForPDF ? '10px' : '0.7rem'};
        line-height: 1.2;
        margin-bottom: 10px;
      }

      .company-details p {
        margin: 1px 0;
      }

      .payslip-title {
        font-size: ${isForPDF ? '20px' : '1rem'};
        font-weight: bold;
        margin: 15px 0;
        color: #dc2626;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .employee-info-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        font-size: var(--primary-font-size, ${isForPDF ? '11px' : '0.75rem'});
        align-items: flex-start;
      }

      .employee-info-left, .employee-info-right {
        flex: 1;
      }

      .employee-info-left {
        text-align: left;
      }

      .employee-info-right {
        text-align: right;
      }

      .employee-name-info,
      .employee-position-info,
      .payslip-number-info,
      .period-info,
      .generated-info {
        font-weight: bold;
        margin-bottom: 4px;
      }

      .payroll-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
        font-size: ${baseFontSize};
        border: 1px solid #000;
        table-layout: auto;
        margin: 0 auto;
      }

      .payroll-table th {
        background: #f0f0f0;
        border: 1px solid #000;
        padding: ${isForPDF ? '8px' : '0.4rem 0.15rem'};
        text-align: center;
        font-weight: bold;
        vertical-align: middle;
      }

      .payroll-table td {
        border: 1px solid #000;
        padding: ${padding};
        text-align: center;
        vertical-align: middle;
      }

      .payroll-table .alt-row {
        background: #fafafa;
      }

      .date-cell { min-width: 60px; }
      .plate-cell { min-width: 50px; }
      .invoice-cell { min-width: 70px; }
      .destination-cell { min-width: 150px; }

      .totals-row {
        background: #e0e0e0;
        font-weight: bold;
        border: 2px solid #000;
        font-size: ${isForPDF ? '12px' : '0.7rem'};
      }

      .totals-row td {
        padding: ${isForPDF ? '10px' : '0.5rem 0.15rem'};
        border: none;
      }

      .individual-deduction-row {
        background: #fefefa;
        font-weight: normal;
        border: 1px solid #000;
      }

      .individual-deduction-row td {
        padding: ${isForPDF ? '6px' : '0.3rem 0.15rem'};
        border: none;
      }

      .total-deductions-row {
        background: #fff3cd;
        font-weight: bold;
        border: 1px solid #000;
      }

      .total-deductions-row td {
        padding: ${isForPDF ? '8px' : '0.4rem 0.15rem'};
        border: none;
      }

      .net-pay-row {
        background: #d1ecf1;
        font-weight: bold;
        border: 2px solid #28a745;
      }

      .net-pay-row td {
        padding: ${isForPDF ? '10px' : '0.5rem 0.15rem'};
        border: none;
      }

      .prepared-by-section {
        margin-top: 20px;
        text-align: left;
        font-weight: bold;
        font-size: ${isForPDF ? '11px' : '0.75rem'};
      }

      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .fw-bold { font-weight: bold; }

      @media print {
        @page {
          size: A4;
          margin: 8mm;
        }
        .payslip-container {
          padding: 6mm 5mm;
          font-size: 9px;
          line-height: 1.2;
        }
        .payroll-table {
          font-size: 8px;
        }
        .payroll-table th {
          padding: 2px 1px;
          font-size: 7px;
        }
        .payroll-table td {
          padding: 1px;
          font-size: 8px;
        }
        .totals-row td {
          padding: 3px 1px;
        }
        .net-pay-row td {
          padding: 4px 1px;
        }
      }

      @media screen and (max-width: 768px) {
        .payroll-table {
          font-size: 0.7rem;
          min-width: 100%;
        }
        .payroll-table th,
        .payroll-table td {
          padding: 0.5rem 0.25rem;
          font-size: 0.7rem;
        }
        .payroll-table .header-row th:nth-child(1),
        .payroll-table .data-row td:nth-child(1) {
          min-width: 100px;
        }
        .payroll-table .header-row th:nth-child(2),
        .payroll-table .data-row td:nth-child(2) {
          min-width: 120px;
        }
        .payroll-table .header-row th:nth-child(3),
        .payroll-table .data-row td:nth-child(3) {
          min-width: 140px;
        }
        .payroll-table .header-row th:nth-child(4),
        .payroll-table .data-row td:nth-child(4) {
          min-width: 250px;
          white-space: normal;
          word-wrap: break-word;
        }
        .payroll-table .header-row th:nth-child(5),
        .payroll-table .data-row td:nth-child(5) {
          min-width: 80px;
        }
        .payroll-table .header-row th:nth-child(6),
        .payroll-table .data-row td:nth-child(6) {
          min-width: 70px;
        }
        .payroll-table .header-row th:nth-child(7),
        .payroll-table .data-row td:nth-child(7) {
          min-width: 90px;
        }
      }`;
  }

  static formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }

  static formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0.00';
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

export default PayslipRenderer;
