import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormField, Input } from '@rrb/ui';
import { AuthShell, FormBanner } from '../../components/auth/AuthShell.jsx';
import { PasswordInput } from '../../components/auth/PasswordInput.jsx';
import { useLogin } from '../../hooks/auth.js';
import { loginSchema, safeNext } from '../../lib/schemas.js';
import { applyApiError } from '../../lib/formErrors.js';

export default function Login() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const login = useLogin();
  const [banner, setBanner] = useState(null);
  const busy = useRef(false);
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { identifier: '', password: '' } });

  const onSubmit = async (v) => {
    if (busy.current) return;
    busy.current = true;
    setBanner(null);
    try {
      await login.mutateAsync(v);
      navigate(next, { replace: true });
    } catch (e) {
      if (e.requiresVerification) {
        navigate(`/verify-otp?email=${encodeURIComponent(e.email || (v.identifier.includes('@') ? v.identifier : ''))}&sent=0&next=${encodeURIComponent(next)}`, { replace: true });
      } else {
        setBanner(applyApiError(e, setError, ['identifier', 'email', 'username', 'password']));
      }
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Log in to write reviews, save favourites and see what your friends are eating."
      footer={<>New here? <Link to="/signup" className="font-medium text-primary hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormBanner>{banner}</FormBanner>
        <FormField label="Email or username" error={errors.identifier?.message}>
          <Input autoComplete="username" autoFocus placeholder="you@example.com" {...register('identifier')} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" placeholder="Your password" {...register('password')} />
        </FormField>
        <div className="-mt-2 text-right text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending}>Log in</Button>
      </form>
    </AuthShell>
  );
}
