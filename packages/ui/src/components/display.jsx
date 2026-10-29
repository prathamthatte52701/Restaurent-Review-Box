import { forwardRef, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Inbox, Star, UtensilsCrossed } from 'lucide-react';
import { cn, asText } from '../utils.js';
import { Button } from './Button.jsx';

/* ---------- Layout ---------- */
export function Container({ as: Comp = 'div', size = 'lg', className, ...rest }) {
  const w = { sm: 'max-w-2xl', md: 'max-w-4xl', lg: 'max-w-6xl', xl: 'max-w-7xl', full: 'max-w-none' }[size] || 'max-w-6xl';
  return <Comp className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', w, className)} {...rest} />;
}

export function Divider({ orientation = 'horizontal', className, label }) {
  if (orientation === 'vertical') return <div role="separator" aria-orientation="vertical" className={cn('w-px self-stretch bg-border', className)} />;
  if (label) {
    return (
      <div role="separator" className={cn('flex items-center gap-3 text-xs uppercase tracking-wider text-text-muted', className)}>
        <span className="h-px flex-1 bg-border" />
        {label}
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className={cn('h-px w-full border-0 bg-border', className)} />;
}

/* ---------- Card ---------- */
export const Card = forwardRef(function Card({ as: Comp = 'div', interactive, className, ...rest }, ref) {
  return (
    <Comp
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-surface-raised shadow-xs',
        interactive && 'transition-[border-color,box-shadow,transform] duration-base ease-standard hover:border-border-strong hover:shadow-md',
        className,
      )}
      {...rest}
    />
  );
});
export const CardHeader = ({ className, ...p }) => <div className={cn('flex flex-col gap-1 border-b border-border px-5 py-4', className)} {...p} />;
export const CardTitle = ({ as: Comp = 'h3', className, ...p }) => <Comp className={cn('font-display text-lg font-medium tracking-tight', className)} {...p} />;
export const CardBody = ({ className, ...p }) => <div className={cn('px-5 py-5', className)} {...p} />;
export const CardFooter = ({ className, ...p }) => <div className={cn('flex items-center justify-end gap-2 border-t border-border px-5 py-3', className)} {...p} />;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Body = CardBody;
Card.Footer = CardFooter;

