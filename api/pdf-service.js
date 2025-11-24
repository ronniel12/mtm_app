const puppeteer = require('puppeteer');
const { put } = require('@vercel/blob');
const PayslipRenderer = require('./payslip-renderer');
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

      // Generate HTML content using the shared renderer
      const htmlContent = PayslipRenderer.generatePayslipHTML(payslipData, true);

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

      await browser.close();
      console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  static async uploadToBlob(pdfBuffer, payslipNumber) {
    try {
      console.log('☁️ Starting blob upload for payslip:', payslipNumber);

      // Create organized folder structure within existing payslips folder
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM format (01-12)

      const filename = `payslips/${year}/${month}/payslip-${payslipNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;

      const blob = await put(filename, pdfBuffer, {
        contentType: 'application/pdf',
        access: 'public'
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
    return await this.generatePayslipPDF(payslipData);
  }

  static async generateAndUploadPDF(payslipData) {
    try {
      const pdfBuffer = await this.generatePayslipPDF(payslipData);
      const blobResult = await this.uploadToBlob(pdfBuffer, payslipData.payslipNumber);

      return {
        pdfGenerated: true,
        blobUrl: blobResult.url,
        filename: blobResult.filename,
        size: blobResult.size
      };

    } catch (error) {
      return {
        pdfGenerated: false,
        error: error.message
      };
    }
  }
}

module.exports = PDFService;
