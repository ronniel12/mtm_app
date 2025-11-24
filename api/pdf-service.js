const puppeteer = require('puppeteer');
const { put } = require('@vercel/blob');
require('dotenv').config();

class PDFService {
  static async generatePayslipPDF(payslipData) {
    try {
      console.log('📄 Starting PDF generation for payslip:', payslipData.payslipNumber);

      // Launch puppeteer browser
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      // Generate HTML content for the payslip
      const htmlContent = this.generatePayslipHTML(payslipData);

      // Set content and generate PDF
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });

      // Generate PDF buffer
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      // Close browser
      await browser.close();

      console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');

      return pdfBuffer;

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  static generatePayslipHTML(payslipData) {
    const employee = payslipData.employee || { name: 'Employee Name' };
    const period = payslipData.period || {};
    const totals = payslipData.totals || {};
    const deductions = payslipData.deductions || [];
    const trips = payslipData.trips || [];

    // Calculate period text
    const periodText = period.periodText || (period.startDate && period.endDate ?
      `${this.formatDate(period.startDate)} to ${this.formatDate(period.endDate)}` :
      'Pay Period');

    // Generate table rows for trips
    let tableRows = '';
    trips.forEach((trip) => {
      tableRows += `
        <tr style="background: white;">
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${this.formatDate(trip.date)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.truckPlate}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.invoiceNumber}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.destination}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${trip.numberOfBags}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip.rate ? this.formatCurrency(trip.rate) : '0.00'}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${trip.total ? this.formatCurrency(trip.total) : '0.00'}</td>
        </tr>`;
    });

    // Generate deductions rows
    let deductionRows = '';
    if (deductions && deductions.length > 0) {
      deductions.forEach(deduction => {
        const deductionAmount = deduction.type === 'percentage'
          ? (totals.grossPay || 0) * (deduction.value / 100)
          : deduction.value;
        deductionRows += `
          <tr style="background: #fffefa; font-size: 9px;">
            <td colspan="6" style="border: 1px solid #000; padding: 4px 8px; text-align: left; color: #666;">${deduction.name} (${deduction.type === 'percentage' ? deduction.value + '%' : '₱' + this.formatCurrency(deduction.value)}):</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: right; color: #dc3545;">-₱${this.formatCurrency(deductionAmount)}</td>
          </tr>`;
      });

      deductionRows += `
        <tr style="background: #fff3cd; font-weight: bold;">
          <td colspan="6" style="border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; color: #856404;">TOTAL DEDUCTIONS:</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; color: #dc3545;">-₱${this.formatCurrency(totals.totalDeductions || 0)}</td>
        </tr>
        <tr style="background: #d1ecf1; font-weight: bold; border: 2px solid #28a745;">
          <td colspan="6" style="border: 2px solid #28a745; padding: 8px; text-align: left; font-size: 12px; color: #0c5460;">NET PAY:</td>
          <td style="border: 2px solid #28a745; padding: 8px; text-align: right; font-size: 14px; color: #28a745;">₱${this.formatCurrency(totals.netPay || 0)}</td>
        </tr>`;
    } else {
      deductionRows = `
        <tr style="background: #d1ecf1; font-weight: bold; border: 2px solid #28a745;">
          <td colspan="6" style="border: 2px solid #28a745; padding: 8px; text-align: left; font-size: 12px; color: #0c5460;">NET PAY:</td>
          <td style="border: 2px solid #28a745; padding: 8px; text-align: right; font-size: 14px; color: #28a745;">₱${this.formatCurrency(totals.netPay || 0)}</td>
        </tr>`;
    }

    const employeeInfo = `<strong>Employee Name:</strong> ${employee.name}<br>
<strong>Payslip Number:</strong> ${payslipData.payslipNumber}<br>
<strong>Period Covered:</strong> ${periodText}<br>
<strong>Date Generated:</strong> ${this.formatDate(payslipData.createdDate)}`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payslip - ${payslipData.payslipNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            color: #000;
            line-height: 1.4;
            background: white;
            padding: 20px;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }

          .company-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding: 20px 0;
            margin-bottom: 20px;
            gap: 20px;
          }

          .company-logo-section {
            flex-shrink: 0;
          }

          .company-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .company-info-section {
            flex: 1;
            text-align: center;
          }

          .company-name {
            font-size: 18px;
            font-weight: bold;
            margin: 5px 0;
            letter-spacing: 1px;
            color: #1f2937;
          }

          .company-details {
            font-size: 10px;
            line-height: 1.2;
            margin-bottom: 10px;
            color: #6b7280;
          }

          .company-details p {
            margin: 1px 0;
          }

          .payslip-title-section {
            flex-shrink: 0;
          }

          .payslip-title {
            font-size: 20px;
            font-weight: bold;
            margin: 15px 0;
            color: #dc2626;
            text-transform: uppercase;
            letter-spacing: 2px;
          }

          .employee-info {
            margin: 15px 0;
            line-height: 1.6;
            font-size: 11px;
          }

