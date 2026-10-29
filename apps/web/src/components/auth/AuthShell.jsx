import { Link } from 'react-router-dom';
import { Quote } from 'lucide-react';
import { Badge, Logo, StarRating, ThemeToggle } from '@rrb/ui';

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-12 lg:flex xl:p-16">
      <Link to="/" aria-label="Review Box home"><Logo size="lg" /></Link>
      <div className="relative z-10 max-w-lg">
        <p className="text-eyebrow uppercase text-primary">Indore, plainly reviewed</p>
        <h2 className="mt-4 font-display text-display-lg text-text xl:text-display-xl">Eat where people who actually went say it's worth it.</h2>
        <figure className="mt-10 rounded-xl border border-border bg-surface-raised p-6 shadow-md">
          <div className="flex items-center justify-between">
            <StarRating value={4.5} readOnly size={16} label="4.5 out of 5" />
            <Badge variant="primary" dot>Verified visit</Badge>
          </div>
          <blockquote className="mt-4 flex gap-3 text-sm leading-relaxed text-text">
            <Quote aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Poha was perfect, jalebi was still hot, and the owner remembered our table. Late-night Sarafa has competition.
          </blockquote>
          <figcaption className="mt-4 text-xs text-text-muted">Aarti S. on Chappan Dukan, 2 days ago</figcaption>
        </figure>
      </div>
      <p className="relative z-10 text-sm text-text-muted">Reviews by diners, for diners. No ordering, no ads in your ratings.</p>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full border border-primary/20" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-[20rem] w-[20rem] rounded-full border border-primary/30" />
    </aside>
  );
}

/** Split-screen on desktop, single clean column on mobile. */
export function AuthShell({ title, description, children, footer }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/" aria-label="Review Box home" className="lg:invisible"><Logo size="sm" /></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 pb-12 pt-4 sm:px-0">
          <h1 className="font-display text-display-md text-text sm:text-display-lg">{title}</h1>
          {description ? <p className="mt-2 text-base text-text-muted">{description}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 text-center text-sm text-text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export const FormBanner = ({ children }) =>
  children ? <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{children}</p> : null;
