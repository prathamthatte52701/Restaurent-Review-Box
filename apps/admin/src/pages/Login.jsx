import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { BrandMark, Button, FormField, IconButton, Input, ThemeToggle } from '@rrb/ui';
import { useAuth } from '../stores/auth.js';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  const user = useAuth((s) => s.user);
  const login = useAuth((s) => s.login);
  const nav = useNavigate();
  const loc = useLocation();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '' } });

  if (user?.role === 'admin') return <Navigate to={loc.state?.from || '/'} replace />;

  const submit = async (v) => {
    setFormError('');
    try {
      await login(v.identifier, v.password);
      nav(loc.state?.from || '/', { replace: true });
    } catch (e) {
      setFormError(e.message);
    }
  };

  return (
    <div className="grid min-h-dvh bg-bg text-text lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface-overlay p-12 lg:flex">
        <div className="flex items-center gap-2.5 font-display text-xl font-medium"><BrandMark size={30} /> Restaurant Review Box</div>
        <div className="max-w-md">
          <p className="text-eyebrow uppercase text-primary">Admin console</p>
          <h1 className="mt-3 font-display text-display-lg">Curate the best tables in town.</h1>
          <p className="mt-4 text-text-muted">Manage the restaurants, cities, cuisines and amenities that power the discovery experience.</p>
        </div>
        <p className="text-sm text-text-muted">Restricted area. Authorised staff only.</p>
      </aside>
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <form onSubmit={handleSubmit(submit)} noValidate className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><ShieldCheck className="h-5 w-5" /></span>
            <h1 className="font-display text-display-sm">Admin sign in</h1>
            <p className="text-sm text-text-muted">Use your administrator credentials.</p>
          </div>
          {formError ? <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{formError}</div> : null}
          <div className="flex flex-col gap-4">
            <FormField label="Email or username" error={errors.identifier?.message}>
              <Input autoComplete="username" autoFocus {...register('identifier')} />
            </FormField>
            <FormField label="Password" error={errors.password?.message}>
              <Input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                rightAdornment={<IconButton type="button" size="sm" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} icon={show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} className="-mr-2" />}
                {...register('password')}
              />
            </FormField>
            <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">Sign in</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
