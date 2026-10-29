import { notify } from '@rrb/ui';

/**
 * Route an API failure to the right place: field errors -> RHF fields, rate limit/network/5xx -> modal,
 * anything else -> returns a message for an inline form banner.
 * @returns {string|null} inline banner message
 */
export function applyApiError(err, setError, fields) {
  const msg = err?.message || 'Something went wrong. Please try again.';
  if (err?.status === 429) { notify.warning('Please slow down', msg); return null; }
  if (err?.network || err?.status >= 500 || !err?.status) { notify.error(err?.network ? 'Connection problem' : 'Something went wrong', msg); return null; }
  let mapped = 0;
  for (const [k, v] of Object.entries(err.errors || {})) {
    if (fields.includes(k)) { setError(k, { type: 'server', message: v }); mapped++; }
  }
  return mapped ? null : msg;
}
