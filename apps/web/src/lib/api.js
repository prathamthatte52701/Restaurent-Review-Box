import axios from 'axios';
import { notify } from '@rrb/ui';
import { getToken } from './tokenStorage.js';

export const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";
const GENERIC_MESSAGE = 'Something went wrong on our end. Please try again in a moment.';
// auth endpoints where a 401/403 is an expected answer, not an expired session
const PUBLIC_AUTH = /\/auth\/(login|register|verify-otp|resend-otp|forgot-password|reset-password)$/;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 20000,
});

let onUnauthorized = null;
let navigateFn = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const setNavigator = (fn) => { navigateFn = fn; };

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const SESSION_MESSAGES = {
  SESSION_REVOKED: ['Signed out', 'You were logged out on another device. Please sign in again.'],
  PASSWORD_CHANGED: ['Password changed', 'Your password was changed, so you were signed out everywhere. Please sign in again.'],
  ACCOUNT_DISABLED: ['Account disabled', 'Your account has been disabled. Contact support if this is a mistake.'],
  TOKEN_EXPIRED: ['Session expired', 'Your session expired. Please sign in again.'],
};
const sessionMessage = (code) => SESSION_MESSAGES[code] || ['Session ended', 'Please sign in again to continue.'];

let sessionNoticeAt = 0;
function sessionExpired(code) {
  onUnauthorized?.();
  if (Date.now() - sessionNoticeAt < 5000) return;
  sessionNoticeAt = Date.now();
  const here = window.location.pathname + window.location.search;
  if (!here.startsWith('/login')) navigateFn?.(`/login?next=${encodeURIComponent(here)}`, { replace: true });
  notify.error(...sessionMessage(code));
}

/** Turn any axios failure into an Error with readable .message, .status, .errors (string field map). */
export function normalizeError(err) {
  if (err?.isApiError) return err;
  const res = err?.response;
  const body = res?.data && typeof res.data === 'object' ? res.data : {};
  const status = res?.status || 0;
  let message;
  if (!res) message = err?.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : NETWORK_MESSAGE;
  else if (status >= 500) message = GENERIC_MESSAGE;
  else if (status === 429) message = typeof body.message === 'string' ? body.message : 'Too many attempts. Please wait a few minutes and try again.';
  else message = typeof body.message === 'string' && body.message ? body.message : 'The request could not be completed.';
  const raw = body.errors && typeof body.errors === 'object' ? body.errors : {};
  const errors = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string'));
  const e = new Error(message);
  Object.assign(e, { isApiError: true, status, errors, code: typeof raw.code === 'string' ? raw.code : undefined, network: !res, requiresVerification: raw.requiresVerification === true, email: typeof raw.email === 'string' && raw.requiresVerification ? raw.email : undefined });
  if (raw.requiresVerification) delete e.errors.email;
  delete e.errors.code;
  return e;
}

api.interceptors.response.use(
  (res) => {
    const b = res.data;
    if (b && typeof b === 'object' && 'success' in b) return { data: b.data, message: b.message, pagination: b.pagination, facets: b.facets, center: b.center };
    return { data: b, message: undefined, pagination: undefined, facets: undefined, center: undefined };
  },
  (err) => {
    const e = normalizeError(err);
    const cfg = err?.config;
    if (e.status === 401 && cfg?.headers?.Authorization && !PUBLIC_AUTH.test(cfg.url || '')) {
      if (cfg.silentAuth) onUnauthorized?.(); // boot hydration with a bad token: clean logout, no noise
      else sessionExpired(e.code);
    }
    return Promise.reject(e);
  },
);
