const fs = require('fs');
const path = require('path');

// Shared Billing Statement Rendering Utility
// This provides consistent styling and layout for billing PDF generation
class BillingRenderer {

  // Generate the complete billing statement HTML
  static generateBillingHTML(billingData, isForPDF = false) {
    const client = billingData.client || { name: 'Client Name' };
    const period = billingData.period || {};
    const totals = billingData.totals || {};
    const trips = billingData.trips || [];

    const periodText = period.periodText ||
      (period.startDate && period.endDate ?
        `${this.formatDate(period.startDate)} to ${this.formatDate(period.endDate)}` :
        'Billing Period');

    const tableRows = this.generateBillingTableRows(trips, isForPDF);

    const cssStyles = this.getStyles(isForPDF);

    // Read and encode logo for PDF if needed
    let logoSrc = '/mtmlogo.jpeg';
    if (isForPDF) {
      try {
        const logoPath = path.join(__dirname, '..', 'frontend', 'public', 'mtmlogo.jpeg');
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        logoSrc = `data:image/jpeg;base64,${logoBase64}`;
      } catch (error) {
        console.warn('Failed to load logo for PDF:', error.message);
        logoSrc = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA'; // fallback placeholder
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Billing Statement - ${billingData.billingNumber}</title>
  <style>${cssStyles}</style>
</head>
<body>
  <div class="billing-statement">
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
        <h2 class="billing-statement-title">BILLING STATEMENT</h2>
      </div>
    </div>

    <!-- Billed To Section - Left-aligned -->
    <div class="billed-to-left">
      <div class="billed-to-label-small">
        <strong>BILLED TO:</strong>
      </div>
      <div class="billed-to-info-small">
        <p class="client-name-small">${client.name}</p>
        <p>${client.address || ''} ${client.city || ''} ${client.zipCode || ''}</p>
        <p>TIN # ${client.tin}</p>
        ${client.businessStyle ? `<p>Business Style: ${client.businessStyle}</p>` : ''}
      </div>
    </div>

    <!-- Period and Billing Number Combined Section -->
    <div class="period-billing-section">
      <div class="left-side">
        <div class="billing-number-info">
          <strong>Billing Number:</strong> ${billingData.billingNumber}
        </div>
        <div class="period-info">
          <strong>Period Covered:</strong> ${periodText}
        </div>
      </div>
      <div class="right-side">
        <div class="generated-info">
          <strong>Date Generated:</strong> ${this.formatDate(billingData.createdDate)}
        </div>
        <div class="submitted-info">
          <strong>Date Submitted:</strong> ${this.calculateSubmittedDate(period.startDate, period.endDate)}
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
          ${tableRows}
          <!-- Totals row -->
          <tr class="totals-row">
            <td class="text-left fw-bold totals-label">GRAND TOTAL:</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="text-center fw-bold totals-bags">${totals.totalBags || 0}</td>
            <td></td>
            <td class="text-right fw-bold totals-amount">₱${this.formatCurrency(totals.totalRevenue || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Prepared by Section -->
    <div class="prepared-by-section">
      <div class="prepared-by-info">
        <strong>Prepared by:</strong> ${billingData.preparedBy || 'MTM Enterprise System'}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Generate table rows for billing trips
  static generateBillingTableRows(trips, isForPDF = false) {
    if (!trips || trips.length === 0) return '<tr><td colspan="7" class="no-data">No trips found</td></tr>';

    return trips.map((trip, index) => {
      const rowClass = index % 2 === 1 ? 'alt-row' : '';
      const rate = trip.rate || trip._rate || 0;
      const total = trip.total || trip._total || 0;

      return `
        <tr class="${rowClass}">
          <td class="date-cell">${this.formatDate(trip.date)}</td>
          <td class="plate-cell">${trip.truckPlate || trip.truck_plate || ''}</td>
          <td class="invoice-cell">${trip.invoiceNumber || trip.invoice_number || ''}</td>
          <td class="destination-cell">${trip.destination || trip.fullDestination || ''}</td>
          <td class="bags-cell text-center">${trip.numberOfBags || trip.number_of_bags || 0}</td>
          <td class="rate-cell text-right">${this.formatCurrency(rate)}</td>
          <td class="total-cell text-right">${this.formatCurrency(total)}</td>
        </tr>`;
    }).join('');
  }

  // Shared CSS styles
  static getStyles(isForPDF = false) {
    const tablePadding = '2px';
    const baseFontSize = '10px';

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: Arial, sans-serif;
        color: #000;
        background: white;
        ${isForPDF ? 'padding: 15mm 15mm 20mm 15mm; margin: 0;' : ''}
        line-height: 1.3;
      }

      .billing-statement {
        max-width: ${isForPDF ? '100%' : '1200px'};
        margin: 0 auto;
      }

      /* Company Header - Centered */
      .company-header {
        text-align: center;
        margin-bottom: 8px;
        border-bottom: 1px solid #000;
        padding-bottom: 4px;
      }

      .company-logo-large {
        width: ${isForPDF ? '80px' : '120px'};
        height: ${isForPDF ? '80px' : '120px'};
        object-fit: contain;
        display: block;
        margin: 0 auto 2px auto;
      }

      .company-name-small {
        font-size: ${isForPDF ? '14px' : '1.5rem'};
        font-weight: bold;
        margin: 2px 0 4px 0;
        letter-spacing: 1px;
        color: #000;
      }

      .company-details-small {
        font-size: ${isForPDF ? '10px' : '0.8rem'};
        line-height: 1.2;
      }

      .company-details-small p {
        margin: 1px 0;
      }

      .billing-statement-title {
        font-size: ${isForPDF ? '14px' : '1.2rem'};
        font-weight: bold;
        color: #000;
        margin: ${isForPDF ? '6px 0 8px 0' : '0'};
        letter-spacing: 1px;
      }

      /* Billed To Section - Left-aligned */
      .billed-to-left {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 6px;
        align-items: flex-start;
      }

      .billed-to-label-small {
        font-size: ${isForPDF ? '10px' : '0.85rem'};
        font-weight: bold;
        min-width: 60px;
        margin-top: 1px;
      }

      .billed-to-info-small {
        font-size: ${isForPDF ? '9px' : '0.8rem'};
        line-height: 1.2;
      }

      .client-name-small {
        font-weight: bold;
        margin: 0 0 2px 0;
        text-align: left;
      }

      .billed-to-info-small p {
        margin: 1px 0;
        text-align: left;
      }

      /* Period and Billing Number Section */
      .period-billing-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: ${isForPDF ? '9px' : '0.85rem'};
        align-items: flex-start;
      }

      .billing-number-info,
      .period-info,
      .generated-info,
      .submitted-info {
        font-weight: bold;
        margin-bottom: 2px;
      }

      /* Billing Table */
      .billing-table-container {
        margin-bottom: 1rem;
      }

      .billing-table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${baseFontSize};
        border: 1px solid #000;
        margin: 0 auto;
      }

      .billing-table .header-row th {
        background: #f0f0f0;
        border: 1px solid #000;
        padding: ${tablePadding};
        text-align: center;
        font-weight: bold;
        font-size: 9px;
        vertical-align: middle;
      }

      .billing-table .data-row {
        border: 1px solid #000;
      }

      .billing-table .data-row.alt-row {
        background: #fafafa;
      }

      .billing-table .data-row td {
        padding: ${tablePadding};
        border: none;
        text-align: center;
        vertical-align: middle;
      }

      .billing-table .totals-row {
        background: #e0e0e0;
        font-size: 0.85rem;
        font-weight: bold;
        border: 2px solid #000;
      }

      .billing-table .totals-row td {
        padding: 4px ${tablePadding};
      }

      /* Column widths */
      .date-col { min-width: 80px; }
      .plate-col { min-width: 70px; }
      .invoice-col { min-width: 90px; }
      .destination-col { min-width: 200px; text-align: left; }
      .bags-col { min-width: 60px; text-align: center; }
      .rate-col { min-width: 80px; text-align: right; }
      .total-col { min-width: 100px; text-align: right; }

      /* Text alignment utilities */
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .fw-bold { font-weight: bold; }

      /* Totals styling */
      .totals-label {
        font-size: 0.9rem;
        text-align: left;
      }

      .totals-bags {
        text-align: center;
      }

      .totals-amount {
        font-size: 1rem;
        color: #000;
        text-align: right;
      }

      .no-data {
        text-align: center;
        padding: 1rem;
        font-style: italic;
        color: #666;
      }

      /* Prepared by Section */
      .prepared-by-section {
        margin-top: 8px;
        text-align: left;
        font-weight: bold;
        font-size: ${isForPDF ? '9px' : '0.9rem'};
      }

      .prepared-by-info {
        font-weight: bold;
      }

      @media print {
        @page {
          size: A4;
          margin: 15mm;
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

  static calculateSubmittedDate(startDate, endDate) {
    // Calculate submitted date based on billing period
    const periodStart = new Date(startDate);

    // Determine which half of the month the period falls into
    const startDay = periodStart.getDate();

    let submittedDate;
    if (startDay >= 1 && startDay <= 15) {
      // Period 1-15: submitted date = 18th of same month
      submittedDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 18);
    } else {
      // Period 16-31: submitted date = 2nd of following month
      submittedDate = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 2);
    }

    return this.formatDate(submittedDate);
  }
}

module.exports = BillingRenderer;
