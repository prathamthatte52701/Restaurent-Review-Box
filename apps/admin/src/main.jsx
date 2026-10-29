import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { TooltipProvider, NotificationProvider, ErrorBoundary, notify } from '@rrb/ui';
import '@rrb/ui/styles.css';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => !(e?.status >= 400 && e?.status < 500) && n < 1 },
  },
  mutationCache: new MutationCache({
    onError: (e, _v, _c, m) => {
      if (m.options.meta?.silent || e?.status === 401) return;
      notify.error({ title: m.options.meta?.errorTitle || 'Action failed', message: e?.message });
    },
  }),
});

// data router (required by useBlocker); App still declares its own <Routes> under the splat route
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
