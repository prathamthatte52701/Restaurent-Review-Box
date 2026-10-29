import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { notify } from '@rrb/ui';

const COPY = { title: 'Unsaved changes', message: 'You have unsaved changes. Leave anyway?', confirmLabel: 'Leave', cancelLabel: 'Stay', danger: true };

/** Resolves true when it is fine to discard the changes (nothing dirty, or the user confirmed). */
export const confirmDiscard = (dirty) => (dirty ? notify.confirm(COPY) : Promise.resolve(true));

/**
 * Warn before in-app navigation (React Router blocker, needs a data router) and tab close/refresh (beforeunload)
 * while `dirty`. Returns `allowLeave()`: call it right before a navigation that follows a successful save.
 */
export function useUnsavedGuard(dirty) {
  const bypass = useRef(false);
  const active = dirty && !bypass.current;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !bypass.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirmDiscard(true).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker]);

  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);

  return useCallback(() => { bypass.current = true; }, []);
}
