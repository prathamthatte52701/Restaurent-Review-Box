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
        notify.info({ title: 'Session ended', message: 'Please sign in again to continue.' }).then(() => { sessionNoticeShown = false; });
      }
    }
    return Promise.reject(e);
  },
);

export const errMsg = (e) => (e && e.message) || 'Something went wrong';
