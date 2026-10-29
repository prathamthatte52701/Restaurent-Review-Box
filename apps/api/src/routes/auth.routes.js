import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.js';
import { loginLimiter, registerLimiter, forgotLimiter, resendLimiter } from '../middlewares/rateLimit.js';
import * as v from '../validators/auth.js';
import * as c from '../controllers/authController.js';

const r = Router();
r.post('/register', registerLimiter, validate({ body: v.registerBody }), c.register);
r.post('/verify-otp', validate({ body: v.verifyOtpBody }), c.verifyOtp);
r.post('/resend-otp', resendLimiter, validate({ body: v.emailBody }), c.resendOtp);
r.post('/login', loginLimiter, validate({ body: v.loginBody }), c.login);
r.post('/logout', c.logout);
r.get('/me', protect, c.me);
r.post('/forgot-password', forgotLimiter, validate({ body: v.forgotBody }), c.forgotPassword);
r.post('/reset-password', validate({ body: v.resetBody }), c.resetPassword);
r.post('/change-password', protect, validate({ body: v.changePasswordBody }), c.changePassword);
r.get('/check-username', validate({ query: v.checkUsernameQuery }), c.checkUsername);
export default r;
