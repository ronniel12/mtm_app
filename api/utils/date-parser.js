// Date parsing utilities
function parseDateQuery(searchQuery) {
  const query = searchQuery.toLowerCase().trim();

  // Relative date patterns
  if (query === 'today') {
    return { type: 'exact', date: new Date().toISOString().split('T')[0] };
  }

  if (query === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { type: 'exact', date: yesterday.toISOString().split('T')[0] };
  }

  if (query === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { type: 'exact', date: tomorrow.toISOString().split('T')[0] };
  }

  if (query === 'this week') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return {
      type: 'range',
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    };
  }

  if (query === 'last week') {
    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    return {
      type: 'range',
      startDate: lastWeekStart.toISOString().split('T')[0],
      endDate: lastWeekEnd.toISOString().split('T')[0]
    };
  }

  if (query === 'this month') {
    const now = new Date();
    return {
      type: 'range',
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
    };
  }

  if (query === 'last month') {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      type: 'range',
      startDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${lastDayOfLastMonth.getDate()}`
    };
  }

  if (query === 'this year') {
    const now = new Date();
    return {
      type: 'range',
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`
    };
  }

  // Parse various date formats
  const datePatterns = [
    // ISO format: YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // US format: MM/DD/YYYY or M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // European format: DD/MM/YYYY or D/M/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // Dash format: YYYY-MM-DD, DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // Year only: YYYY
    /^(\d{4})$/,
    // Month and year: MM/YYYY
    /^(\d{1,2})\/(\d{4})$/
  ];

  for (let pattern of datePatterns) {
    const match = query.match(pattern);
    if (match) {
      if (pattern.source === '^(\\d{4})$') {
        // Year only
        const year = parseInt(match[1]);
        if (year >= 2010 && year <= 2030) {
          return {
            type: 'range',
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`
          };
        }
      } else if (pattern.source === '^(\\d{1,2})\\/(\\d{4})$') {
        // Month/Year format
        const month = parseInt(match[1]);
        const year = parseInt(match[2]);
        if (month >= 1 && month <= 12 && year >= 2010 && year <= 2030) {
          const lastDay = new Date(year, month, 0).getDate();
          return {
            type: 'range',
            startDate: `${year}-${String(month).padStart(2, '0')}-01`,
            endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`
          };
        }
      } else {
        // Try different date interpretations
        let day, month, year;

        if (match.length === 4 && match[4]) {
          // DD-MM-YYYY format
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[4]);
        } else if (pattern.source.includes('^(\\d{4})')) {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          // Try US format first (MM/DD/YYYY), then European (DD/MM/YYYY)
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          year = parseInt(match[3]);

          if (num1 > 12 && num1 <= 31 && num2 <= 12) {
            // First number > 12, likely DD/MM/YYYY (European)
            day = num1;
            month = num2;
          } else if (num1 <= 12 && num2 <= 31) {
            // Assume US format MM/DD/YYYY first
            month = num1;
            day = num2;
          } else {
            continue; // Invalid date
          }
        }

        if (year >= 2010 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Validate the date is actually valid
          const testDate = new Date(year, month - 1, day);
          if (testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day) {
            return {
              type: 'exact',
              date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            };
          }
        }
      }
    }
  }

  // Parse month names
  const monthNames = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12
  };

  for (const [monthName, monthNum] of Object.entries(monthNames)) {
    if (query.includes(monthName) || query.includes(monthName.substring(0, 3))) {
      const yearMatch = query.match(/(\d{4})/);
      const dayMatch = query.match(/(\d{1,2})(?:st|nd|rd|th)?\s+/);

      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (dayMatch) {
          // "January 15 2025" or "Jan 15 2025"
          const day = parseInt(dayMatch[1]);
          if (day >= 1 && day <= 31 && year >= 2010 && year <= 2030) {
            const testDate = new Date(year, monthNum - 1, day);
            if (testDate.getDate() === day) {
              return {
                type: 'exact',
                date: `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              };
            }
          }
        } else {
          // Just month and year: "January 2025" or "Jan 2025"
          if (year >= 2010 && year <= 2030) {
            const lastDay = new Date(year, monthNum, 0).getDate();
            return {
              type: 'range',
              startDate: `${year}-${String(monthNum).padStart(2, '0')}-01`,
              endDate: `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`
            };
          }
        }
      }
    }
  }

  return null; // Not a date
}

module.exports = { parseDateQuery };
