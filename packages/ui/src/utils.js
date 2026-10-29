import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

/** Merge class names (clsx). */
export const cn = (...args) => clsx(...args);

/** Safe renderable text: never crashes on objects/arrays/null. */
export const asText = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

export const asArray = (v) => (Array.isArray(v) ? v : []);

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), Number(delay) || 0);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** useMediaQuery('(max-width: 639px)') -> boolean. SSR-safe. */
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const on = () => setM(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return m;
}
