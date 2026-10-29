export const TOKEN_KEY = 'rrb-token';
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};
