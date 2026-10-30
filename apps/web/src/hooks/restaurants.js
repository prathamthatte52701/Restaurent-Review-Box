import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const get = (url, params, signal) => api.get(url, { params, signal });

/** Listing + facets. Previous results stay on screen while the next load; axios `signal` cancels superseded requests. */
export function useRestaurants(params, { enabled = true, keep = true } = {}) {
  return useQuery({
    queryKey: ['restaurants', params],
    queryFn: ({ signal }) => get('/restaurants', params, signal),
    placeholderData: keep ? keepPreviousData : undefined,
    enabled,
  });
}
export function useNearby(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['nearby', params],
    queryFn: ({ signal }) => get('/restaurants/nearby', params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
export function useRestaurant(slug) {
  return useQuery({
    queryKey: ['restaurant', slug],
    queryFn: ({ signal }) => get(`/restaurants/${encodeURIComponent(slug)}`, undefined, signal),
    staleTime: 30_000,
  });
}
export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: ({ signal }) => get('/cities', { limit: 50 }, signal), staleTime: 10 * 60_000 });
}
export function useSuggest(q) {
  return useQuery({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) => get('/search/suggest', { q }, signal),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
