import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.rate.disabled,
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });

const MIN = 60 * 1000;
export const apiLimiter = make(15 * MIN, env.rate.api, 'Too many requests, please slow down.');
export const loginLimiter = make(15 * MIN, env.rate.login, 'Too many login attempts. Try again in 15 minutes.');
export const registerLimiter = make(60 * MIN, env.rate.register, 'Too many sign-ups from this network. Try again later.');
export const forgotLimiter = make(60 * MIN, env.rate.forgot, 'Too many reset requests. Try again later.');
export const resendLimiter = make(10 * MIN, env.rate.resend, 'Too many code requests. Wait a few minutes.');
