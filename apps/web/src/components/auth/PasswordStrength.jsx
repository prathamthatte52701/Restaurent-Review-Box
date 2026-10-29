import { cn } from '@rrb/ui';

export function scorePassword(pw = '') {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 8) return 1;
  return Math.max(1, s);
}
const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const tones = ['', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-success'];

export function PasswordStrength({ password }) {
  const score = scorePassword(password);
  return (
    <div className="mt-1" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-base', i <= score ? tones[score] : 'bg-border')} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-text-muted">
        {password ? <>Strength: <span className="font-medium text-text">{labels[score]}</span>{password.length < 8 ? ' - use at least 8 characters' : ''}</> : 'Use 8+ characters. A mix of cases, numbers and symbols is stronger.'}
      </p>
    </div>
  );
}
