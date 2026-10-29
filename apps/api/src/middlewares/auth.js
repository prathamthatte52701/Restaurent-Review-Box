import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

const bearer = (req) => {
  const h = req.headers.authorization;
  return h && /^Bearer\s+/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null;
};

async function userFromToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new Error('inactive');
    // tokens issued before a password change are void
    if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) throw new Error('stale');
    return user;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export const protect = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (!token) throw ApiError.unauthorized();
  req.user = await userFromToken(token);
  next();
});

/** Loads req.user when a valid token is sent; otherwise continues anonymously. */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (token) req.user = await userFromToken(token).catch(() => null);
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
