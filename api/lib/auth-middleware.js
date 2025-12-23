'use strict';

const authService = require('./auth-service');

function getBearerToken(req) {
  const header = req.headers?.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

async function authenticateRequest(req, res, next) {
  if (!authService.isAuthEnabled()) {
    return next();
  }

  // Exempt employee PIN-based routes from user authentication
  const publicPaths = ['/api/employee/'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenPayload: payload,
    };
    return next();
  } catch (error) {
    console.error('Access token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!authService.isAuthEnabled()) {
      return next();
    }

    console.log('req.user:', req.user);
    console.log('allowedRoles:', allowedRoles);

    if (!req.user) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
}

module.exports = {
  authenticateRequest,
  requireRoles,
};
