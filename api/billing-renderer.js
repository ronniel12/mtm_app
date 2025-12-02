// Server-side Billing Rendering Utility for PDF Generation
// Provides consistent styling and layout for billing PDF generation
class BillingRenderer {

  // Generate the complete billing HTML
  static generateBillingHTML(billingData, isForPDF = false) {
    const client = billingData.client || {};
    const period = billingData.period || {};
    const totals = billingData.totals || {};
    const trips = billingData.trips || [];

    const periodText = period.periodText || (period.startDate && period.endDate ?
      `${this.formatDate(period.startDate)} to ${this.formatDate(period.endDate)}` :
      'Billing Period');

    const tableRows = this.generateTripRows(trips, isForPDF);

    const cssStyles = this.getStyles(isForPDF);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Billing Statement - ${billingData.billingNumber}</title>
  <style>${cssStyles}</style>
</head>
<body>
  <div class="billing-container">
    <!-- Company Header - Centered -->
    <div class="company-header">
      <h1 class="company-name">MTM ENTERPRISE</h1>
      <div class="company-details">
        <p>0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan</p>
        <p>TIN # 175-434-337-000</p>
        <p>Mobile No. 09605638462 / Telegram No. +358-044-978-8592</p>
      </div>
      <h2 class="billing-title">BILLING STATEMENT</h2>
    </div>

    <!-- Billing Info Section -->
    <div class="billing-info-section">
      <div class="billing-info-left">
        <div class="client-info">
          <strong>Bill To:</strong><br>
          ${client.name || 'Client Name'}<br>
          ${client.address || 'Address'}<br>
          ${client.city || ''} ${client.zipCode || ''}<br>
          TIN: ${client.tin || 'N/A'}
        </div>
      </div>
      <div class="billing-info-right">
        <div class="billing-number-info">
          <strong>Billing Number:</strong> ${billingData.billingNumber || 'N/A'}
        </div>
        <div class="period-info">
          <strong>Period Covered:</strong> ${periodText}
        </div>
        <div class="generated-info">
          <strong>Date Generated:</strong> ${this.formatDate(billingData.createdDate)}
        </div>
        <div class="payment-status">
          <strong>Payment Status:</strong> ${billingData.paymentStatus || 'Pending'}
        </div>
      </div>
    </div>

    <!-- Trips Table -->
    <div class="trips-table-container">
      <table class="trips-table">
        <thead>
          <tr class="header-row">
            <th class="date-col">DATE</th>
            <th class="plate-col">TRUCK PLATE</th>
            <th class="destination-col">DESTINATION</th>
            <th class="rate-col">RATE</th>
            <th class="quantity-col">QUANTITY</th>
            <th class="total-col">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" class="total-label">TOTAL AMOUNT DUE:</td>
            <td class="total-amount">₱${this.formatCurrency(totals.totalAmount || 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Terms and Payment Info -->
    <div class="terms-section">
      <div class="terms-notes">
        <h3>Payment Terms</h3>
        <p>Payment is due within 30 days of invoice date.</p>
        <p>Please include billing number on all payments.</p>
      </div>
      <div class="prepared-by-info">
        <strong>Prepared by:</strong> ${billingData.preparedBy || 'MTM Enterprise'}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Generate table rows for billing trips
  static generateTripRows(trips, isForPDF = false) {
    if (!trips || trips.length === 0) {
      return `<tr><td colspan="6" class="no-data">No trips found for this billing period.</td></tr>`;
    }

    return trips.map((trip, index) => {
      const rowClass = index % 2 === 1 ? 'alt-row' : '';

      return `
        <tr class="${rowClass}">
          <td class="date-cell">${this.formatDate(trip.date)}</td>
          <td class="plate-cell">${trip.vehiclePlate || trip.vehicle_plate || trip.truckPlate || trip.truck_plate || ''}</td>
          <td class="destination-cell">${trip.destination || trip.fullDestination || ''}</td>
          <td class="rate-cell text-right">₱${this.formatCurrency(trip.rate || 0)}</td>
          <td class="quantity-cell text-center">${trip.quantity || trip.numberOfBags || trip.number_of_bags || 0}</td>
          <td class="total-cell text-right">₱${this.formatCurrency(trip.total || 0)}</td>
        </tr>`;
    }).join('');
  }

  // Shared CSS styles for billing PDF
  static getStyles(isForPDF = false) {
    const baseFontSize = isForPDF ? '11px' : '0.8rem';
    const padding = isForPDF ? '8px' : '0.4rem';

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Arial', sans-serif;
        color: #333;
        background: white;
        ${isForPDF ? 'padding: 20px;' : ''}
        line-height: 1.4;
      }

      .billing-container {
        max-width: ${isForPDF ? '800px' : 'none'};
        margin: 0 auto;
        padding: ${isForPDF ? '20px' : '1rem'};
        background: white;
      }

      .company-header {
        text-align: center;
        margin-bottom: 2rem;
        border-bottom: 2px solid #333;
        padding-bottom: 1rem;
      }

      .company-name {
        font-size: ${isForPDF ? '20px' : '1.5rem'};
        font-weight: bold;
        margin: 10px 0;
        letter-spacing: 1px;
        color: #1f2937;
      }

      .company-details {
        font-size: ${isForPDF ? '10px' : '0.75rem'};
        line-height: 1.3;
        margin-bottom: 15px;
      }

      .company-details p {
        margin: 2px 0;
      }

      .billing-title {
        font-size: ${isForPDF ? '16px' : '1.2rem'};
        font-weight: bold;
        margin: 15px 0;
        color: #dc2626;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .billing-info-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1.5rem;
        font-size: ${baseFontSize};
      }

      .billing-info-left, .billing-info-right {
        flex: 1;
      }

      .billing-info-left {
        text-align: left;
      }

      .billing-info-right {
        text-align: right;
      }

      .billing-number-info,
      .period-info,
      .generated-info,
      .payment-status {
        margin-bottom: 5px;
        font-weight: bold;
      }

      .client-info {
        margin-bottom: 10px;
        line-height: 1.4;
      }

      .trips-table-container {
        margin-bottom: 2rem;
      }

      .trips-table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${baseFontSize};
        border: 1px solid #999;
        margin: 0 auto;
      }

      .trips-table th {
        background: #f0f0f0;
        border: 1px solid #999;
        padding: ${padding};
        text-align: center;
        font-weight: bold;
      }

      .trips-table td {
        border: 1px solid #999;
        padding: ${padding};
        text-align: center;
      }

      .trips-table .alt-row {
        background: #fafafa;
      }

      .trips-table tfoot {
        font-weight: bold;
        background: #e0e0e0;
      }

      .trips-table .total-row td {
        padding: ${isForPDF ? '12px' : '0.6rem'};
        border-top: 2px solid #333;
      }

      .total-label {
        text-align: left;
        font-size: ${isForPDF ? '14px' : '1rem'};
        font-weight: bold;
      }

      .total-amount {
        text-align: right;
        font-size: ${isForPDF ? '14px' : '1rem'};
        color: #dc2626;
      }

      .no-data {
        text-align: center;
        font-style: italic;
        color: #666;
      }

      .terms-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #ccc;
      }

      .terms-notes {
        flex: 1;
        font-size: ${isForPDF ? '9px' : '0.75rem'};
        line-height: 1.4;
      }

      .terms-notes h3 {
        margin-bottom: 5px;
        font-weight: bold;
      }

      .prepared-by-info {
        text-align: right;
        font-weight: bold;
        font-size: ${baseFontSize};
      }

      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }

      @media print {
        @page {
          size: A4;
          margin: 15mm;
        }
        .billing-container {
          padding: 10mm;
          font-size: 10px;
        }
        .trips-table {
          font-size: 9px;
        }
        .trips-table th,
        .trips-table td {
          padding: 4px 2px;
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

module.exports = BillingRenderer;
