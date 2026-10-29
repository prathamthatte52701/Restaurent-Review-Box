import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

/** Active masters (cities | cuisines | amenities) for selects. */
export function useMasters(key) {
  return useQuery({
    queryKey: ['masters', key],
    queryFn: async () => (await api.get(`/${key}`, { params: { limit: 100, sort: 'name', order: 'asc' } })).data,
    staleTime: 60_000,
  });
}
