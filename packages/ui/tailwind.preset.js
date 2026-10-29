/**
 * @rrb/ui Tailwind preset. Colors are CSS variables (space-separated RGB channels,
 * defined in src/styles.css) so every utility supports opacity (bg-primary/10)
 * and the theme flips with [data-theme="dark"] without `dark:` variants.
 */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-raised': c('surface-raised'),
        'surface-overlay': c('surface-overlay'),
        border: c('border'),
        'border-strong': c('border-strong'),
        text: c('text'),
        'text-muted': c('text-muted'),
        primary: c('primary'),
        'primary-hover': c('primary-hover'),
        'primary-fg': c('primary-fg'),
        'primary-soft': c('primary-soft'),
        success: c('success'),
        'success-fg': c('success-fg'),
        'success-soft': c('success-soft'),
        warning: c('warning'),
        'warning-fg': c('warning-fg'),
        'warning-soft': c('warning-soft'),
        danger: c('danger'),
        'danger-fg': c('danger-fg'),
        'danger-soft': c('danger-soft'),
        ring: c('ring'),
        scrim: c('scrim'),
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // body scale: tight, quiet
        xs: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.005em' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.625rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.005em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        // display scale: confident serif, tight tracking
        'display-sm': ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.015em', fontWeight: '500' }],
        'display-md': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-lg': ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.025em', fontWeight: '500' }],
        'display-xl': ['3.75rem', { lineHeight: '3.875rem', letterSpacing: '-0.03em', fontWeight: '450' }],
        'display-2xl': ['5rem', { lineHeight: '5rem', letterSpacing: '-0.035em', fontWeight: '450' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em', fontWeight: '600' }],
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px' },
      boxShadow: {
        // restrained, warm-tinted; three levels only
        xs: '0 1px 0 0 rgb(var(--shadow) / 0.04)',
        sm: '0 1px 2px 0 rgb(var(--shadow) / 0.06), 0 1px 1px 0 rgb(var(--shadow) / 0.04)',
        md: '0 4px 12px -2px rgb(var(--shadow) / 0.08), 0 2px 4px -2px rgb(var(--shadow) / 0.06)',
        lg: '0 16px 40px -8px rgb(var(--shadow) / 0.18), 0 4px 10px -4px rgb(var(--shadow) / 0.08)',
        ring: '0 0 0 3px rgb(var(--ring) / 0.28)',
      },
      zIndex: { dropdown: '1000', sticky: '1100', overlay: '1200', modal: '1300', popover: '1400', toast: '1500', tooltip: '1600' },
      transitionDuration: { fast: '120ms', base: '180ms', slow: '280ms' },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-out-right': { from: { transform: 'none' }, to: { transform: 'translateX(100%)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'slide-out-left': { from: { transform: 'none' }, to: { transform: 'translateX(-100%)' } },
        'scale-in': { from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.96)' }, to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' } },
        'scale-out': { from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' }, to: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.2,0,0,1) both',
        'fade-out': 'fade-out 140ms cubic-bezier(0.4,0,1,1) both',
        'slide-up': 'slide-up 240ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-right': 'slide-in-right 280ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-out-right': 'slide-out-right 200ms cubic-bezier(0.4,0,1,1) both',
        'slide-in-left': 'slide-in-left 280ms cubic-bezier(0.16,1,0.3,1) both',
        'slide-out-left': 'slide-out-left 200ms cubic-bezier(0.4,0,1,1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.16,1,0.3,1) both',
        'scale-out': 'scale-out 150ms cubic-bezier(0.4,0,1,1) both',
        'pop-in': 'pop-in 150ms cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.8s linear infinite',
        spin: 'spin 0.75s linear infinite',
      },
    },
  },
};
