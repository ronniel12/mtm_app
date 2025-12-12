import employeesHandler from '../../api/employees.js';
import { mockQuery, resetDbMocks, mockSuccessfulQuery, mockFailedQuery } from '../mocks/db.js';

describe('Employees API', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    resetDbMocks();

    mockReq = {
      method: 'GET',
      url: '/api/employees',
      query: {},
      body: {},
      headers: {},
      parsedUrl: { pathname: '/api/employees', query: {} },
      json: jest.fn().mockResolvedValue({})
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      writeHead: jest.fn().mockReturnThis()
    };
  });

  describe('GET /api/employees - List employees', () => {
    test('should return paginated employee list', async () => {
      const mockEmployees = [
        {
          uuid: 'emp-1',
          name: 'John Doe',
          phone: '+1234567890',
          license_number: 'LIC123',
          pagibig_number: 'PAG123',
          sss_number: 'SSS123',
          philhealth_number: 'PHIL123',
          address: 'Test Address',
          cash_advance: 1000,
          loans: 500,
          auto_deduct_cash_advance: true,
          auto_deduct_loans: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSuccessfulQuery([{ total: 1 }]); // Count query
      mockSuccessfulQuery(mockEmployees); // Data query

      mockReq.query = { page: '1', limit: '10' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.employees).toHaveLength(1);
      expect(responseData.employees[0]).toMatchObject({
        uuid: 'emp-1',
        name: 'John Doe',
        phone: '+1234567890'
      });
      expect(responseData.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
    });

    test('should handle pagination parameters', async () => {
      mockSuccessfulQuery([{ total: 25 }]);
      mockSuccessfulQuery([]);

      mockReq.query = { page: '2', limit: '10' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.pagination.page).toBe(2);
      expect(responseData.pagination.limit).toBe(10);
      expect(responseData.pagination.hasPrev).toBe(true);
    });
  });

  describe('GET /api/employees/:uuid - Single employee', () => {
    beforeEach(() => {
      mockReq.parsedUrl.pathname = '/api/employees/emp-123';
    });

    test('should return single employee data', async () => {
      const mockEmployee = {
        uuid: 'emp-123',
        name: 'Jane Smith',
        phone: '+0987654321',
        license_number: 'LIC456'
      };

      mockSuccessfulQuery([mockEmployee]);

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData).toEqual(mockEmployee);
    });

    test('should return 404 for non-existent employee', async () => {
      mockSuccessfulQuery([]); // No employee found

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Employee not found'
      });
    });
  });

  describe('GET /api/employee/:pin/payslips - Employee payslips via PIN', () => {
    beforeEach(() => {
      mockReq.parsedUrl.pathname = '/api/employee/1234/payslips';
      mockReq.query = { page: '1' };
    });

    test('should return 400 for invalid PIN format', async () => {
      mockReq.parsedUrl.pathname = '/api/employee/12345/payslips'; // 5 digits

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid PIN format'
      });
    });

    test('should return 404 for non-existent employee PIN', async () => {
      mockSuccessfulQuery([]); // No employee with PIN

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Employee not found or invalid PIN'
      });
    });

    test('should return employee payslips with calculations', async () => {
      const mockEmployee = {
        uuid: 'emp-123',
        name: 'John Doe',
        access_pin: '1234',
        cash_advance: 1000,
        auto_deduct_cash_advance: true,
        loans: 500,
        auto_deduct_loans: true
      };

      const mockPayslips = [{
        id: 1,
        payslip_number: 'PSL001',
        employee_uuid: 'emp-123',
        period_start: '2024-01-01',
        period_end: '2024-01-15',
        gross_pay: 5000,
        deductions: '[]',
        net_pay: 4500,
        status: 'completed',
        created_date: '2024-01-16T00:00:00Z',
        details: JSON.stringify({
          deductions: [
            { name: 'Tax', type: 'standard', calculatedAmount: 500 }
          ],
          period: {
            periodText: 'Jan 1-15, 2024'
          }
        })
      }];

      mockSuccessfulQuery([mockEmployee]); // Employee lookup
      mockSuccessfulQuery([{ total: 1 }]); // Payslip count
      mockSuccessfulQuery(mockPayslips); // Payslip data

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.employee.name).toBe('John Doe');
      expect(responseData.payslips).toHaveLength(1);
      expect(responseData.payslips[0]).toMatchObject({
        id: 1,
        payslipNumber: 'PSL001',
        employeeName: 'John Doe',
        grossPay: 5000,
        totalDeductions: 1500, // 500 + 1000 (cash advance)
        netPay: 3500 // 5000 - 1500
      });
    });

    test('should include employee-specific deductions', async () => {
      const mockEmployee = {
        uuid: 'emp-123',
        name: 'John Doe',
        cash_advance: 1000,
        auto_deduct_cash_advance: true,
        loans: 200,
        auto_deduct_loans: true
      };

      const mockPayslips = [{
        id: 1,
        gross_pay: 5000,
        deductions: '[]',
        details: JSON.stringify({
          deductions: [
            { name: 'Tax', type: 'standard', calculatedAmount: 300 }
          ]
        })
      }];

      mockSuccessfulQuery([mockEmployee]);
      mockSuccessfulQuery([{ total: 1 }]);
      mockSuccessfulQuery(mockPayslips);

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      const payslip = responseData.payslips[0];

      // Should include employee-specific deductions
      const employeeDeductions = payslip.deductions.filter(d => d.isEmployeeSpecific);
      expect(employeeDeductions).toHaveLength(2);
      expect(employeeDeductions.find(d => d.name === 'Cash Advance')).toBeTruthy();
      expect(employeeDeductions.find(d => d.name === 'Loans')).toBeTruthy();
    });
  });

  describe('GET /api/employees/matrix - Deduction matrix', () => {
    beforeEach(() => {
      mockReq.parsedUrl.pathname = '/api/employees/matrix';
    });

    test('should return deduction matrix configuration', async () => {
      const mockEmployees = [
        { uuid: 'emp-1', name: 'Employee 1' },
        { uuid: 'emp-2', name: 'Employee 2' }
      ];

      const mockDeductions = [
        { id: 1, name: 'Tax', type: 'standard', value: 10 },
        { id: 2, name: 'Insurance', type: 'standard', value: 5 }
      ];

      const mockConfigs = [
        { employee_uuid: 'emp-1', deduction_id: 1, apply_mode: 'always', date_config: null },
        { employee_uuid: 'emp-2', deduction_id: 2, apply_mode: 'never', date_config: null }
      ];

      mockSuccessfulQuery(mockEmployees);
      mockSuccessfulQuery(mockDeductions);
      mockSuccessfulQuery(mockConfigs);

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.employees).toHaveLength(2);
      expect(responseData.deductions).toHaveLength(2);
      expect(responseData.matrix).toHaveLength(2);

      // Check matrix structure
      const emp1Matrix = responseData.matrix[0];
      expect(emp1Matrix.employee.name).toBe('Employee 1');
      expect(emp1Matrix.configs).toHaveLength(2);
      expect(emp1Matrix.configs[0].config.apply_mode).toBe('always');
    });
  });

  describe('POST /api/employees - Create employee', () => {
    beforeEach(() => {
      mockReq.method = 'POST';
    });

    test('should return 400 when name is missing', async () => {
      mockReq.body = { phone: '+1234567890' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Name is required'
      });
    });

    test('should create employee successfully', async () => {
      const newEmployeeData = {
        name: 'New Employee',
        phone: '+1234567890',
        licenseNumber: 'LIC789',
        cashAdvance: 500,
        loans: 200
      };

      const mockCreatedEmployee = {
        uuid: 'new-uuid',
        name: 'New Employee',
        phone: '+1234567890',
        license_number: 'LIC789',
        cash_advance: 500,
        loans: 200
      };

      mockSuccessfulQuery([mockCreatedEmployee]);

      mockReq.body = newEmployeeData;

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockCreatedEmployee);
    });

    test('should generate UUID if not provided', async () => {
      const newEmployeeData = { name: 'Test Employee' };

      mockSuccessfulQuery([{
        uuid: expect.any(String), // Should be generated
        name: 'Test Employee'
      }]);

      mockReq.body = newEmployeeData;

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('PUT /api/employees/:uuid - Update employee', () => {
    beforeEach(() => {
      mockReq.method = 'PUT';
      mockReq.parsedUrl.pathname = '/api/employees/emp-123';
    });

    test('should update employee successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '+0987654321',
        cashAdvance: 1500
      };

      const mockUpdatedEmployee = {
        uuid: 'emp-123',
        name: 'Updated Name',
        phone: '+0987654321',
        cash_advance: 1500
      };

      mockSuccessfulQuery([mockUpdatedEmployee]);

      mockReq.body = updateData;

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData).toEqual(mockUpdatedEmployee);
    });

    test('should return 404 for non-existent employee', async () => {
      mockSuccessfulQuery([]); // No employee found

      mockReq.body = { name: 'Updated Name' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Employee not found'
      });
    });
  });

  describe('PUT /api/employees/:uuid/pin - Update PIN', () => {
    beforeEach(() => {
      mockReq.method = 'PUT';
      mockReq.parsedUrl.pathname = '/api/employees/emp-123/pin';
    });

    test('should return 400 for invalid PIN format', async () => {
      mockReq.body = { pin: '12345' }; // 5 digits

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'PIN must be exactly 4 digits'
      });
    });

    test('should return 400 when PIN already exists', async () => {
      mockSuccessfulQuery([{ uuid: 'other-emp' }]); // Existing PIN

      mockReq.body = { pin: '1234' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'This PIN is already in use by another employee'
      });
    });

    test('should update PIN successfully', async () => {
      mockSuccessfulQuery([]); // No existing PIN
      mockSuccessfulQuery([{
        uuid: 'emp-123',
        name: 'Test Employee',
        access_pin: '1234'
      }]);

      mockReq.body = { pin: '1234' };

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.end).toHaveBeenCalled();
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.message).toBe('PIN updated successfully');
      expect(responseData.employee.access_pin).toBe('1234');
    });
  });

  describe('DELETE /api/employees/:uuid - Delete employee', () => {
    beforeEach(() => {
      mockReq.method = 'DELETE';
      mockReq.parsedUrl.pathname = '/api/employees/emp-123';
    });

    test('should delete employee successfully', async () => {
      mockSuccessfulQuery([{
        uuid: 'emp-123',
        name: 'Test Employee'
      }]);

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Employee deleted successfully'
      });
    });

    test('should return 404 for non-existent employee', async () => {
      mockSuccessfulQuery([]); // No employee found

      await employeesHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Employee not found'
      });
    });
  });
});