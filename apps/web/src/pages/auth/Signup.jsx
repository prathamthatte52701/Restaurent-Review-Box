import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import { Button, FormField, Input, Spinner } from '@rrb/ui';
import { AuthShell, FormBanner } from '../../components/auth/AuthShell.jsx';
import { PasswordInput } from '../../components/auth/PasswordInput.jsx';
import { PasswordStrength } from '../../components/auth/PasswordStrength.jsx';
import { useRegister, useUsernameAvailability } from '../../hooks/auth.js';
import { signupSchema } from '../../lib/schemas.js';
import { applyApiError } from '../../lib/formErrors.js';

function UsernameStatus({ status }) {
  if (status === 'checking') return <Spinner size={14} label="Checking username" />;
  if (status === 'available') return <Check className="!text-success" aria-label="Username available" />;
  if (status === 'taken') return <X className="!text-danger" aria-label="Username taken" />;
  return null;
}

export default function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const signup = useRegister();
  const [banner, setBanner] = useState(null);
  const busy = useRef(false);
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', username: '', email: '', phone: '', password: '' },
  });
  const username = watch('username');
  const password = watch('password');
  const avail = useUsernameAvailability(username);

  const onSubmit = async (v) => {
    if (busy.current) return;
    if (avail.status === 'taken') return setError('username', { type: 'server', message: 'This username is taken. Try another.' });
    busy.current = true;
    setBanner(null);
    try {
      const body = { ...v, username: v.username.toLowerCase(), email: v.email.toLowerCase() };
      if (!body.phone) delete body.phone;
      const d = await signup.mutateAsync(body);
      const next = params.get('next');
      navigate(`/verify-otp?email=${encodeURIComponent(d?.email || body.email)}&sent=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    } catch (e) {
      setBanner(applyApiError(e, setError, ['fullName', 'username', 'email', 'phone', 'password']));
    } finally {
      busy.current = false;
    }
  };

  const userHint = avail.status === 'available' ? 'Nice, that username is free.' : 'Letters, numbers and underscores. 3-30 characters.';

  return (
    <AuthShell
      title="Join Review Box"
      description="Your honest take helps the next hungry person in Indore."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormBanner>{banner}</FormBanner>
        <FormField label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" autoFocus placeholder="Aarti Sharma" {...register('fullName')} />
        </FormField>
        <FormField label="Username" required error={errors.username?.message} hint={userHint}>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="aarti_eats" rightAdornment={<UsernameStatus status={avail.status} />} {...register('username')} />
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </FormField>
        <FormField label="Phone (optional)" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('phone')} />
        </FormField>
        <FormField label="Password" required error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...register('password')} />
        </FormField>
        <PasswordStrength password={password} />
        <Button type="submit" size="lg" loading={signup.isPending}>Create account</Button>
        <p className="text-center text-xs text-text-muted">We'll email you a 6-digit code to confirm your address.</p>
      </form>
    </AuthShell>
  );
}