          .payslip-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 10px;
            font-family: Arial, sans-serif;
          }

          .payslip-table th {
            background: #f0f0f0;
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            font-weight: bold;
          }

          .payslip-table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: center;
          }

          .payslip-table td:nth-child(1) { text-align: center; }
          .payslip-table td:nth-child(2) { text-align: center; }
          .payslip-table td:nth-child(3) { text-align: center; }
          .payslip-table td:nth-child(4) { text-align: center; }
          .payslip-table td:nth-child(5) { text-align: center; }
          .payslip-table td:nth-child(6) { text-align: right; }
          .payslip-table td:nth-child(7) { text-align: right; }

          .gross-pay-row {
            background: #e0e0e0;
            font-weight: bold;
          }

          .gross-pay-row td {
            font-size: 12px;
          }

          .gross-pay-row td:nth-child(4) {
            text-align: center;
            font-size: 14px;
          }

          .gross-pay-row td:nth-child(5) {
            text-align: center;
          }

          .gross-pay-row td:nth-child(6) {
            text-align: center;
          }

          .gross-pay-row td:nth-child(7) {
            text-align: right;
            font-size: 14px;
          }

          .footer {
            margin-top: 20px;
            text-align: left;
          }

          .prepared-by {
            padding: 15px 10px;
            font-size: 11px;
          }

          @media print {
            body { 
              print-color-adjust: exact; 
              margin: 0; 
              padding: 6mm 5mm; 
              font-size: 9px; 
              line-height: 1.2; 
            }
            .container { 
              max-width: none; 
              margin: 0; 
            }
            .payslip-table { 
              font-size: 9px; 
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="company-header">
            <div class="company-logo-section">
              <img src="data:image/jpeg;base64,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" alt="MTM Enterprise Logo" class="company-logo" />
            </div>
            <div class="company-info-section">
              <h1 class="company-name">MTM ENTERPRISE</h1>
              <div class="company-details">
                <p>0324 P. Damaso St. Virgen Delas Flores Baliuag Bulacan</p>
                <p>TIN # 175-434-337-000</p>
                <p>Mobile No. 09605638462 / Telegram No. +358-044-978-8592</p>
              </div>
            </div>
            <div class="payslip-title-section">
              <h2 class="payslip-title">PAYSLIP</h2>
            </div>
          </header>

          <div class="employee-info">
            ${employeeInfo}
          </div>

          <table class="payslip-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>TRUCK PLATE</th>
                <th>INVOICE NUMBER</th>
                <th>DESTINATION</th>
                <th>BAGS</th>
                <th>RATE/BAG</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="gross-pay-row">
                <td colspan="4" style="border: 2px solid #000; padding: 10px; text-align: left; font-size: 12px;">GROSS PAY:</td>
                <td style="border: 2px solid #000; padding: 10px; text-align: center; font-size: 14px;">${totals.totalBags || 0}</td>
                <td style="border: 2px solid #000; padding: 10px; text-align: center;"></td>
                <td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 14px;">₱${this.formatCurrency(totals.grossPay || 0)}</td>
              </tr>
              ${deductionRows}
              <tr>
                <td colspan="7" class="prepared-by">
                  <strong>Prepared by:</strong> ${payslipData.preparedBy || '_______________________________'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  static async uploadToBlob(pdfBuffer, payslipNumber) {
    try {
      console.log('☁️ Starting blob upload for payslip:', payslipNumber);

      // Create a unique filename
      const filename = `payslip-${payslipNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;

      // Upload to Vercel Blob
      const blob = await put(filename, pdfBuffer, {
        contentType: 'application/pdf',
        access: 'public' // Makes it publicly accessible
      });

      console.log('✅ Successfully uploaded to blob:', blob.url);

      return {
        url: blob.url,
        filename: filename,
        size: pdfBuffer.length
      };

    } catch (error) {
      console.error('❌ Blob upload failed:', error);
      throw new Error(`Blob upload failed: ${error.message}`);
    }
  }

  static async generatePDFOnly(payslipData) {
    try {
      console.log('📄 Starting PDF generation only (no upload):', payslipData.payslipNumber);

      // Generate PDF buffer
      const pdfBuffer = await this.generatePayslipPDF(payslipData);

      console.log('✅ PDF generated locally, no upload');

      return {
        pdfGenerated: true,
        filename: `${payslipData.payslipNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`,
        size: pdfBuffer.length
      };

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      return {
        pdfGenerated: false,
        error: error.message
      };
    }
  }

  static async generateAndUploadPDF(payslipData) {
    try {
      console.log('🚀 Starting complete PDF workflow for:', payslipData.payslipNumber);

      // Generate PDF
      const pdfBuffer = await this.generatePayslipPDF(payslipData);

      // Upload to blob storage
      const blobResult = await this.uploadToBlob(pdfBuffer, payslipData.payslipNumber);

      console.log('🎉 PDF generation and upload completed successfully');

      return {
        pdfGenerated: true,
        blobUrl: blobResult.url,
        filename: blobResult.filename,
        size: blobResult.size
      };

    } catch (error) {
      console.error('❌ PDF generation and upload failed:', error);
      return {
        pdfGenerated: false,
        error: error.message
      };
    }
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

module.exports = PDFService;
