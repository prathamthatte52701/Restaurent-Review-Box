import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESET_TTL_MS = 15 * 60 * 1000;

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const hmac = (value) => crypto.createHmac('sha256', env.jwtSecret).update(String(value)).digest('hex');
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
export const randomToken = () => crypto.randomBytes(32).toString('hex');
