import axios from 'axios';
import { notify } from '@rrb/ui';

export const TOKEN_KEY = 'rrb-admin-token';
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+$/, '');

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };

/** /uploads/x.webp -> http://localhost:5000/uploads/x.webp */
export const imgUrl = (u) => (!u ? '' : /^(https?:|data:|blob:)/.test(u) ? u : `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);

// set by the auth store to avoid a circular import
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export const api = axios.create({ baseURL: API_URL, timeout: 20000 });

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const SESSION_MESSAGES = {
  SESSION_REVOKED: ['Signed out', 'You were logged out on another device. Please sign in again.'],
  PASSWORD_CHANGED: ['Password changed', 'Your password was changed, so you were signed out everywhere. Please sign in again.'],
  ACCOUNT_DISABLED: ['Account disabled', 'Your account has been disabled. Contact support if this is a mistake.'],
  TOKEN_EXPIRED: ['Session expired', 'Your session expired. Please sign in again.'],
};
const sessionMessage = (code) => SESSION_MESSAGES[code] || ['Session ended', 'Please sign in again to continue.'];

let sessionNoticeShown = false;
api.interceptors.response.use(
  (res) => {
    const b = res.data;
    if (b && typeof b === 'object' && 'success' in b) return { data: b.data, message: b.message, pagination: b.pagination };
    return { data: b, message: undefined, pagination: undefined };
  },
  (err) => {
    if (axios.isCancel(err)) return Promise.reject(err);
    const status = err.response?.status;
    const body = err.response?.data;
    let message;
    if (!err.response) {
      message = err.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : "Can't reach the server. Check that the API is running and your connection is up.";
    } else {
      message = (body && typeof body === 'object' && body.message) || `Request failed (${status})`;
    }
    const e = new Error(message);
    e.status = status || 0;
    e.errors = body?.errors;
    e.data = body?.data;
    e.network = !err.response;
    if (status === 401 && err.config?.headers?.Authorization && !err.config.skipAuthRedirect) {
      onUnauthorized();
      if (!sessionNoticeShown) {
        sessionNoticeShown = true;
        const [title, msg] = sessionMessage(body?.errors?.code);
        notify.info({ title, message: msg }).then(() => { sessionNoticeShown = false; });
      }
    }
    return Promise.reject(e);
  },
);

export const errMsg = (e) => (e && e.message) || 'Something went wrong';
