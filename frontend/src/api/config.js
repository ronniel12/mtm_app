// API Configuration
// Centralized API base URL configuration for easy maintenance and scaling

// In production (Vercel), use relative API path
// In development (Vercel dev), use relative API path
// In local development, use localhost or configured URL
export const API_BASE_URL = import.meta.env.PROD
  ? '/'  // Production: root path, Vercel routes /api/* to serverless functions
  : (import.meta.env.VITE_API_BASE_URL || '/api')  // Development: relative path for Vercel dev

// API endpoints
export const API_ENDPOINTS = {
  // Trips
  TRIPS: `${API_BASE_URL}/trips`,
  TRIPS_CALCULATED: `${API_BASE_URL}/trips/calculated`,
  TRIPS_SUGGESTIONS: `${API_BASE_URL}/trips/suggestions`,

  // Employees
  EMPLOYEES: `${API_BASE_URL}/employees`,

  // Rates
  RATES: `${API_BASE_URL}/rates`,
  RATES_SEARCH: `${API_BASE_URL}/rates/search`,

  // Vehicles
  VEHICLES: `${API_BASE_URL}/vehicles`,

  // Billings
  BILLINGS: `${API_BASE_URL}/billings`,

  // Payslips
  PAYSLIPS: `${API_BASE_URL}/payslips`,

  // Deductions
  DEDUCTIONS: `${API_BASE_URL}/deductions`,

  // Expenses
  EXPENSES: `${API_BASE_URL}/expenses`,

  // Fuel
  FUEL: `${API_BASE_URL}/fuel`,

  // Tolls
  TOLLS_CALCULATE: `${API_BASE_URL}/tolls/calculate`,

  // Employee Deduction Configs
  EMPLOYEE_DEDUCTION_CONFIGS: `${API_BASE_URL}/employee-deduction-configs`,
  EMPLOYEE_DEDUCTION_CONFIGS_MATRIX: `${API_BASE_URL}/employee-deduction-configs/matrix`
}

// Helper function to create axios instance with base URL
export const createApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`
}
