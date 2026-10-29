import { useMutation, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@rrb/ui';
import { api } from '../lib/api.js';
import { queryClient } from '../lib/queryClient.js';
import { useAuth } from '../store/auth.js';
import { USERNAME_RE } from '../lib/schemas.js';

const silent = { silent: true };

export const useLogin = () => {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    meta: silent,
    mutationFn: async ({ identifier, password }) => {
      const id = identifier.trim();
      const body = { identifier: id, password, ...(id.includes('@') ? { email: id } : { username: id }) };
      return (await api.post('/auth/login', body)).data;
    },
    onSuccess: (d) => setSession(d),
  });
};

export const useRegister = () => useMutation({ meta: silent, mutationFn: async (b) => (await api.post('/auth/register', b)).data });

export const useVerifyOtp = () => {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({ meta: silent, mutationFn: async (b) => (await api.post('/auth/verify-otp', b)).data, onSuccess: (d) => setSession(d) });
};

export const useResendOtp = () => useMutation({ meta: silent, mutationFn: async (b) => (await api.post('/auth/resend-otp', b)).data });

export const useMe = () => {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const setUser = useAuth((s) => s.setUser);
  return useQuery({ queryKey: ['me'], enabled: isAuthenticated, queryFn: async () => { const u = (await api.get('/auth/me')).data.user; setUser(u); return u; } });
};

export const useLogout = () => {
  const clear = useAuth((s) => s.clear);
  return useMutation({
    meta: silent,
    mutationFn: async () => { try { await api.post('/auth/logout'); } catch { /* local logout must always succeed */ } },
    onSettled: () => { clear(); queryClient.clear(); },
  });
};

export const useLogoutAll = () => {
  const clear = useAuth((s) => s.clear);
  return useMutation({
    meta: silent,
    mutationFn: async () => { try { await api.post('/auth/logout-all'); } catch { /* local logout must always succeed */ } },
    onSettled: () => { clear(); queryClient.clear(); },
  });
};

export const useForgotPassword = () => useMutation({ meta: silent, mutationFn: async (b) => (await api.post('/auth/forgot-password', b)).data });
export const useResetPassword = () => useMutation({ meta: silent, mutationFn: async (b) => (await api.post('/auth/reset-password', b)).data });
export const useChangePassword = () => {
  const setToken = useAuth((s) => s.setToken);
  return useMutation({
    meta: silent,
    mutationFn: async (b) => (await api.post('/auth/change-password', b)).data,
    onSuccess: (d) => { if (d?.token) setToken(d.token); },
  });
};

/** Debounced live check. status: 'idle' | 'checking' | 'available' | 'taken' | 'unknown' */
export function useUsernameAvailability(raw) {
  const name = (raw || '').trim().toLowerCase();
  const debounced = useDebounce(name, 450);
  const valid = USERNAME_RE.test(name);
  const q = useQuery({
    queryKey: ['username', debounced],
    enabled: USERNAME_RE.test(debounced),
    staleTime: 20_000,
    meta: silent,
    retry: false,
    queryFn: async () => (await api.get('/auth/check-username', { params: { username: debounced } })).data.available,
  });
  if (!valid) return { status: 'idle' };
  if (debounced !== name || q.isFetching) return { status: 'checking' };
  if (q.isError) return { status: 'unknown' };
  return { status: q.data === false ? 'taken' : q.data ? 'available' : 'checking' };
}
