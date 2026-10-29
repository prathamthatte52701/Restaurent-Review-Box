import { lazy, Suspense } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Link, Outlet, ScrollRestoration, useRouteError } from 'react-router-dom';
import { ErrorState, Button, PageSkeleton } from '@rrb/ui';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { GuestRoute, ProtectedRoute } from './guards.jsx';
import { setNavigator } from '../lib/api.js';
const Home = lazy(() => import('../pages/Home.jsx'));
const UiKit = lazy(() => import('../pages/UiKit.jsx'));
const Restaurants = lazy(() => import('../pages/Placeholders.jsx').then((m) => ({ default: m.Restaurants })));
const Profile = lazy(() => import('../pages/Placeholders.jsx').then((m) => ({ default: m.Profile })));
const NotFound = lazy(() => import('../pages/Placeholders.jsx').then((m) => ({ default: m.NotFound })));
const Login = lazy(() => import('../pages/auth/Login.jsx'));
const Signup = lazy(() => import('../pages/auth/Signup.jsx'));
const VerifyOtp = lazy(() => import('../pages/auth/VerifyOtp.jsx'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword.jsx'));
const ChangePassword = lazy(() => import('../pages/auth/ChangePassword.jsx'));

const S = ({ children }) => <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;

function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  if (notFound) return <S><NotFound /></S>;
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
          { index: true, element: <S><Home /></S> },
          { path: 'restaurants', element: <S><Restaurants /></S> },
          { path: 'ui-kit', element: <S><UiKit /></S> },
          { element: <ProtectedRoute />, children: [{ path: 'profile', element: <S><Profile /></S> }, { path: 'change-password', element: <S><ChangePassword /></S> }] },
          { path: '*', element: <S><NotFound /></S> },
        ],
      },
      { element: <GuestRoute />, children: [{ path: 'login', element: <S><Login /></S> }, { path: 'signup', element: <S><Signup /></S> }, { path: 'verify-otp', element: <S><VerifyOtp /></S> }, { path: 'forgot-password', element: <S><ForgotPassword /></S> }] },
      { path: 'reset-password', element: <S><ResetPassword /></S> },
    ],
  },
]);

setNavigator((to, opts) => router.navigate(to, opts));
