-- Add password reset required flag to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT TRUE;

-- Update existing users to not require immediate password reset
-- (assuming they've already set their passwords)
UPDATE users SET password_reset_required = FALSE;
