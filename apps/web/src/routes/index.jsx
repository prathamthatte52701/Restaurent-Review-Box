import { createBrowserRouter, isRouteErrorResponse, Link, Outlet, ScrollRestoration, useRouteError } from 'react-router-dom';
import { ErrorState, Button } from '@rrb/ui';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { GuestRoute, ProtectedRoute } from './guards.jsx';
import { setNavigator } from '../lib/api.js';
import Home from '../pages/Home.jsx';
import UiKit from '../pages/UiKit.jsx';
import { NotFound, Profile, Restaurants } from '../pages/Placeholders.jsx';
import Login from '../pages/auth/Login.jsx';
import Signup from '../pages/auth/Signup.jsx';
import VerifyOtp from '../pages/auth/VerifyOtp.jsx';
import ForgotPassword from '../pages/auth/ForgotPassword.jsx';
import ResetPassword from '../pages/auth/ResetPassword.jsx';
import ChangePassword from '../pages/auth/ChangePassword.jsx';

function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  if (notFound) return <NotFound />;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <ErrorState title="This page hit a snag" description="Something unexpected happened while loading it." onRetry={() => window.location.reload()} retryLabel="Reload" />
      <Button as={Link} to="/" variant="ghost">Home</Button>
    </div>
  );
}

function Root() {
  return (<><Outlet /><ScrollRestoration /></>);
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'restaurants', element: <Restaurants /> },
          { path: 'ui-kit', element: <UiKit /> },
          { element: <ProtectedRoute />, children: [{ path: 'profile', element: <Profile /> }, { path: 'change-password', element: <ChangePassword /> }] },
          { path: '*', element: <NotFound /> },
        ],
      },
      { element: <GuestRoute />, children: [{ path: 'login', element: <Login /> }, { path: 'signup', element: <Signup /> }, { path: 'verify-otp', element: <VerifyOtp /> }, { path: 'forgot-password', element: <ForgotPassword /> }] },
      { path: 'reset-password', element: <ResetPassword /> },
    ],
  },
]);

setNavigator((to, opts) => router.navigate(to, opts));
