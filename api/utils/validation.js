// Validation utilities

// Helper function to parse deduction IDs that may be custom (e.g., "custom-123456789") or numeric
function parseDeductionId(idParam) {
  // Handle custom IDs like "custom-1764607349817"
  if (typeof idParam === 'string' && idParam.startsWith('custom-')) {
    const timestamp = idParam.substring(7); // Remove "custom-" prefix
    const parsedTimestamp = parseInt(timestamp);
    if (!isNaN(parsedTimestamp)) {
      // For custom IDs, we can't directly match a numeric ID, so we'll return the original
      // This is mainly for error handling purposes
      return { type: 'custom', value: idParam, timestamp: parsedTimestamp };
    }
  }

  // Handle regular numeric IDs
  if (!isNaN(parseInt(idParam))) {
    return { type: 'numeric', value: parseInt(idParam) };
  }

  // If neither, return string value for lookup
  return { type: 'string', value: idParam };
}

module.exports = { parseDeductionId };
