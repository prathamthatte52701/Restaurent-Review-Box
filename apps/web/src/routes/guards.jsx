import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { BrandMark, ErrorState, Spinner } from '@rrb/ui';
import { useAuth } from '../store/auth.js';
import { safeNext } from '../lib/schemas.js';

export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg" role="status" aria-label="Loading">
      <BrandMark size={44} />
      <Spinner size={20} />
    </div>
  );
}

/** Requires a session. Remembers where the user was heading via ?next=. */
export function ProtectedRoute() {
  const { isAuthenticated, isHydrating, hydrateError, hydrate } = useAuth();
  const loc = useLocation();
  if (isHydrating) return <BootScreen />;
  if (hydrateError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ErrorState title="We couldn't check your session" description={hydrateError} onRetry={hydrate} />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

/** Login/signup pages: logged-in visitors are sent on to ?next= (or home). */
export function GuestRoute() {
  const { isAuthenticated, isHydrating } = useAuth();
  const [params] = useSearchParams();
  if (isHydrating) return <BootScreen />;
  if (isAuthenticated) return <Navigate to={safeNext(params.get('next'))} replace />;
  return <Outlet />;
}

