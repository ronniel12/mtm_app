import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export function useClientPayslipPDF() {

  /**
   * Generate PDF from a DOM element
   * @param {HTMLElement} element - The element to convert to PDF
   * @param {Object} payslipData - Payslip data object
   * @param {Object} options - Additional options
   * @returns {Promise<Blob>} - PDF blob
   */
  const generatePDF = async (element, payslipData, options = {}) => {
    if (!element) {
      throw new Error('DOM element is required for PDF generation')
    }

    const {
      margin = 10,
      filename = `payslip-${payslipData?.payslipNumber || 'unknown'}.pdf`,
      download = true,
      returnBlob = false
    } = options

    try {
      // Wait for fonts and images to load
      await document.fonts.ready

      // Small delay to ensure Vue component is fully rendered
      await new Promise(resolve => setTimeout(resolve, 500))

      // Make element temporarily visible if hidden (for modal rendering)
      const originalDisplay = element.style.display
      const originalVisibility = element.style.visibility
      if (element.style.display === 'none') {
        element.style.display = 'block'
        element.style.visibility = 'hidden'
        element.style.position = 'absolute'
        element.style.left = '-9999px'
        element.style.top = '-9999px'
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Configure html2canvas options for better quality and reliability
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reasonable resolution
        useCORS: true,
        allowTaint: false, // Don't allow tainted canvases
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        logging: false,
        removeContainer: true,
        imageTimeout: 5000,
        // Timeout to prevent hanging
        timeout: 15000,
        // Force font loading
        letterRendering: true,
        // Better text rendering
        foreignObjectRendering: false
      })

      // Restore original display if it was changed
      if (originalDisplay !== '') {
        element.style.display = originalDisplay
        element.style.visibility = originalVisibility
        element.style.position = ''
        element.style.left = ''
        element.style.top = ''
      }

      // Get canvas dimensions
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 - (margin * 2) // A4 width in mm minus margins
      const pageHeight = 295 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Create PDF
      const pdf = new jsPDF({
        orientation: imgHeight > pageHeight ? 'portrait' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      let heightLeft = imgHeight
      let position = margin

      // Add first page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - margin

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= pageHeight - margin
      }

      // Return blob if requested
      if (returnBlob) {
        return pdf.output('blob')
      }

      // Download PDF
      if (download) {
        pdf.save(filename)
        return true
      }

      return pdf

    } catch (error) {
      console.error('Error generating PDF:', error)
      throw new Error(`PDF generation failed: ${error.message}`)
    }
  }

  /**
   * Generate PDF and return blob URL for preview/opening
   * @param {HTMLElement} element - The element to convert
   * @param {Object} payslipData - Payslip data
   * @returns {Promise<string>} - Blob URL
   */
  const generatePDFBlobURL = async (element, payslipData) => {
    const pdfBlob = await generatePDF(element, payslipData, {
      download: false,
      returnBlob: true
    })

    return URL.createObjectURL(pdfBlob)
  }

  /**
   * Open PDF in new tab
   * @param {HTMLElement} element - The element to convert
   * @param {Object} payslipData - Payslip data
   */
  const openPDFInNewTab = async (element, payslipData) => {
    try {
      const blobURL = await generatePDFBlobURL(element, payslipData)
      window.open(blobURL, '_blank')
      return true
    } catch (error) {
      console.error('Error opening PDF in new tab:', error)
      throw error
    }
  }

  /**
   * Download PDF
   * @param {HTMLElement} element - The element to convert
   * @param {Object} payslipData - Payslip data
   */
  const downloadPDF = async (element, payslipData) => {
    try {
      await generatePDF(element, payslipData, {
        download: true,
        returnBlob: false
      })
      return true
    } catch (error) {
      console.error('Error downloading PDF:', error)
      throw error
    }
  }

  return {
    generatePDF,
    generatePDFBlobURL,
    openPDFInNewTab,
    downloadPDF
  }
}
