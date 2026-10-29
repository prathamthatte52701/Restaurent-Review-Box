import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorState, Spinner, PageSkeleton } from '@rrb/ui';
import { useAuth } from './stores/auth.js';
import { AdminRoute } from './components/AdminRoute.jsx';
import Shell from './components/Shell.jsx';
import { masterConfigs } from './features/masters/configs.js';

const Login = lazy(() => import('./pages/Login.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx')); // pulls recharts
const MasterPage = lazy(() => import('./features/masters/MasterPage.jsx'));
const RestaurantList = lazy(() => import('./features/restaurants/RestaurantList.jsx'));
const BulkImport = lazy(() => import('./features/restaurants/BulkImport.jsx'));
// the form pulls in leaflet; keep it out of the main chunk
const RestaurantForm = lazy(() => import('./features/restaurants/form/RestaurantForm.jsx'));

const S = ({ children }) => <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const isHydrating = useAuth((s) => s.isHydrating);
  const hydrateError = useAuth((s) => s.hydrateError);
  useEffect(() => { hydrate(); }, [hydrate]);

  if (isHydrating) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg text-text-muted">
        <Spinner size={28} />
        <p className="text-sm">Checking your session</p>
      </div>
    );
  }
  if (hydrateError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <ErrorState
          title="Server unreachable"
          description={hydrateError}
          onRetry={() => { useAuth.setState({ isHydrating: true, hydrateError: undefined }); hydrate(); }}
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<S><Login /></S>} />
      <Route element={<AdminRoute />}>
        <Route element={<Shell />}>
          <Route index element={<S><Dashboard /></S>} />
          {Object.values(masterConfigs).map((c) => <Route key={c.path} path={c.path} element={<S><MasterPage config={c} /></S>} />)}
          <Route path="restaurants" element={<S><RestaurantList /></S>} />
          <Route path="restaurants/import" element={<S><BulkImport /></S>} />
          <Route path="restaurants/new" element={<S><RestaurantForm /></S>} />
          <Route path="restaurants/:id/edit" element={<S><RestaurantForm /></S>} />
          <Route path="reviews" element={<Navigate to="/" replace />} />
          <Route path="users" element={<Navigate to="/" replace />} />
          <Route path="*" element={<S><NotFound /></S>} />
        </Route>
      </Route>
    </Routes>
  );
}
