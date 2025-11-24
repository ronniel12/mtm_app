import { computed } from 'vue'

// Shared payslip styling composable
export function usePayslipStyling(isForPDF = false) {

  // CSS variables for shared styling
  const payslipVars = computed(() => ({
    '--payslip-bg': 'white',
    '--payslip-text': '#000',
    '--border-color': '#000',
    '--header-bg': '#f0f0f0',
    '--total-bg': '#e0e0e0',
    '--deduction-bg': '#fff3cd',
    '--netpay-bg': '#d1ecf1',
    '--netpay-border': '#28a745',
    '--payslip-font': isForPDF ? 'Arial, sans-serif' : "'Courier New', monospace",
    '--primary-font-size': isForPDF ? '11px' : '0.75rem',
    '--table-font-size': isForPDF ? '10px' : '0.65rem',
    '--header-font-size': isForPDF ? '11px' : '0.60rem',
    '--company-font-size': isForPDF ? '18px' : '1.2rem',
    '--title-font-size': isForPDF ? '20px' : '1rem',
  }))

  // Shared CSS styles as a string
  const payslipStyles = computed(() => `
    :root {
      --payslip-bg: white;
      --payslip-text: #000;
      --border-color: #000;
      --header-bg: #f0f0f0;
      --total-bg: #e0e0e0;
      --deduction-bg: #fff3cd;
      --netpay-bg: #d1ecf1;
      --netpay-border: #28a745;
      --payslip-font: ${isForPDF ? 'Arial, sans-serif' : "'Courier New', monospace"};
      --primary-font-size: ${isForPDF ? '11px' : '0.75rem'};
      --table-font-size: ${isForPDF ? '10px' : '0.65rem'};
      --header-font-size: ${isForPDF ? '11px' : '0.60rem'};
      --company-font-size: ${isForPDF ? '18px' : '1.2rem'};
      --title-font-size: ${isForPDF ? '20px' : '1rem'};
    }

    .payslip-container {
      font-family: var(--payslip-font);
      color: var(--payslip-text);
      background: var(--payslip-bg);
      max-width: ${isForPDF ? '800px' : 'none'};
      margin: 0 auto;
      padding: ${isForPDF ? '20px' : '0'};
    }

    .company-header {
      text-align: center;
      margin-bottom: 1rem;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    .company-logo-section {
      flex-shrink: 0;
    }

    .company-logo {
      width: ${isForPDF ? '80px' : '100px'};
      height: ${isForPDF ? '80px' : '100px'};
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .company-name {
      font-size: var(--company-font-size);
      font-weight: bold;
      margin: 5px 0;
      letter-spacing: 1px;
      color: #1f2937;
    }

    .company-details {
      font-size: ${isForPDF ? '10px' : '0.7rem'};
      line-height: 1.2;
      margin-bottom: 10px;
      color: #6b7280;
    }

    .company-details p {
      margin: 1px 0;
    }

    .payslip-title {
      font-size: var(--title-font-size);
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
      font-size: var(--primary-font-size);
      align-items: flex-start;
    }

    .employee-info-left,
    .employee-info-right {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .employee-info-right {
      align-items: flex-end;
    }

    .employee-name-info,
    .employee-position-info,
    .payslip-number-info,
    .period-info,
    .generated-info {
      font-weight: bold;
    }

    .payslip-number-info,
    .period-info,
    .generated-info {
      text-align: right;
    }

    .payroll-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: var(--table-font-size);
      border: 1px solid var(--border-color);
      table-layout: auto;
      margin: 0 auto;
    }

    .payroll-table th {
      background: var(--header-bg);
      border: 1px solid var(--border-color);
      padding: ${isForPDF ? '8px' : '0.4rem 0.15rem'};
      text-align: center;
      font-weight: bold;
      font-size: var(--header-font-size);
      vertical-align: middle;
    }

    .payroll-table td {
      border: 1px solid var(--border-color);
      padding: ${isForPDF ? '6px' : '0.3rem 0.15rem'};
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
    .bags-cell { min-width: ${isForPDF ? '40px' : '40px'}; text-align: center; }
    .rate-cell { min-width: ${isForPDF ? '60px' : '60px'}; text-align: right; }
    .total-cell { min-width: ${isForPDF ? '70px' : '70px'}; text-align: right; }

    .totals-row {
      background: var(--total-bg);
      font-weight: bold;
      border: 2px solid var(--border-color);
      font-size: ${isForPDF ? '12px' : '0.7rem'};
    }

    .totals-row td {
      padding: ${isForPDF ? '10px' : '0.5rem 0.15rem'};
      border: none;
    }

    .individual-deduction-row {
      background: #fefefa;
      font-weight: normal;
      border: 1px solid var(--border-color);
      font-size: ${isForPDF ? '10px' : '0.65rem'};
    }

    .individual-deduction-row td {
      padding: ${isForPDF ? '6px' : '0.3rem 0.15rem'};
      border: none;
    }

    .total-deductions-row {
      background: var(--deduction-bg);
      font-weight: bold;
      border: 1px solid var(--border-color);
      font-size: ${isForPDF ? '12px' : '0.7rem'};
    }

    .total-deductions-row td {
      padding: ${isForPDF ? '8px' : '0.4rem 0.15rem'};
      border: none;
    }

    .net-pay-row {
      background: var(--netpay-bg);
      font-weight: bold;
      border: 2px solid var(--netpay-border);
      font-size: ${isForPDF ? '12px' : '0.7rem'};
    }

    .net-pay-row td {
      padding: ${isForPDF ? '10px' : '0.5rem 0.15rem'};
      border: none;
    }

    .prepared-by-section {
      margin-top: 20px;
      text-align: left;
      font-size: var(--primary-font-size);
      font-weight: bold;
    }

    @media print {
      @page {
        size: A4;
        margin: 8mm;
      }
      .payslip-container {
        padding: ${isForPDF ? '20px' : '6mm 5mm'};
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
        font-size: 9px;
      }
      .net-pay-row td {
        padding: 4px 1px;
        font-size: 10px;
      }
      .individual-deduction-row td {
        padding: 2px 1px;
        font-size: 8px;
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
      .payroll-table .header-row th:nth-child(8),
      .payroll-table .data-row td:nth-child(8) {
        min-width: 100px;
      }
      .payroll-table .header-row th:nth-child(9),
      .payroll-table .data-row td:nth-child(9) {
        min-width: 70px;
      }
      .payroll-table .header-row th:nth-child(10),
      .payroll-table .data-row td:nth-child(10) {
        min-width: 90px;
      }
    }
  `)

  // Return reactive values
  return {
    payslipVars,
    payslipStyles
  }
}
