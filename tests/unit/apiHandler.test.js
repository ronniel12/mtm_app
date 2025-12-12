import apiHandler from '../../api/_lib/apiHandler.js';
import { mockQuery, resetDbMocks, mockSuccessfulQuery, mockFailedQuery } from '../mocks/db.js';

describe('Universal API Handler', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    resetDbMocks();

    // Reset mocks
    mockReq = {
      method: 'GET',
      url: '/',
      query: {},
      body: {},
      headers: {},
      parsedUrl: { pathname: '/', query: {} },
      json: jest.fn().mockResolvedValue({})
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      writeHead: jest.fn().mockReturnThis()
    };
  });

  describe('Method Validation', () => {
    test('should return 405 for unsupported HTTP method', async () => {
      const config = {
        schema: { GET: {} },
        handlers: { GET: jest.fn() }
      };

      mockReq.method = 'POST';

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockRes.status).toHaveBeenCalledWith(405);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Method POST not allowed'
      });
    });

    test('should accept supported HTTP methods', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { POST: {} },
        handlers: { POST: mockHandler }
      };

      mockReq.method = 'POST';

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
        body: {}
      });
    });
  });

  describe('Schema Validation', () => {
    test('should validate required body parameters', async () => {
      const config = {
        schema: { POST: { body: ['name', 'email'] } },
        handlers: { POST: jest.fn() }
      };

      mockReq.method = 'POST';
      mockReq.body = { name: 'John' }; // Missing email

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required body parameter: email'
      });
    });

    test('should pass validation with all required parameters', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { POST: { body: ['name', 'email'] } },
        handlers: { POST: mockHandler }
      };

      mockReq.method = 'POST';
      mockReq.body = { name: 'John', email: 'john@example.com' };

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalled();
    });

    test('should skip query parameter validation (optional)', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { GET: { query: ['startDate'] } },
        handlers: { GET: mockHandler }
      };

      mockReq.method = 'GET';
      mockReq.query = {}; // Missing startDate

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Body Parsing', () => {
    test('should parse JSON body successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { POST: {} },
        handlers: { POST: mockHandler }
      };

      const testBody = { name: 'John', age: 30 };
      mockReq.method = 'POST';
      mockReq.json = jest.fn().mockResolvedValue(testBody);

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
        body: testBody
      });
    });

    test('should handle body parsing errors gracefully', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { POST: {} },
        handlers: { POST: mockHandler }
      };

      mockReq.method = 'POST';
      mockReq.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));
      mockReq.body = {}; // Fallback

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
        body: {}
      });
    });

    test('should use existing body if json() not available', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { POST: {} },
        handlers: { POST: mockHandler }
      };

      const testBody = { name: 'John' };
      mockReq.method = 'POST';
      mockReq.body = testBody;
      delete mockReq.json;

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
        body: testBody
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle handler errors with 500 status', async () => {
      const config = {
        schema: { GET: {} },
        handlers: {
          GET: jest.fn().mockRejectedValue(new Error('Handler failed'))
        }
      };

      mockReq.method = 'GET';

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error'
      });
    });

    test('should handle validation errors with custom status', async () => {
      const config = {
        schema: { POST: { body: ['name'] } },
        handlers: { POST: jest.fn() }
      };

      mockReq.method = 'POST';
      mockReq.body = {}; // Missing name

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required body parameter: name'
      });
    });
  });

  describe('Vercel Compatibility', () => {
    test('should set parsedUrl if not present', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { GET: {} },
        handlers: { GET: mockHandler }
      };

      mockReq.method = 'GET';
      mockReq.url = '/api/test';
      delete mockReq.parsedUrl;

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockReq.parsedUrl).toEqual({
        pathname: '/api/test'
      });
    });

    test('should handle missing url gracefully', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const config = {
        schema: { GET: {} },
        handlers: { GET: mockHandler }
      };

      mockReq.method = 'GET';
      delete mockReq.url;
      delete mockReq.parsedUrl;

      await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockReq.parsedUrl).toEqual({
        pathname: '/'
      });
    });
  });

  describe('Handler Execution', () => {
    test('should execute handler with correct parameters', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      const config = {
        schema: { POST: {} },
        handlers: { POST: mockHandler }
      };

      const testBody = { data: 'test' };
      mockReq.method = 'POST';
      mockReq.body = testBody;

      const result = await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(mockHandler).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes,
        body: testBody
      });
      expect(result).toEqual({ success: true });
    });

    test('should handle async handlers', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        new Promise(resolve => setTimeout(() => resolve('async result'), 10))
      );
      const config = {
        schema: { GET: {} },
        handlers: { GET: mockHandler }
      };

      mockReq.method = 'GET';

      const result = await apiHandler({ req: mockReq, res: mockRes, ...config });

      expect(result).toBe('async result');
    });
  });
});