import User from '../models/User.js';
import { env } from '../config/env.js';

/** Create/promote the admin from ADMIN_EMAIL / ADMIN_PASSWORD. Returns 'created' | 'exists' | 'skipped'. */
export async function seedAdmin({ force = false } = {}) {
  if (!env.adminEmail || !env.adminPassword) return 'skipped';
  if (!force && (await User.exists({ role: 'admin' }))) return 'exists';
  if (await User.exists({ email: env.adminEmail })) return 'exists';
  await User.create({
    fullName: 'Administrator',
    username: 'admin',
    email: env.adminEmail,
    password: env.adminPassword,
    role: 'admin',
    isEmailVerified: true,
  }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
  return 'created';
}

/** Dev convenience: auto-create the admin on boot when none exists. Never in production. */
export async function ensureDevAdmin() {
  if (env.isProd || env.isTest) return;
  const res = await seedAdmin();
  if (res === 'created') console.log(`[admin] created dev admin ${env.adminEmail}`);
}
