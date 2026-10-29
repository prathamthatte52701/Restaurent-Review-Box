import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/response.js';
import { startSession, buildSession } from '../services/sessions.js';
import { generateOtp, hmac, safeEqual, randomToken, OTP_TTL_MS, OTP_MAX_ATTEMPTS, RESET_TTL_MS } from '../utils/crypto.js';
import { sendOtpMail, sendResetMail } from '../services/mail.js';

// compared against when the account does not exist, so response time does not reveal existence
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', env.bcryptRounds);
const OTP_SELECT = '+otp.codeHash +otp.expiresAt +otp.attempts';

async function issueOtp(user) {
  const code = generateOtp();
  await User.updateOne(
    { _id: user._id },
    { $set: { otp: { codeHash: hmac(code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 } } },
  );
  await sendOtpMail(user, code);
}

export const register = asyncHandler(async (req, res) => {
  const b = req.validated.body;
  const clash = await User.find({ $or: [{ email: b.email }, { username: b.username }] }, 'email username').lean();
  const errors = {};
  if (clash.some((u) => u.email === b.email)) errors.email = 'This email is already registered';
  if (clash.some((u) => u.username === b.username)) errors.username = 'This username is taken';
  if (Object.keys(errors).length) throw ApiError.conflict('Account already exists', errors);

  let user;
  try {
    user = await User.create({ ...b, role: 'user' }); // role is never taken from the client
  } catch (err) {
    if (err?.code === 11000) {
      const f = Object.keys(err.keyPattern || {})[0] || 'email';
      throw ApiError.conflict('Account already exists', { [f]: f === 'username' ? 'This username is taken' : 'This email is already registered' });
    }
    throw err;
  }
  await issueOtp(user);
  sendOk(res, { email: user.email, requiresVerification: true }, 'Account created. We emailed you a 6-digit verification code.', 201);
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.validated.body;
  const generic = ApiError.badRequest('Invalid or expired code. Request a new one.');
  // atomic increment: parallel guesses can never exceed the attempt budget
  const user = await User.findOneAndUpdate(
    { email, 'otp.codeHash': { $exists: true } },
    { $inc: { 'otp.attempts': 1 } },
    { new: true },
  ).select(OTP_SELECT);
  if (!user?.otp?.codeHash) throw generic;

  const clear = () => User.updateOne({ _id: user._id }, { $unset: { otp: 1 } });
  if (user.otp.attempts > OTP_MAX_ATTEMPTS) {
    await clear();
    throw ApiError.badRequest('Too many incorrect attempts. Request a new code.');
  }
  if (user.otp.expiresAt < new Date()) {
    await clear();
    throw ApiError.badRequest('This code has expired. Request a new one.');
  }
  if (!safeEqual(user.otp.codeHash, hmac(otp))) {
    if (user.otp.attempts >= OTP_MAX_ATTEMPTS) {
      await clear();
      throw ApiError.badRequest('Too many incorrect attempts. Request a new code.');
    }
    throw ApiError.badRequest(`Incorrect code. ${OTP_MAX_ATTEMPTS - user.otp.attempts} attempt(s) left.`);
  }
  if (!user.isActive) throw ApiError.forbidden('Your account is disabled. Contact support.');
  user.isEmailVerified = true;
  user.otp = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  await User.updateOne({ _id: user._id }, { $unset: { otp: 1 } });
  sendOk(res, { token: await startSession(user, req), user }, 'Email verified');
});

export const resendOtp = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.validated.body.email });
  if (user && user.isActive && !user.isEmailVerified) await issueOtp(user);
  sendOk(res, null, 'If this account exists and is unverified, a new code has been sent.');
});

export const login = asyncHandler(async (req, res) => {
  const b = req.validated.body;
  const id = b.identifier || b.email || b.username;
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select('+password');
  const ok = await bcrypt.compare(b.password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized('Invalid email/username or password');
  if (!user.isActive) throw ApiError.forbidden('Your account is disabled. Contact support.');
  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email first. Enter the code we sent you.', { requiresVerification: true, email: user.email });
  }
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  sendOk(res, { token: await startSession(user, req), user }, 'Logged in');
});

// optionalAuth: a dead token still gets a clean 200
export const logout = asyncHandler(async (req, res) => {
  if (req.user) await User.updateOne({ _id: req.user._id }, { $pull: { sessions: { jti: req.jti } } });
  sendOk(res, null, 'Logged out');
});

export const logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { sessions: [] } });
  sendOk(res, null, 'Logged out of all devices');
});

/** Public session ids are the subdocument _id; the raw jti never leaves the server. */
export const listSessions = (req, res) => {
  const data = req.user.sessions
    .map((s) => ({ id: String(s._id), device: s.device, ip: s.ip, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, current: s.jti === req.jti }))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  sendOk(res, data, 'OK');
};

export const deleteSession = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const r = await User.updateOne({ _id: req.user._id, 'sessions._id': id }, { $pull: { sessions: { _id: id } } });
  if (!r.matchedCount) throw ApiError.notFound('Session not found');
  sendOk(res, null, 'Session removed');
});

export const me = (req, res) => sendOk(res, { user: req.user }, 'OK');

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.validated.body.email });
  if (user?.isActive) {
    const token = randomToken();
    await User.updateOne({ _id: user._id }, { passwordResetTokenHash: hmac(token), passwordResetExpires: new Date(Date.now() + RESET_TTL_MS) });
    await sendResetMail(user, token);
  }
  sendOk(res, null, 'If an account exists for this email, a reset link has been sent.');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.validated.body;
  const hash = hmac(token);
  const found = await User.findOne({ email, passwordResetTokenHash: hash }).select('+passwordResetExpires');
  if (!found) throw ApiError.badRequest('This reset link is invalid or has already been used.');
  if (found.passwordResetExpires < new Date()) {
    await User.updateOne({ _id: found._id }, { $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 } });
    throw ApiError.badRequest('This reset link has expired. Request a new one.');
  }
  // atomic claim = single use even under parallel requests
  const user = await User.findOneAndUpdate(
    { _id: found._id, passwordResetTokenHash: hash },
    { $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1, otp: 1 } },
    { new: true },
  );
  if (!user) throw ApiError.badRequest('This reset link is invalid or has already been used.');
  user.password = newPassword;
  user.isEmailVerified = true; // they proved control of the mailbox
  user.tokenVersion += 1; // every device is logged out
  user.sessions = [];
  await user.save();
  sendOk(res, null, 'Password updated. You can now log in.');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect', { currentPassword: 'Current password is incorrect' });
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must be different', { newPassword: 'New password must be different' });
  user.password = newPassword;
  user.tokenVersion += 1;
  const { token, session } = buildSession(user, req);
  user.sessions = [session]; // every other device is logged out; this one continues
  await user.save();
  sendOk(res, { token }, 'Password changed');
});

export const checkUsername = asyncHandler(async (req, res) => {
  const exists = await User.exists({ username: req.validated.query.username });
  sendOk(res, { available: !exists }, 'OK');
});
