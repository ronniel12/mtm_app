-- Migration: Add employee_deduction_configs table for flexible deduction scheduling per employee

-- Create the employee_deduction_configs table
CREATE TABLE IF NOT EXISTS employee_deduction_configs (
    id SERIAL PRIMARY KEY,
    employee_uuid VARCHAR(36) REFERENCES employees(uuid) ON DELETE CASCADE,
    deduction_id INTEGER REFERENCES deductions(id) ON DELETE CASCADE,
    apply_mode VARCHAR(50) DEFAULT 'never',
    -- Modes: 'never' (no deduction), 'always' (all payslips), 'selected_dates' (custom calendar)

    date_config JSONB, -- Flexible storage for date selections, recurring rules, etc.
    /*
    Examples:
    For selected_dates mode:
    {
      "selected_dates": ["2025-01-15", "2025-01-31", "2025-02-15"],
      "recurring_rules": [{"pattern": "month-day-15"}, {"pattern": "month-last-day"}]
    }

    For recurring mode (future use):
    {
      "frequency": "monthly",
      "days": [15, 31]
    }
    */

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_uuid, deduction_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_deduction_configs_employee_uuid
ON employee_deduction_configs(employee_uuid);

CREATE INDEX IF NOT EXISTS idx_employee_deduction_configs_employee_deduction_id
ON employee_deduction_configs(deduction_id);

CREATE INDEX IF NOT EXISTS idx_employee_deduction_configs_apply_mode
ON employee_deduction_configs(apply_mode);

-- Add GIN index for JSONB querying
CREATE INDEX IF NOT EXISTS idx_employee_deduction_configs_date_config
ON employee_deduction_configs USING GIN(date_config);
