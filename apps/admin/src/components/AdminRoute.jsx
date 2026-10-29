import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/auth.js';

export function AdminRoute() {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}
