import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, NotificationProvider, TooltipProvider } from '@rrb/ui';
import '@rrb/ui/styles.css';
import { queryClient } from './lib/queryClient.js';
import { router } from './routes/index.jsx';
import { useAuth } from './store/auth.js';

useAuth.getState().hydrate();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
          </NotificationProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
