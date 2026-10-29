import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, underscore');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long (max 72)');
const optStr = (max) => z.string().trim().max(max).optional();

export const registerBody = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  username,
  email,
  password,
  phone: z.string().trim().regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number').optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  city: optStr(80),
  address: optStr(300),
});

export const verifyOtpBody = z.object({ email, otp: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits') });
export const emailBody = z.object({ email });

const ident = z.string().trim().toLowerCase().min(1).max(254);
export const loginBody = z
  .object({ identifier: ident.optional(), email: ident.optional(), username: ident.optional(), password: z.string().min(1).max(200) })
  .refine((b) => b.identifier || b.email || b.username, { message: 'Email or username is required', path: ['email'] });

export const forgotBody = emailBody;
export const resetBody = z.object({
  email,
  token: z.string().trim().regex(/^[a-f\d]{64}$/i, 'Invalid reset token'),
  newPassword: password,
});
export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
export const checkUsernameQuery = z.object({ username });
