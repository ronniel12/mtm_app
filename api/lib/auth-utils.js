'use strict';

const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME || 'mtm_refresh_token';
const defaultMaxAgeDays = parseInt(process.env.AUTH_REFRESH_TOKEN_DAYS || '7', 10);

function buildCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || isProduction,
    sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
    path: '/',
    maxAge: defaultMaxAgeDays * 24 * 60 * 60,
  };
}

function serializeCookie(name, value, options) {
  const opts = options || {};
  const segments = [`${name}=${value}`];
  if (opts.maxAge != null) {
    segments.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  }
  if (opts.domain) {
    segments.push(`Domain=${opts.domain}`);
  }
  if (opts.path) {
    segments.push(`Path=${opts.path}`);
  }
  if (opts.expires) {
    segments.push(`Expires=${opts.expires.toUTCString()}`);
  }
  if (opts.httpOnly) {
    segments.push('HttpOnly');
  }
  if (opts.secure) {
    segments.push('Secure');
  }
  if (opts.sameSite) {
    const sameSite = typeof opts.sameSite === 'string' ? opts.sameSite : 'Lax';
    segments.push(`SameSite=${sameSite}`);
  }

  return segments.join('; ');
}

function setRefreshTokenCookie(res, token) {
  const cookieOptions = buildCookieOptions();
  const serialized = serializeCookie(cookieName, token, cookieOptions);
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (existing) {
    const values = Array.isArray(existing) ? existing : [existing];
    values.push(serialized);
    res.setHeader('Set-Cookie', values);
  } else {
    res.setHeader('Set-Cookie', serialized);
  }
}

function clearRefreshTokenCookie(res) {
  const cookieOptions = {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
  };
  const serialized = serializeCookie(cookieName, '', cookieOptions);
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (existing) {
    const values = Array.isArray(existing) ? existing : [existing];
    values.push(serialized);
    res.setHeader('Set-Cookie', values);
  } else {
    res.setHeader('Set-Cookie', serialized);
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) {
    return {};
  }
  return header.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function extractRefreshToken(req) {
  const cookies = parseCookies(req);
  if (cookies[cookieName]) {
    return cookies[cookieName];
  }

  if (req.body && typeof req.body.refreshToken === 'string') {
    return req.body.refreshToken;
  }

  if (req.headers && typeof req.headers['x-refresh-token'] === 'string') {
    return req.headers['x-refresh-token'];
  }

  return null;
}

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  extractRefreshToken,
  cookieName,
};
