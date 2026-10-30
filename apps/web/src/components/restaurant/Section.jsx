import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Container, EmptyState, ErrorState, cn } from '@rrb/ui';
import { RestaurantCard, RestaurantCardSkeleton } from './RestaurantCard.jsx';

/**
 * Titled strip of restaurant cards: horizontal scroll on phones, grid from sm up.
 * Always renders one of skeleton / error / designed-empty / cards, so there is never a blank gap.
 */
export function RestaurantStrip({ eyebrow, title, description, to, query, emptyIcon, emptyTitle, emptyText, max = 4, className }) {
  const { data, isPending, isError, error, refetch } = query;
  const items = data?.data || [];
  return (
    <section className={cn('py-12', className)} aria-labelledby={`h-${title.replace(/\W+/g, '-')}`}>
      <Container size="xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <p className="text-eyebrow uppercase text-primary">{eyebrow}</p> : null}
            <h2 id={`h-${title.replace(/\W+/g, '-')}`} className="mt-1 font-display text-display-sm sm:text-display-md">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
          </div>
          {to ? (
            <Link to={to} className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:shadow-ring focus-visible:outline-none">
              See all <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        {isPending ? (
          <Row>{Array.from({ length: max }, (_, i) => <div key={i} className="w-72 shrink-0 sm:w-auto"><RestaurantCardSkeleton /></div>)}</Row>
        ) : isError ? (
          <ErrorState className="rounded-lg border border-dashed border-border-strong py-10" title="Couldn't load this section" error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState className="rounded-lg border border-dashed border-border-strong py-10" icon={emptyIcon} title={emptyTitle} description={emptyText} />
        ) : (
          <Row>
            {items.map((r, i) => (
              <div key={r._id} className={cn('w-72 shrink-0 snap-start sm:w-auto', i >= max && 'sm:hidden')}><RestaurantCard r={r} /></div>
            ))}
          </Row>
        )}
      </Container>
    </section>
  );
}

function Row({ children }) {
  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
      {children}
    </div>
  );
}
