import { parseDeductionId } from '../../api/_lib/utils/validation.js';

describe('Validation Utilities', () => {
  describe('parseDeductionId', () => {
    test('should parse custom deduction IDs with timestamp', () => {
      const result = parseDeductionId('custom-1764607349817');

      expect(result).toEqual({
        type: 'custom',
        value: 'custom-1764607349817',
        timestamp: 1764607349817
      });
    });

    test('should parse numeric deduction IDs', () => {
      const result = parseDeductionId('123');

      expect(result).toEqual({
        type: 'numeric',
        value: 123
      });
    });

    test('should parse string deduction IDs', () => {
      const result = parseDeductionId('deduction-name');

      expect(result).toEqual({
        type: 'string',
        value: 'deduction-name'
      });
    });

    test('should handle edge cases', () => {
      expect(parseDeductionId('')).toEqual({
        type: 'string',
        value: ''
      });

      expect(parseDeductionId('0')).toEqual({
        type: 'numeric',
        value: 0
      });

      expect(parseDeductionId('custom-invalid')).toEqual({
        type: 'string',
        value: 'custom-invalid'
      });
    });

    test('should handle invalid custom IDs', () => {
      const result = parseDeductionId('custom-abc');

      expect(result).toEqual({
        type: 'string',
        value: 'custom-abc'
      });
    });
  });
});