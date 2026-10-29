import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { TOUCH_MS } from '../services/sessions.js';

const bearer = (req) => {
  const h = req.headers.authorization;
  return h && /^Bearer\s+/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null;
};

const fail = (code, msg) => ApiError.unauthorized(msg, code);

/** One DB query: the user doc carries its sessions, so revocation checks cost nothing extra. */
async function userFromToken(req, token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    if (e?.name === 'TokenExpiredError') throw fail('TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    throw fail('TOKEN_INVALID', 'Invalid token');
  }
  const user = /^[a-f\d]{24}$/i.test(payload.sub) ? await User.findById(payload.sub) : null;
  if (!user || typeof payload.jti !== 'string') throw fail('TOKEN_INVALID', 'Invalid token');
  if (!user.isActive) throw fail('ACCOUNT_DISABLED', 'Your account has been disabled.');
  if ((payload.tokenVersion ?? -1) !== (user.tokenVersion || 0)) throw fail('PASSWORD_CHANGED', 'Your password was changed. Please sign in again.');
  const session = user.sessions.find((s) => s.jti === payload.jti);
  if (!session) throw fail('SESSION_REVOKED', 'You were logged out. Please sign in again.');
  req.jti = payload.jti;
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_MS) {
    // fire and forget: a failed touch must never fail the request
    User.updateOne({ _id: user._id, 'sessions.jti': payload.jti }, { $set: { 'sessions.$.lastUsedAt': new Date() } }).catch(() => {});
  }
  return user;
}

export const protect = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (!token) throw ApiError.unauthorized();
  req.user = await userFromToken(req, token);
  next();
});

/** Loads req.user when a valid token is sent; otherwise continues anonymously. */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (token) req.user = await userFromToken(req, token).catch(() => null);
  next();
});

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

/** For public lists: ?includeInactive=true demands an admin token. */
export const adminForInactive = (req, res, next) => {
  if (req.query.includeInactive !== 'true') return next();
  protect(req, res, (err) => (err ? next(err) : restrictTo('admin')(req, res, next)));
};
