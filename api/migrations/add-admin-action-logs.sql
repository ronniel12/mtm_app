CREATE TABLE admin_action_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id),
    action VARCHAR(255),
    target_user_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);