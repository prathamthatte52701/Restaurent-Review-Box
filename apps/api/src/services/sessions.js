import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';

export const MAX_SESSIONS = 10;
export const TOUCH_MS = 5 * 60 * 1000; // lastUsedAt is written at most this often per session

/** Tiny user-agent parser: "Chrome on Windows". Order matters (Edge/Opera UAs also say Chrome). */
export function parseDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

/** Build a token + its session record for `user` (does not persist). */
export function buildSession(user, req) {
  const jti = crypto.randomUUID();
  const token = signToken(user, jti);
  const now = new Date();
  const session = {
    jti,
    device: parseDevice(req.headers['user-agent']),
    ip: req.ip,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(jwt.decode(token).exp * 1000),
  };
  return { token, session };
}

/** Persist a new session: prune expired ones, keep only the newest MAX_SESSIONS. Returns the JWT. */
export async function startSession(user, req) {
  const { token, session } = buildSession(user, req);
  await User.updateOne({ _id: user._id }, { $pull: { sessions: { expiresAt: { $lte: new Date() } } } });
  await User.updateOne({ _id: user._id }, { $push: { sessions: { $each: [session], $slice: -MAX_SESSIONS } } });
  return token;
}
