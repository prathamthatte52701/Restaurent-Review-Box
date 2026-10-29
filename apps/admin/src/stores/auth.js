import { create } from 'zustand';
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api.js';

export const NOT_ADMIN = "This account doesn't have admin access";

export const useAuth = create((set, get) => ({
  token: getToken(),
  user: null,
  isHydrating: Boolean(getToken()),

  async login(identifier, password) {
    const id = identifier.trim();
    const body = id.includes('@') ? { email: id, password } : { username: id, password };
    const { data } = await api.post('/auth/login', body, { skipAuthRedirect: true });
    if (data?.user?.role !== 'admin') throw Object.assign(new Error(NOT_ADMIN), { status: 403 });
    setToken(data.token);
    set({ token: data.token, user: data.user, isHydrating: false });
  },

  async hydrate() {
    if (!get().token) return set({ isHydrating: false });
    try {
      const { data } = await api.get('/auth/me', { skipAuthRedirect: true });
      if (data?.user?.role !== 'admin') throw new Error('not admin');
      set({ user: data.user, isHydrating: false });
    } catch (e) {
      // network failure keeps the token (user can retry); anything else is a clean logout
      if (e.network) return set({ isHydrating: false, user: null, hydrateError: e.message });
      get().clear();
    }
  },

  clear() {
    setToken(null);
    set({ token: null, user: null, isHydrating: false, hydrateError: undefined });
  },

  async logout() {
    try { await api.post('/auth/logout', null, { skipAuthRedirect: true }); } catch { /* best effort */ }
    get().clear();
  },
}));

setUnauthorizedHandler(() => useAuth.getState().clear());
