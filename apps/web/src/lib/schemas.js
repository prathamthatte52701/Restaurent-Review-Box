import { z } from 'zod';

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const email = z.string().trim().min(1, 'Enter your email address').email('That email address does not look right').max(254, 'That email address is too long');
const password = z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer');

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(80, 'Keep your name under 80 characters'),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, 'Use 3-30 letters, numbers or underscores'),
  email,
  phone: z.string().trim().regex(/^([+()\d\s-]{7,20})?$/, 'Enter a valid phone number').optional().or(z.literal('')),
  password,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({ newPassword: password, confirm: z.string().min(1, 'Re-enter your new password') })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const changeSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password, confirm: z.string().min(1, 'Re-enter your new password') })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a password you have not used just now' });

/** Only same-site paths; blocks open redirects like //evil.com or https://. */
export const safeNext = (n) => (typeof n === 'string' && /^\/(?![/\\])/.test(n) ? n : '/');
