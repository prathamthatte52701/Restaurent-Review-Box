import { useCallback, useEffect, useRef, useState } from 'react';

const MESSAGES = {
  unsupported: "This browser can't share your location.",
  denied: 'Location access is blocked. Allow it in your browser settings, or pick a city instead.',
  timeout: "We couldn't get your location in time. Try again, or pick a city instead.",
  unavailable: "Your device couldn't work out where you are. Try again, or pick a city instead.",
};

/** status: idle | locating | error. Never throws; always resolves to coords or a readable error. */
export function useGeolocation(onFix) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const cb = useRef(onFix);
  cb.current = onFix;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setError({ code: 'unsupported', message: MESSAGES.unsupported });
      return;
    }
    setStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return;
        setStatus('idle');
        cb.current?.({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (!alive.current) return;
        const code = err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable';
        setStatus('error');
        setError({ code, message: MESSAGES[code] });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);
  return { status, error, locate, reset };
}
