// Test setup for serverless API testing
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';

// Global test utilities
global.testUtils = {
  // Helper to create mock request/response objects
  createMockReq: (overrides = {}) => ({
    method: 'GET',
    url: '/',
    query: {},
    body: {},
    headers: {},
    parsedUrl: { pathname: '/', query: {} },
    json: () => Promise.resolve({}),
    ...overrides
  }),

  createMockRes: (overrides = {}) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      writeHead: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      ...overrides
    };
    return res;
  },

  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestId: () => Math.floor(Math.random() * 1000000),

  // Common test data
  testEmployee: {
    uuid: 'test-employee-uuid',
    name: 'Test Employee',
    phone: '+1234567890',
    licenseNumber: 'TEST123',
    pagibigNumber: '123456789',
    sssNumber: '1234567890',
    philhealthNumber: '123456789012',
    address: 'Test Address',
    cashAdvance: 1000,
    loans: 500,
    autoDeductCashAdvance: true,
    autoDeductLoans: true
  },

  testTrip: {
    date: '2024-01-15',
    truckPlate: 'TEST123',
    invoiceNumber: 'INV001',
    origin: 'Test Origin',
    farmName: 'Test Farm',
    destination: 'Test Destination',
    fullDestination: 'Test Full Destination',
    rateLookupKey: 'test-key',
    status: 'Pending',
    driver: 'test-driver-uuid',
    helper: 'test-helper-uuid',
    numberOfBags: 100,
    foodAllowance: 450,
    computedToll: 100,
    roundtripToll: 200,
    actualTollExpense: 150
  }
};

// Setup console spy to reduce noise during tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console after tests
  Object.assign(console, originalConsole);
});