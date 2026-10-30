import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, MapPin, Navigation, Star, UtensilsCrossed } from 'lucide-react';
import { Badge, Card, Skeleton, cn } from '@rrb/ui';
import { costForTwo, distanceLabel, humanize, statusText } from '../../lib/restaurants.js';

/** Cover image, or a calm typographic placeholder when there is none (or it fails to load). */
export function Cover({ src, name, className, imgClassName }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={`${name} cover`} loading="lazy" onError={() => setFailed(true)} className={cn('h-full w-full object-cover', imgClassName)} />;
  }
  return (
    <div className={cn('relative flex h-full w-full items-center justify-center overflow-hidden bg-primary-soft text-primary', className)} role="img" aria-label={`${name}, no photo yet`}>
      <UtensilsCrossed aria-hidden="true" className="absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-[0.12]" strokeWidth={1.25} />
      <span aria-hidden="true" className="font-display text-5xl font-medium tracking-tight opacity-80">{(name || '?').trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function OpenBadge({ status, className }) {
  const text = statusText(status);
  if (!text) return null;
  return (
    <Badge variant={status.isOpen ? 'success' : 'neutral'} dot className={cn('bg-surface-raised/95 backdrop-blur-sm', className)}>
      {status.isOpen ? 'Open' : 'Closed'}
    </Badge>
  );
}

export function RatingPill({ avg, count, className }) {
  if (!count) return <span className={cn('inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-muted', className)}>New</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-sm font-medium tabular-nums text-primary-fg', className)}>
      {Number(avg).toFixed(1)}
      <Star aria-hidden="true" className="h-3 w-3 fill-current" />
    </span>
  );
}

export function RestaurantCard({ r, className }) {
  const cuisines = (r.cuisines || []).map((c) => c.name).filter(Boolean);
  const cost = costForTwo(r.priceForTwo);
  const dist = distanceLabel(r.distanceMeters);
  const status = statusText(r.openStatus);
  return (
    <Card as="article" interactive className={cn('group relative flex h-full flex-col overflow-hidden', className)}>
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-surface">
        <Cover src={r.coverImage?.url} name={r.name} imgClassName="transition-transform duration-slow ease-standard group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {r.isFeatured ? <Badge variant="primary" className="bg-primary text-primary-fg border-transparent">Featured</Badge> : null}
        </div>
        <div className="absolute right-3 top-3"><OpenBadge status={r.openStatus} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-lg font-medium leading-snug tracking-tight">
            <Link to={`/restaurants/${r.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:shadow-ring">
              <span className="line-clamp-2">{r.name}</span>
            </Link>
          </h3>
          <RatingPill avg={r.ratingAvg} count={r.ratingCount} className="shrink-0" />
        </div>
        <p className="line-clamp-1 text-sm text-text-muted">{cuisines.length ? cuisines.join(' · ') : humanize(r.category)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-text-muted">
          {r.address?.area ? <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />{r.address.area}</span> : null}
          {dist ? <span className="inline-flex items-center gap-1 font-medium text-primary"><Navigation aria-hidden="true" className="h-3.5 w-3.5" />{dist} away</span> : null}
          {cost ? <span className="tabular-nums">{cost}</span> : null}
          {r.isVerified ? <span className="inline-flex items-center gap-1 text-success"><BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />Verified</span> : null}
        </div>
        {status ? <p className="flex items-center gap-1.5 border-t border-border pt-2 text-xs text-text-muted"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{status}</p> : null}
      </div>
    </Card>
  );
}

export function RestaurantCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex justify-between gap-4"><Skeleton className="h-6 w-3/5" /><Skeleton className="h-6 w-10" /></div>
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </Card>
  );
}
