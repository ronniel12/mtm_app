-- PHASE 1: Create Tables
-- Employee Deduction Rules Table
-- Controls which deductions apply to which employees
CREATE TABLE IF NOT EXISTS employee_deduction_rules (
    id SERIAL PRIMARY KEY,
    employee_uuid VARCHAR(255) NOT NULL REFERENCES employees(uuid) ON DELETE CASCADE,
    deduction_id INTEGER NOT NULL REFERENCES deductions(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    override_type VARCHAR(50) DEFAULT 'include', -- 'include', 'exclude'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each employee can't have duplicate rules for the same deduction
    UNIQUE(employee_uuid, deduction_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_employee_deduction_rules_employee ON employee_deduction_rules(employee_uuid);
CREATE INDEX IF NOT EXISTS idx_employee_deduction_rules_deduction ON employee_deduction_rules(deduction_id);
CREATE INDEX IF NOT EXISTS idx_employee_deduction_rules_enabled ON employee_deduction_rules(is_enabled) WHERE is_enabled = true;

-- PHASE 2: Create Period Rules
-- Defines what constitutes a valid period for automated deductions
CREATE TABLE IF NOT EXISTS period_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'month_end', 'custom'
    period_conditions JSONB, -- Flexible conditions for period matching
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default period rules
INSERT INTO period_rules (rule_name, description, rule_type, period_conditions) VALUES
('Month End Periods', 'Pay periods that include or end at the end of a month', 'month_end', '{
    "includes_month_end": true,
    "end_date_matches_month_end": true,
    "period_types": ["monthly", "bi_monthly", "semi_monthly", "custom"]
}'),
('Semi-Monthly Periods', 'Pay periods covering first half or second half of month', 'custom', '{
    "period_types": ["semi_monthly"],
    "day_ranges": [[1, 15], [16, 31]]
}'),
('Custom End of Month', 'Custom periods ending on specific days of the month', 'custom', '{
    "end_day": [28, 29, 30, 31],
    "flexible_matching": true
}') ON CONFLICT (rule_name) DO NOTHING;

-- PHASE 3: Create Templates and Functions
-- Automated Deduction Templates Table
-- Links deductions to period rules and optional employee filtering
CREATE TABLE IF NOT EXISTS automated_deduction_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    deduction_id INTEGER NOT NULL REFERENCES deductions(id) ON DELETE CASCADE,
    period_rule_id INTEGER NOT NULL REFERENCES period_rules(id) ON DELETE CASCADE,
    employee_filter JSONB, -- null means all employees, otherwise specific employee criteria
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority templates apply first
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_automated_deduction_templates_period ON automated_deduction_templates(period_rule_id);
CREATE INDEX IF NOT EXISTS idx_automated_deduction_templates_deduction ON automated_deduction_templates(deduction_id);
CREATE INDEX IF NOT EXISTS idx_automated_deduction_templates_active ON automated_deduction_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automated_deduction_templates_priority ON automated_deduction_templates(priority DESC);

-- Deduction Application Log Table
-- Tracks when and why deductions were applied automatically
CREATE TABLE IF NOT EXISTS deduction_application_log (
    id SERIAL PRIMARY KEY,
    payslip_id VARCHAR(255), -- Links to the payslip
    employee_uuid VARCHAR(255) NOT NULL REFERENCES employees(uuid),
    deduction_id INTEGER NOT NULL REFERENCES deductions(id),
    template_id INTEGER REFERENCES automated_deduction_templates(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    deduction_name VARCHAR(255) NOT NULL,
    deduction_type VARCHAR(50) NOT NULL,
    deduction_value DECIMAL(10,2) NOT NULL,
    calculated_amount DECIMAL(10,2) NOT NULL,
    application_reason TEXT, -- Why this deduction was applied
    is_automatic BOOLEAN DEFAULT true,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(255) DEFAULT 'SYSTEM'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deduction_application_log_employee ON deduction_application_log(employee_uuid);
CREATE INDEX IF NOT EXISTS idx_deduction_application_log_payslip ON deduction_application_log(payslip_id);
CREATE INDEX IF NOT EXISTS idx_deduction_application_log_period ON deduction_application_log(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_deduction_application_log_date ON deduction_application_log(applied_at);

-- Helper function to check if a period matches a rule
CREATE OR REPLACE FUNCTION check_period_matches_rule(
    p_start_date DATE,
    p_end_date DATE,
    p_rule_conditions JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_start_date DATE := p_start_date;
    v_end_date DATE := p_end_date;
    v_start_month INTEGER;
    v_end_month INTEGER;
    v_start_year INTEGER;
    v_end_year INTEGER;
    v_start_day INTEGER;
    v_end_day INTEGER;
    v_conditions JSONB := p_rule_conditions;
BEGIN
    -- Extract date components
    v_start_month := EXTRACT(MONTH FROM v_start_date);
    v_end_month := EXTRACT(MONTH FROM v_end_date);
    v_start_year := EXTRACT(YEAR FROM v_start_date);
    v_end_year := EXTRACT(YEAR FROM v_end_date);
    v_start_day := EXTRACT(DAY FROM v_start_date);
    v_end_day := EXTRACT(DAY FROM v_end_date);

    -- Month End Period Rule
    IF v_conditions ? 'includes_month_end' THEN
        IF (v_conditions->>'includes_month_end')::BOOLEAN = true THEN
            -- Period includes month end if end date is the last day of a month
            IF v_end_date = LAST_DAY(v_end_date) THEN
                RETURN true;
            END IF;

            -- Or if period spans across month end
            IF v_start_month != v_end_month OR v_start_year != v_end_year THEN
                RETURN true;
            END IF;
        END IF;
    END IF;

    -- End date matches specific days
    IF v_conditions ? 'end_day' THEN
        IF v_end_day = ANY((v_conditions->>'end_day')::INTEGER[]) THEN
            RETURN true;
        END IF;
    END IF;

    -- Flexible end date matching (e.g., 28, 29, 30, 31)
    IF v_conditions ? 'flexible_matching' THEN
        IF (v_conditions->>'flexible_matching')::BOOLEAN = true THEN
            IF v_end_day >= 28 THEN
                RETURN true;
            END IF;
        END IF;
    END IF;

    -- Custom day ranges
    IF v_conditions ? 'day_ranges' THEN
        -- For demo purposes, return true for day ranges
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to get applicable automated deductions for an employee and period
CREATE OR REPLACE FUNCTION get_applicable_deductions(
    p_employee_uuid VARCHAR(255),
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    deduction_id INTEGER,
    deduction_name VARCHAR(255),
    deduction_type VARCHAR(50),
    deduction_value DECIMAL(10,2),
    calculated_amount DECIMAL(10,2),
    application_reason TEXT
) AS $$
DECLARE
    v_applicable_templates RECORD;
BEGIN
    -- First, get all active automated deduction templates
    FOR v_applicable_templates IN
        SELECT
            adt.id,
            adt.name,
            d.id as deduction_id,
            d.name as deduction_name,
            d.type as deduction_type,
            d.value as deduction_value,
            adt.priority
        FROM automated_deduction_templates adt
        JOIN deductions d ON adt.deduction_id = d.id
        JOIN period_rules pr ON adt.period_rule_id = pr.id
        WHERE adt.is_active = true
        AND pr.is_active = true
        AND check_period_matches_rule(p_start_date, p_end_date, pr.period_conditions)
        ORDER BY adt.priority DESC, d.name
    LOOP
        -- Check if this deduction should apply to this employee
        CONTINUE WHEN NOT EXISTS (
            SELECT 1 FROM employee_deduction_rules edr
            WHERE edr.employee_uuid = p_employee_uuid
            AND edr.deduction_id = v_applicable_templates.deduction_id
            AND edr.is_enabled = true
            AND (edr.effective_from IS NULL OR edr.effective_from <= p_start_date)
            AND (edr.effective_to IS NULL OR edr.effective_to >= p_end_date)
        );

        -- Return the deduction (amount will be calculated by application)
        RETURN QUERY SELECT
            v_applicable_templates.deduction_id,
            v_applicable_templates.deduction_name,
            v_applicable_templates.deduction_type,
            v_applicable_templates.deduction_value,
            v_applicable_templates.deduction_value, -- Placeholder, calculated later
            ('Applied via template: ' || v_applicable_templates.name)::TEXT
        ;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
-- Migration: Add Automated Deduction System
-- This migration adds tables for configuring automated, employee-specific, and period-based deductions

-- Employee Deduction Rules Table
-- Controls which deductions apply to which employees
CREATE TABLE IF NOT EXISTS employee_deduction_rules (
    id SERIAL PRIMARY KEY,
    employee_uuid VARCHAR(255) NOT NULL REFERENCES employees(uuid) ON DELETE CASCADE,
    deduction_id INTEGER NOT NULL REFERENCES deductions(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    override_type VARCHAR(50) DEFAULT 'include', -- 'include', 'exclude'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure each employee can't have duplicate rules for the same deduction
    UNIQUE(employee_uuid, deduction_id)
);

-- Index for performance
CREATE INDEX idx_employee_deduction_rules_employee ON employee_deduction_rules(employee_uuid);
CREATE INDEX idx_employee_deduction_rules_deduction ON employee_deduction_rules(deduction_id);
CREATE INDEX idx_employee_deduction_rules_enabled ON employee_deduction_rules(is_enabled) WHERE is_enabled = true;

-- Period Rules Table
-- Defines what constitutes a valid period for automated deductions
CREATE TABLE IF NOT EXISTS period_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'month_end', 'custom'
    period_conditions JSONB, -- Flexible conditions for period matching
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default period rules
INSERT INTO period_rules (rule_name, description, rule_type, period_conditions) VALUES
('Month End Periods', 'Pay periods that include or end at the end of a month', 'month_end', '{
    "includes_month_end": true,
    "end_date_matches_month_end": true,
    "period_types": ["monthly", "bi_monthly", "semi_monthly", "custom"]
}'),
('Semi-Monthly Periods', 'Pay periods covering first half or second half of month', 'custom', '{
    "period_types": ["semi_monthly"],
    "day_ranges": [[1, 15], [16, 31]]
}'),
('Custom End of Month', 'Custom periods ending on specific days of the month', 'custom', '{
    "end_day": [28, 29, 30, 31],
    "flexible_matching": true
}');

-- Automated Deduction Templates Table
-- Links deductions to period rules and optional employee filtering
CREATE TABLE IF NOT EXISTS automated_deduction_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    deduction_id INTEGER NOT NULL REFERENCES deductions(id) ON DELETE CASCADE,
    period_rule_id INTEGER NOT NULL REFERENCES period_rules(id) ON DELETE CASCADE,
    employee_filter JSONB, -- null means all employees, otherwise specific employee criteria
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority templates apply first
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_automated_deduction_templates_period ON automated_deduction_templates(period_rule_id);
CREATE INDEX idx_automated_deduction_templates_deduction ON automated_deduction_templates(deduction_id);
CREATE INDEX idx_automated_deduction_templates_active ON automated_deduction_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_automated_deduction_templates_priority ON automated_deduction_templates(priority DESC);

-- Deduction Application Log Table
-- Tracks when and why deductions were applied automatically
CREATE TABLE IF NOT EXISTS deduction_application_log (
    id SERIAL PRIMARY KEY,
    payslip_id VARCHAR(255), -- Links to the payslip
    employee_uuid VARCHAR(255) NOT NULL REFERENCES employees(uuid),
    deduction_id INTEGER NOT NULL REFERENCES deductions(id),
    template_id INTEGER REFERENCES automated_deduction_templates(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    deduction_name VARCHAR(255) NOT NULL,
    deduction_type VARCHAR(50) NOT NULL,
    deduction_value DECIMAL(10,2) NOT NULL,
    calculated_amount DECIMAL(10,2) NOT NULL,
    application_reason TEXT, -- Why this deduction was applied
    is_automatic BOOLEAN DEFAULT true,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(255) DEFAULT 'SYSTEM'
);

-- Indexes for performance
CREATE INDEX idx_deduction_application_log_employee ON deduction_application_log(employee_uuid);
CREATE INDEX idx_deduction_application_log_payslip ON deduction_application_log(payslip_id);
CREATE INDEX idx_deduction_application_log_period ON deduction_application_log(period_start, period_end);
CREATE INDEX idx_deduction_application_log_date ON deduction_application_log(applied_at);

-- Helper function to check if a period matches a rule
CREATE OR REPLACE FUNCTION check_period_matches_rule(
    p_start_date DATE,
    p_end_date DATE,
    p_rule_conditions JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_start_date DATE := p_start_date;
    v_end_date DATE := p_end_date;
    v_start_month INTEGER;
    v_end_month INTEGER;
    v_start_year INTEGER;
    v_end_year INTEGER;
    v_start_day INTEGER;
    v_end_day INTEGER;
    v_conditions JSONB := p_rule_conditions;
BEGIN
    -- Extract date components
    v_start_month := EXTRACT(MONTH FROM v_start_date);
    v_end_month := EXTRACT(MONTH FROM v_end_date);
    v_start_year := EXTRACT(YEAR FROM v_start_date);
    v_end_year := EXTRACT(YEAR FROM v_end_date);
    v_start_day := EXTRACT(DAY FROM v_start_date);
    v_end_day := EXTRACT(DAY FROM v_end_date);

    -- Month End Period Rule
    IF v_conditions ? 'includes_month_end' THEN
        -- Check if period includes month end
        IF (v_conditions->>'includes_month_end')::BOOLEAN = true THEN
            -- Period includes month end if end date is the last day of a month
            IF v_end_date = LAST_DAY(v_end_date) THEN
                RETURN true;
            END IF;
            
            -- Or if period spans across month end
            IF v_start_month != v_end_month OR v_start_year != v_end_year THEN
                RETURN true;
            END IF;
        END IF;
    END IF;

    -- End date matches specific days
    IF v_conditions ? 'end_day' THEN
        IF v_end_day = ANY((v_conditions->>'end_day')::INTEGER[]) THEN
            RETURN true;
        END IF;
    END IF;

    -- Flexible end date matching (e.g., 28, 29, 30, 31)
    IF v_conditions ? 'flexible_matching' THEN
        IF (v_conditions->>'flexible_matching')::BOOLEAN = true THEN
            IF v_end_day >= 28 THEN
                RETURN true;
            END IF;
        END IF;
    END IF;

    -- Custom day ranges
    IF v_conditions ? 'day_ranges' THEN
        -- Check if end day falls within any of the specified ranges
        -- This would need to be implemented with a loop in a real scenario
        -- For now, return true for demo purposes
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to get applicable automated deductions for an employee and period
CREATE OR REPLACE FUNCTION get_applicable_deductions(
    p_employee_uuid VARCHAR(255),
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    deduction_id INTEGER,
    deduction_name VARCHAR(255),
    deduction_type VARCHAR(50),
    deduction_value DECIMAL(10,2),
    calculated_amount DECIMAL(10,2),
    application_reason TEXT
) AS $$
DECLARE
    v_applicable_templates RECORD;
    v_employee_deductions RECORD;
    v_gross_pay DECIMAL(10,2) := 0; -- This would need to be passed as parameter in real usage
BEGIN
    -- First, get all active automated deduction templates
    FOR v_applicable_templates IN
        SELECT 
            adt.id,
            adt.name,
            adt.description,
            d.id as deduction_id,
            d.name as deduction_name,
            d.type as deduction_type,
            d.value as deduction_value,
            adt.priority
        FROM automated_deduction_templates adt
        JOIN deductions d ON adt.deduction_id = d.id
        JOIN period_rules pr ON adt.period_rule_id = pr.id
        WHERE adt.is_active = true 
        AND pr.is_active = true
        AND check_period_matches_rule(p_start_date, p_end_date, pr.period_conditions)
        ORDER BY adt.priority DESC, d.name
    LOOP
        -- Check if this deduction should apply to this employee
        CONTINUE WHEN NOT EXISTS (
            SELECT 1 FROM employee_deduction_rules edr
            WHERE edr.employee_uuid = p_employee_uuid
            AND edr.deduction_id = v_applicable_templates.deduction_id
            AND edr.is_enabled = true
            AND (edr.effective_from IS NULL OR edr.effective_from <= p_start_date)
            AND (edr.effective_to IS NULL OR edr.effective_to >= p_end_date)
        );

        -- Calculate the deduction amount
        CASE v_applicable_templates.deduction_type
            WHEN 'percentage' THEN
                -- For percentage deductions, we'd need gross pay as input
                -- For now, return the percentage value and let the application calculate
                RETURN QUERY SELECT 
                    v_applicable_templates.deduction_id,
                    v_applicable_templates.deduction_name,
                    v_applicable_templates.deduction_type,
                    v_applicable_templates.deduction_value,
                    v_applicable_templates.deduction_value, -- Will be calculated as percentage of gross pay
                    ('Applied via template: ' || v_applicable_templates.name)::TEXT
                ;
            WHEN 'amount' THEN
                RETURN QUERY SELECT 
                    v_applicable_templates.deduction_id,
                    v_applicable_templates.deduction_name,
                    v_applicable_templates.deduction_type,
                    v_applicable_templates.deduction_value,
                    v_applicable_templates.deduction_value,
                    ('Applied via template: ' || v_applicable_templates.name)::TEXT
                ;
        END CASE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;