/* ---------- Badge ---------- */
const badgeV = {
  neutral: 'bg-text/[0.07] text-text-muted border-border',
  primary: 'bg-primary-soft text-primary border-primary/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/20',
  outline: 'bg-transparent text-text border-border-strong',
};
export function Badge({ variant = 'neutral', dot, className, children, ...rest }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-4', badgeV[variant] || badgeV.neutral, className)} {...rest}>
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
const avSizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' };
const initialsOf = (name) => {
  const parts = asText(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};
export function Avatar({ src, name, alt, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  const show = typeof src === 'string' && src && !failed;
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-soft font-medium text-primary', avSizes[size] || avSizes.md, className)}>
      {show ? (
        <img src={src} alt={alt ?? asText(name)} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span aria-label={asText(name) || undefined} role={name ? 'img' : undefined}>{initialsOf(name)}</span>
      )}
    </span>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className, circle, ...rest }) {
  return <div aria-hidden="true" className={cn('rrb-skeleton animate-shimmer rounded-md', circle && 'rounded-full', 'h-4 w-full', className)} {...rest} />;
}

/** Route-level Suspense fallback: header + block skeleton, keeps layout steady while a lazy page loads. */
export function PageSkeleton({ className }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading page" className={cn('mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8', className)}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/* ---------- Logo ---------- */
export function BrandMark({ size = 32, className }) {
  const s = Number(size) || 32;
  return (
    <span aria-hidden="true" style={{ width: s, height: s }} className={cn('inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-sm', className)}>
      <UtensilsCrossed width={s * 0.55} height={s * 0.55} strokeWidth={2} />
    </span>
  );
}
export function Logo({ size = 'md', showMark = true, className, ...rest }) {
  const t = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' }[size] || 'text-xl';
  const m = { sm: 24, md: 30, lg: 38 }[size] || 30;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} {...rest}>
      {showMark ? <BrandMark size={m} /> : null}
      <span className={cn('font-display font-medium tracking-tight text-text', t)}>
        Review <span className="italic text-primary">Box</span>
      </span>
    </span>
  );
}

/* ---------- StarRating ---------- */
export function StarRating({ value = 0, max = 5, onChange, readOnly, size = 18, className, label }) {
  const [hover, setHover] = useState(null);
  const m = Math.min(10, Math.max(1, Math.floor(Number(max)) || 5));
  const v = Math.min(m, Math.max(0, Number(value) || 0));
  const s = Number(size) || 18;
  const interactive = !readOnly && typeof onChange === 'function';
  const shown = hover ?? v;
  if (!interactive) {
    return (
      <span role="img" aria-label={label || `${v} out of ${m} stars`} className={cn('inline-flex gap-0.5', className)}>
        {Array.from({ length: m }, (_, i) => {
          const fill = Math.min(1, Math.max(0, v - i));
          return (
            <span key={i} className="relative inline-block" style={{ width: s, height: s }}>
              <Star width={s} height={s} className="absolute inset-0 text-border-strong" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star width={s} height={s} className="fill-primary text-primary" style={{ maxWidth: 'none' }} />
              </span>
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <span role="radiogroup" aria-label={label || 'Rating'} className={cn('inline-flex gap-0.5', className)} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: m }, (_, i) => {
        const n = i + 1;
        const checked = Math.round(v) === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            tabIndex={checked || (!Math.round(v) && n === 1) ? 0 : -1}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const next = Math.min(m, Math.max(1, n + dir));
              onChange(next);
              e.currentTarget.parentElement?.children[next - 1]?.focus();
            }}
            className="rounded-xs p-0.5 transition-transform duration-fast hover:scale-110"
          >
            <Star width={s} height={s} className={cn('transition-colors', n <= shown ? 'fill-primary text-primary' : 'text-border-strong')} />
          </button>
        );
      })}
    </span>
  );
}

/* ---------- Stat ---------- */
export function Stat({ label, value, delta, hint, icon, className }) {
  const d = Number(delta);
  const hasDelta = delta !== undefined && delta !== null && delta !== '' && Number.isFinite(d);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        {asText(label)}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-display-md tabular-nums">{asText(value)}</span>
        {hasDelta ? (
          <span className={cn('inline-flex items-center text-xs font-medium', d >= 0 ? 'text-success' : 'text-danger')}>
            {d >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(d)}%
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
export function StatCard({ className, ...p }) {
  return (
    <Card className={cn('p-5', className)}>
      <Stat {...p} />
    </Card>
  );
}

/* ---------- States ---------- */
export function EmptyState({ icon, title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-muted">{icon || <Inbox className="h-5 w-5" />}</span>
      <h3 className="font-display text-lg font-medium">{asText(title)}</h3>
      {description ? <p className="max-w-sm text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, error, onRetry, retryLabel = 'Try again', className }) {
  const msg = description ?? (typeof error === 'string' ? error : error?.message) ?? 'Please try again in a moment.';
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertTriangle className="h-5 w-5" /></span>
      <h3 className="font-display text-lg font-medium">{asText(title)}</h3>
      <p className="max-w-sm text-sm text-text-muted">{asText(msg) || 'Please try again in a moment.'}</p>
      {typeof onRetry === 'function' ? <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">{retryLabel}</Button> : null}
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions, breadcrumb, className }) {
  return (
    <header className={cn('flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-2 text-sm text-text-muted">{breadcrumb}</div> : null}
        {eyebrow ? <p className="mb-2 text-eyebrow uppercase text-primary">{eyebrow}</p> : null}
        <h1 className="text-display-md text-text sm:text-display-lg">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
