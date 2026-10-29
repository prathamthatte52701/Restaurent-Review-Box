import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ErrorState, FormField, notify } from '@rrb/ui';
import { AuthShell, FormBanner } from '../../components/auth/AuthShell.jsx';
import { PasswordInput } from '../../components/auth/PasswordInput.jsx';
import { PasswordStrength } from '../../components/auth/PasswordStrength.jsx';
import { useResetPassword } from '../../hooks/auth.js';
import { resetSchema } from '../../lib/schemas.js';
import { applyApiError } from '../../lib/formErrors.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const reset = useResetPassword();
  const [banner, setBanner] = useState(null);
  const busy = useRef(false);
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { newPassword: '', confirm: '' } });

  if (!email || !/^[a-f\d]{64}$/i.test(token)) {
    return (
      <AuthShell title="Reset link problem">
        <ErrorState
          className="rounded-lg border border-border bg-surface"
          title="This reset link is incomplete"
          description="The link may have been cut off in your email. Request a new one and try again."
        />
        <Button as={Link} to="/forgot-password" size="lg" className="mt-4 w-full">Request a new link</Button>
      </AuthShell>
    );
  }

  const onSubmit = async (v) => {
    if (busy.current) return;
    busy.current = true;
    setBanner(null);
    try {
      await reset.mutateAsync({ email, token, newPassword: v.newPassword });
      navigate('/login', { replace: true });
      notify.success('Password updated', 'You can now log in with your new password.');
    } catch (e) {
      const msg = applyApiError(e, setError, ['newPassword']);
      setBanner(msg);
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      description={<>For <span className="break-all font-medium text-text">{email}</span></>}
      footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to log in</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormBanner>{banner}</FormBanner>
        <FormField label="New password" required error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" autoFocus placeholder="At least 8 characters" {...register('newPassword')} />
        </FormField>
        <PasswordStrength password={watch('newPassword')} />
        <FormField label="Confirm new password" required error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" placeholder="Type it again" {...register('confirm')} />
        </FormField>
        <Button type="submit" size="lg" loading={reset.isPending}>Update password</Button>
        {banner ? <Button as={Link} to="/forgot-password" variant="ghost">Request a new link</Button> : null}
      </form>
    </AuthShell>
  );
}
