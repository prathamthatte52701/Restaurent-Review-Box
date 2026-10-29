import { create } from 'zustand';
import { api, setUnauthorizedHandler } from '../lib/api.js';
import { getToken, setToken } from '../lib/tokenStorage.js';

const initial = getToken();

export const useAuth = create((set, get) => ({
  token: initial,
  user: null,
  isAuthenticated: false,
  isHydrating: Boolean(initial),
  hydrateError: null,

  setSession: ({ token, user }) => {
    if (token) setToken(token);
    set((s) => ({ token: token || s.token, user: user ?? s.user, isAuthenticated: true, isHydrating: false, hydrateError: null }));
  },
  setToken: (token) => { setToken(token); set({ token }); },
  setUser: (user) => set({ user }),
  clear: () => {
    setToken(null);
    set({ token: null, user: null, isAuthenticated: false, isHydrating: false, hydrateError: null });
  },
  hydrate: async () => {
    if (!get().token) return set({ isHydrating: false });
    set({ isHydrating: true, hydrateError: null });
    try {
      const { data } = await api.get('/auth/me', { silentAuth: true });
      if (!data?.user) throw Object.assign(new Error('bad'), { status: 401 });
      set({ user: data.user, isAuthenticated: true, isHydrating: false });
    } catch (e) {
      if (e.status === 401 || e.status === 403 || (e.status >= 400 && e.status < 500)) get().clear();
      else set({ isHydrating: false, hydrateError: e.message }); // server down: keep the token, let the user retry
    }
  },
}));

setUnauthorizedHandler(() => useAuth.getState().clear());
