import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPO_ROOT = path.resolve(API_ROOT, '../..');

dotenv.config({ path: path.join(API_ROOT, '.env'), quiet: true });

const e = process.env;
const bool = (v) => String(v).toLowerCase() === 'true';
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const trimSlash = (s) => s.replace(/\/+$/, '');

/** Print one clear line and exit - used for unrecoverable startup problems. */
export const fatal = (msg) => {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
};

const nodeEnv = e.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
if (isProd && !e.JWT_SECRET) fatal('JWT_SECRET is not set (required in production).');
if (!isProd && !e.JWT_SECRET && nodeEnv !== 'test') {
  console.warn('[env] JWT_SECRET not set - using a random per-process secret (tokens die on restart).');
}
const port = num(e.PORT, 5000);

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port,
  mongoUri: e.MONGO_URI || '',
  jwtSecret: e.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiresIn: e.JWT_EXPIRES_IN || '7d',
  bcryptRounds: num(e.BCRYPT_ROUNDS, 10),
  clientUrl: trimSlash(e.CLIENT_URL || 'http://localhost:5173'),
  adminUrl: trimSlash(e.ADMIN_URL || 'http://localhost:5174'),
  publicApiUrl: trimSlash(e.PUBLIC_API_URL || `http://localhost:${port}`),
  smtp: {
    host: e.SMTP_HOST || '',
    port: num(e.SMTP_PORT, 587),
    user: e.SMTP_USER || '',
    pass: e.SMTP_PASS || '',
    from: e.MAIL_FROM || 'Restaurant Review Box <no-reply@example.com>',
  },
  cloudinary: {
    cloudName: e.CLOUDINARY_CLOUD_NAME || '',
    apiKey: e.CLOUDINARY_API_KEY || '',
    apiSecret: e.CLOUDINARY_API_SECRET || '',
  },
  uploadsDir: e.UPLOADS_DIR ? path.resolve(e.UPLOADS_DIR) : path.join(API_ROOT, 'uploads'),
  memoryDbDir: path.join(API_ROOT, '.mongo-memory'),
  adminEmail: (e.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: e.ADMIN_PASSWORD || '',
  rate: {
    disabled: bool(e.RATE_LIMIT_DISABLED),
    api: num(e.RATE_LIMIT_MAX, 600),
    login: num(e.LOGIN_RATE_MAX, 20),
    register: num(e.REGISTER_RATE_MAX, 10),
    forgot: num(e.FORGOT_RATE_MAX, 5),
    resend: num(e.RESEND_RATE_MAX, 3),
  },
};
