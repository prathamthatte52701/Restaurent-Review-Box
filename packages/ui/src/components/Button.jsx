import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils.js';

export function Spinner({ size = 16, className, label = 'Loading' }) {
  const s = Number(size) || 16;
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <Loader2 width={s} height={s} className="animate-spin" aria-hidden="true" />
    </span>
  );
}

const variants = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm border border-transparent',
  secondary: 'bg-surface-raised text-text border border-border hover:border-border-strong hover:bg-surface shadow-xs',
  outline: 'bg-transparent text-text border border-border-strong hover:bg-surface-raised',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-text/[0.06]',
  danger: 'bg-danger text-danger-fg hover:brightness-110 shadow-sm border border-transparent',
};
const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};
const iconSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

const base =
  'relative inline-flex items-center justify-center whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow,filter] duration-base ease-standard active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

/**
 * Button. Props: variant, size, loading, leftIcon, rightIcon, as (element/component, e.g. 'a'), disabled.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, as: Comp = 'button', disabled, className, children, type, ...rest },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);
  const extra = Comp === 'button' ? { type: type === 'submit' || type === 'reset' ? type : 'button', disabled: isDisabled } : { 'aria-disabled': isDisabled || undefined };
  return (
    <Comp
      ref={ref}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant] || variants.primary, sizes[size] || sizes.md, className)}
      {...extra}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 14} label="Loading" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </Comp>
  );
});

/** Icon-only button. `aria-label` is required (warns in dev, falls back to "Action"). */
export const IconButton = forwardRef(function IconButton(
  { 'aria-label': ariaLabel, variant = 'ghost', size = 'md', loading, className, children, icon, ...rest },
  ref,
) {
  if (!ariaLabel && typeof console !== 'undefined' && import.meta.env?.DEV) console.warn('[rrb/ui] IconButton requires aria-label');
  return (
    <Button
      ref={ref}
      aria-label={ariaLabel || 'Action'}
      variant={variant}
      size={size}
      loading={loading}
      className={cn('!px-0', iconSizes[size] || iconSizes.md, className)}
      {...rest}
    >
      {icon}
      {children}
    </Button>
  );
});
