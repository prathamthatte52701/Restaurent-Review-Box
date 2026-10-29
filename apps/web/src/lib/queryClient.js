import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { notify } from '@rrb/ui';

// Queries render their own inline ErrorState; mutations surface a modal unless meta.silent (forms handle their own).
export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (mutation.meta?.silent) return;
      notify.error('Something went wrong', error?.message || 'Please try again.');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err?.status >= 400 && err?.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});
