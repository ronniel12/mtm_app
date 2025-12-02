-- Migration to add file attachment columns to expenses table
-- This fixes the issue where expenses fail to save when files are attached

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS receipt_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS receipt_original_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS receipt_mimetype VARCHAR(100),
ADD COLUMN IF NOT EXISTS receipt_size INTEGER,
ADD COLUMN IF NOT EXISTS receipt_data BYTEA;

-- Add indexes for performance on frequently queried receipt columns
CREATE INDEX IF NOT EXISTS idx_expenses_receipt_filename ON expenses(receipt_filename);
CREATE INDEX IF NOT EXISTS idx_expenses_receipt_mimetype ON expenses(receipt_mimetype);

-- Add comments for clarity
COMMENT ON COLUMN expenses.receipt_filename IS 'Generated filename for stored attachment';
COMMENT ON COLUMN expenses.receipt_original_name IS 'Original uploaded filename';
COMMENT ON COLUMN expenses.receipt_mimetype IS 'File MIME type (image/jpeg, application/pdf, etc.)';
COMMENT ON COLUMN expenses.receipt_size IS 'File size in bytes';
COMMENT ON COLUMN expenses.receipt_data IS 'Binary file data stored as BYTEA';
