const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { put } = require('@vercel/blob');
const PayslipRenderer = require('./payslip-renderer');
const BillingRenderer = require('./billing-renderer');
require('dotenv').config();

// Function to detect if running in Vercel serverless environment
const isVercelServerless = () => {
  return process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV;
};

class PDFService {
  static async getBrowserConfig() {
    // Environment detection
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = isVercelServerless();

    if (isVercel) {
      console.log('🌐 Running in Vercel serverless environment');
      return {
        executablePath: await chromium.executablePath(),
        args: chromium.args,
        headless: chromium.headless
      };
    } else {
      console.log('💻 Running locally');
      return {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-sm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
    }
  }

  static async generatePayslipPDF(payslipData) {
    let browser = null;
    try {
      console.log('📄 Starting PDF generation for payslip:', payslipData.payslipNumber);

      // Get browser configuration based on environment
      const browserConfig = await this.getBrowserConfig();
      browser = await puppeteer.launch(browserConfig);

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
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('Could not close browser:', closeError.message);
        }
      }
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

  // Billing PDF methods
  static async generateBillingPDF(billingData) {
    let browser = null;
    try {
      console.log('📄 Starting PDF generation for billing:', billingData.billingNumber);

      // Get browser configuration based on environment
      const browserConfig = await this.getBrowserConfig();
      browser = await puppeteer.launch(browserConfig);

      const page = await browser.newPage();

      // Generate HTML content using the billing renderer
      const htmlContent = BillingRenderer.generateBillingHTML(billingData, true);

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
      console.log('✅ Billing PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;

    } catch (error) {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('Could not close browser:', closeError.message);
        }
      }
      console.error('❌ Billing PDF generation failed:', error);
      throw new Error(`Billing PDF generation failed: ${error.message}`);
    }
  }

  static async uploadBillingToBlob(pdfBuffer, billingNumber) {
    try {
      console.log('☁️ Starting blob upload for billing:', billingNumber);

      // Create organized folder structure within existing billings folder
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM format (01-12)

      const filename = `billings/${year}/${month}/billing-${billingNumber.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;

      const blob = await put(filename, pdfBuffer, {
        contentType: 'application/pdf',
        access: 'public'
      });

      console.log('✅ Successfully uploaded billing to blob:', blob.url);
      return {
        url: blob.url,
        filename: filename,
        size: pdfBuffer.length
      };

    } catch (error) {
      console.error('❌ Billing blob upload failed:', error);
      throw new Error(`Billing blob upload failed: ${error.message}`);
    }
  }

  static async generateAndUploadBillingPDF(billingData) {
    try {
      const pdfBuffer = await this.generateBillingPDF(billingData);
      const blobResult = await this.uploadBillingToBlob(pdfBuffer, billingData.billingNumber);

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
