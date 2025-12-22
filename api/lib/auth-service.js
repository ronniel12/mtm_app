'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./db');

const DEFAULT_ACCESS_MINUTES = parseInt(process.env.AUTH_ACCESS_TOKEN_MINUTES || '15', 10);
const DEFAULT_REFRESH_DAYS = parseInt(process.env.AUTH_REFRESH_TOKEN_DAYS || '7', 10);
const DEFAULT_RESET_MINUTES = parseInt(process.env.AUTH_RESET_TOKEN_MINUTES || '60', 10);
const JWT_SECRET = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || 'development-secret-change-me';

const ACCESS_TOKEN_EXPIRY = `${DEFAULT_ACCESS_MINUTES}m`;

function getAccessTokenTTLSeconds() {
  return DEFAULT_ACCESS_MINUTES * 60;
}

function getRefreshTokenTTLSeconds() {
  return DEFAULT_REFRESH_DAYS * 24 * 60 * 60;
}

function isAuthEnabled() {
  return process.env.AUTH_REQUIRE_LOGIN === 'true';
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function issueRefreshToken(userId, requestMeta = {}) {
  const sessionId = crypto.randomUUID();
  const tokenValue = crypto.randomBytes(48).toString('hex');
  const tokenHash = await bcrypt.hash(tokenValue, 10);

  const expiresAt = new Date(Date.now() + DEFAULT_REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO user_sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sessionId,
      userId,
      tokenHash,
      requestMeta.userAgent || null,
      requestMeta.ipAddress || null,
      expiresAt,
    ],
  );

  return `${sessionId}.${tokenValue}`;
}

async function getSessionById(sessionId) {
  const { rows } = await query('SELECT * FROM user_sessions WHERE id = $1', [sessionId]);
  if (!rows.length) {
    return null;
  }
  return rows[0];
}

async function revokeSession(sessionId) {
  await query('DELETE FROM user_sessions WHERE id = $1', [sessionId]);
}

async function verifyRefreshToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return null;
  }

  const [sessionId, tokenValue] = refreshToken.split('.');
  if (!sessionId || !tokenValue) {
    return null;
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    return null;
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    await revokeSession(session.id);
    return null;
  }

  const isMatch = await bcrypt.compare(tokenValue, session.refresh_token_hash);
  if (!isMatch) {
    await revokeSession(session.id);
    return null;
  }

  return session;
}

async function revokeRefreshToken(refreshToken) {
  const session = await verifyRefreshToken(refreshToken);
  if (session) {
    await revokeSession(session.id);
  }
}

async function revokeAllSessionsForUser(userId) {
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

async function getUserByEmail(email) {
  const { rows } = await query('SELECT id, email, password_hash, role, reset_token, reset_token_expires FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function getUserById(id) {
  const { rows } = await query('SELECT id, email, role, last_login FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser(email, password, role) {
  if (!email || !password || !role) {
    throw new Error('Email, password, and role are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const validRoles = ['admin', 'manager', 'staff', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error('Invalid role');
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already exists');
  }

  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
    [email.toLowerCase(), passwordHash, role]
  );

  return rows[0];
}

async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
}

async function setUserPassword(userId, passwordHash) {
  await query(
    `UPDATE users
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP, reset_token = NULL, reset_token_expires = NULL
     WHERE id = $2`,
    [passwordHash, userId],
  );
}

function buildResetTokenHash(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function generatePasswordResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = buildResetTokenHash(rawToken);
  const expiresAt = new Date(Date.now() + DEFAULT_RESET_MINUTES * 60 * 1000);

  await query(
    `UPDATE users
     SET reset_token = $1, reset_token_expires = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [hashedToken, expiresAt, userId],
  );

  return {
    token: rawToken,
    expiresAt,
  };
}

async function verifyPasswordResetToken(rawToken) {
  if (!rawToken) {
    return null;
  }

  const hashedToken = buildResetTokenHash(rawToken);
  const { rows } = await query(
    `SELECT id, email, role
     FROM users
     WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
    [hashedToken],
  );

  return rows[0] || null;
}

async function updateUser(userId, updates) {
  const { email, role, password } = updates;

  if (!userId) {
    throw new Error('User ID is required');
  }

  const validRoles = ['admin', 'manager', 'staff', 'viewer'];
  if (role && !validRoles.includes(role)) {
    throw new Error('Invalid role');
  }

  if (password && password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Get current user to check if email is changing
  const currentUser = await getUserById(userId);
  if (!currentUser) {
    throw new Error('User not found');
  }

  // Check if email is already taken by another user, but only if email is changing
  if (email && email.toLowerCase() !== currentUser.email) {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }
  }

  const updateValues = [];
  const setParts = [];
  let paramIndex = 1;

  if (email !== undefined) {
    setParts.push(`email = $${paramIndex++}`);
    updateValues.push(email.toLowerCase());
  }

  if (role !== undefined) {
    setParts.push(`role = $${paramIndex++}`);
    updateValues.push(role);
  }

  if (password) {
    const passwordHash = await hashPassword(password);
    setParts.push(`password_hash = $${paramIndex++}`);
    updateValues.push(passwordHash);
  }

  if (setParts.length === 0) {
    throw new Error('No valid fields to update');
  }

  setParts.push(`updated_at = CURRENT_TIMESTAMP`);
  updateValues.push(userId);

  const queryText = `UPDATE users SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, role`;

  console.log('Executing query:', queryText, 'with values:', updateValues);
  const { rows } = await query(queryText, updateValues);
  if (!rows.length) {
    throw new Error('User not found');
  }

  // If password was updated, revoke all sessions
  if (password) {
    await revokeAllSessionsForUser(userId);
  }

  return rows[0];
}

async function deleteUser(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  // First revoke all sessions for the user
  await revokeAllSessionsForUser(userId);

  // Then delete the user
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [userId]);
  if (rowCount === 0) {
    throw new Error('User not found');
  }

  return { deleted: true };
}

async function resetUserPassword(adminUserId, targetUserId, newPassword) {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // Hash the password
  const passwordHash = await hashPassword(newPassword);

  // Update the user's password and clear reset tokens
  await setUserPassword(targetUserId, passwordHash);

  // Revoke all sessions for the user
  await revokeAllSessionsForUser(targetUserId);
}

module.exports = {
  isAuthEnabled,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllSessionsForUser,
  revokeSession,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateLastLogin,
  setUserPassword,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  resetUserPassword,
  getAccessTokenTTLSeconds,
  getRefreshTokenTTLSeconds,
};
