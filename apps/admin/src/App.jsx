import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorState, Spinner } from '@rrb/ui';
import { useAuth } from './stores/auth.js';
import { AdminRoute } from './components/AdminRoute.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MasterPage from './features/masters/MasterPage.jsx';
import { masterConfigs } from './features/masters/configs.js';
import RestaurantList from './features/restaurants/RestaurantList.jsx';
import BulkImport from './features/restaurants/BulkImport.jsx';

// the form pulls in leaflet; keep it out of the main chunk
const RestaurantForm = lazy(() => import('./features/restaurants/form/RestaurantForm.jsx'));

const Fallback = () => <div className="flex justify-center py-24"><Spinner size={24} /></div>;

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
          title="Can't reach the server"
          description={hydrateError}
          onRetry={() => { useAuth.setState({ isHydrating: true, hydrateError: undefined }); hydrate(); }}
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AdminRoute />}>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          {Object.values(masterConfigs).map((c) => <Route key={c.path} path={c.path} element={<MasterPage config={c} />} />)}
          <Route path="restaurants" element={<RestaurantList />} />
          <Route path="restaurants/import" element={<BulkImport />} />
          <Route path="restaurants/new" element={<Suspense fallback={<Fallback />}><RestaurantForm /></Suspense>} />
          <Route path="restaurants/:id/edit" element={<Suspense fallback={<Fallback />}><RestaurantForm /></Suspense>} />
          <Route path="reviews" element={<Navigate to="/" replace />} />
          <Route path="users" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
