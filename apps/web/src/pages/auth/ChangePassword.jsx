import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Container, FormField, PageHeader, notify } from '@rrb/ui';
import { FormBanner } from '../../components/auth/AuthShell.jsx';
import { PasswordInput } from '../../components/auth/PasswordInput.jsx';
import { PasswordStrength } from '../../components/auth/PasswordStrength.jsx';
import { useChangePassword } from '../../hooks/auth.js';
import { changeSchema } from '../../lib/schemas.js';
import { applyApiError } from '../../lib/formErrors.js';

export default function ChangePassword() {
  const change = useChangePassword();
  const navigate = useNavigate();
  const [banner, setBanner] = useState(null);
  const busy = useRef(false);
  const { register, handleSubmit, setError, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = async (v) => {
    if (busy.current) return;
    busy.current = true;
    setBanner(null);
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      reset();
      notify.success('Password changed', 'Use your new password the next time you log in.');
    } catch (e) {
      setBanner(applyApiError(e, setError, ['currentPassword', 'newPassword']));
    } finally {
      busy.current = false;
    }
  };

  return (
    <Container size="sm" className="py-10">
      <PageHeader eyebrow="Account" title="Change password" description="Pick something you don't use anywhere else." />
      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FormBanner>{banner}</FormBanner>
          <FormField label="Current password" required error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField label="New password" required error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...register('newPassword')} />
          </FormField>
          <PasswordStrength password={watch('newPassword')} />
          <FormField label="Confirm new password" required error={errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...register('confirm')} />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={change.isPending}>Update password</Button>
          </div>
        </form>
      </Card>
    </Container>
  );
}
