import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { notify, Button } from '@rrb/ui';
import { AuthShell, FormBanner } from '../../components/auth/AuthShell.jsx';
import { OtpInput } from '../../components/auth/OtpInput.jsx';
import { useResendOtp, useVerifyOtp } from '../../hooks/auth.js';
import { safeNext } from '../../lib/schemas.js';

const COOLDOWN = 45;

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const sentAlready = params.get('sent') === '1';
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [left, setLeft] = useState(sentAlready ? COOLDOWN : 0);
  const busy = useRef(false);
  const autoSent = useRef(false);

  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const sendCode = async (auto) => {
    if (!email || resend.isPending) return;
    setError(null);
    try {
      await resend.mutateAsync({ email });
      setLeft(COOLDOWN);
      setInfo(auto ? 'We sent a fresh code to your inbox.' : 'A new code is on its way.');
      setCode('');
    } catch (e) {
      if (e.status === 429) notify.warning('Too many code requests', e.message);
      else setError(e.message);
    }
  };

  // arriving from a blocked login: the old code may be stale, so send a new one once
  useEffect(() => {
    if (!sentAlready && email && !autoSent.current) { autoSent.current = true; sendCode(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!email) return <Navigate to="/signup" replace />;

  const submit = async (otp) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setInfo(null);
    try {
      await verify.mutateAsync({ email, otp });
      navigate(next, { replace: true });
    } catch (e) {
      if (e.status === 429) notify.warning('Too many attempts', e.message);
      else if (e.network || e.status >= 500) notify.error('Connection problem', e.message);
      else setError(e.message);
      setCode('');
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthShell
      title="Check your email"
      description={<>Enter the 6-digit code we sent to <span className="break-all font-medium text-text">{email}</span>.</>}
      footer={<>Wrong address? <Link to="/signup" className="font-medium text-primary hover:underline">Start over</Link></>}
    >
      <div className="flex flex-col gap-5">
        <FormBanner>{error}</FormBanner>
        {info ? <p role="status" className="rounded-md border border-success/30 bg-success-soft px-3 py-2.5 text-sm text-success">{info}</p> : null}
        <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={verify.isPending} invalid={Boolean(error)} />
        <Button size="lg" loading={verify.isPending} disabled={code.length < 6} onClick={() => submit(code)}>Verify and continue</Button>
        <div className="text-center text-sm text-text-muted">
          {left > 0 ? (
            <span aria-live="polite">Resend code in <span className="tabular-nums font-medium text-text">{left}s</span></span>
          ) : (
            <>Didn't get it? <button type="button" onClick={() => sendCode(false)} disabled={resend.isPending} className="font-medium text-primary hover:underline disabled:opacity-50">Resend code</button></>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
