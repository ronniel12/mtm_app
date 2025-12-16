-- Migration: introduce user authentication tables
-- Includes role catalog, users, and refresh session storage

BEGIN;

-- Role catalog keeps permissions explicit
CREATE TABLE IF NOT EXISTS user_roles (
    role VARCHAR(32) PRIMARY KEY,
    description TEXT
);

INSERT INTO user_roles (role, description) VALUES
    ('admin', 'Full access to all administrative and operational features'),
    ('manager', 'Can manage operational data but limited system settings access'),
    ('staff', 'Standard user access to day-to-day features'),
    ('viewer', 'Read-only access to reports and dashboards')
ON CONFLICT (role) DO NOTHING;

-- Core user accounts table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL REFERENCES user_roles(role) ON UPDATE CASCADE,
    reset_token TEXT,
    reset_token_expires TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (email)
);

-- Ensure missing columns are added if table pre-existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC NULLS LAST);

-- Refresh tokens / session tracking for long-lived access
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

COMMIT;
