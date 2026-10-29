import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button, FormField, Input } from '@rrb/ui';
import { AuthShell, FormBanner } from '../../components/auth/AuthShell.jsx';
import { useForgotPassword } from '../../hooks/auth.js';
import { forgotSchema } from '../../lib/schemas.js';
import { applyApiError } from '../../lib/formErrors.js';

export default function ForgotPassword() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState(null);
  const [banner, setBanner] = useState(null);
  const busy = useRef(false);
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = async (v) => {
    if (busy.current) return;
    busy.current = true;
    setBanner(null);
    try {
      await forgot.mutateAsync({ email: v.email.toLowerCase() });
      setSentTo(v.email);
    } catch (e) {
      setBanner(applyApiError(e, setError, ['email']));
    } finally {
      busy.current = false;
    }
  };

  const back = <Link to="/login" className="font-medium text-primary hover:underline">Back to log in</Link>;

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" footer={back}>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success"><MailCheck className="h-6 w-6" /></span>
          <p className="text-sm text-text-muted">If an account exists for <span className="break-all font-medium text-text">{sentTo}</span>, a password reset link is on its way. It expires in about an hour.</p>
          <Button variant="secondary" onClick={() => setSentTo(null)}>Use a different email</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" description="Enter your email and we'll send you a link to choose a new one." footer={back}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormBanner>{banner}</FormBanner>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus placeholder="you@example.com" {...register('email')} />
        </FormField>
        <Button type="submit" size="lg" loading={forgot.isPending}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
