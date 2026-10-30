import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Armchair, Baby, BadgeCheck, Bike, Car, Check, ChevronRight, Clock, CreditCard, ExternalLink, Globe, Instagram, Link2, MapPin, MessageSquareText, Music, Navigation, Phone,
  Share2, ShoppingBag, Snowflake, Star, Trees, Tv, UtensilsCrossed, Wifi, Wine, Compass,
} from 'lucide-react';
import { Badge, Button, Card, Container, EmptyState, ErrorState, Skeleton, StarRating, cn, notify } from '@rrb/ui';
import { useRestaurant } from '../hooks/restaurants.js';
import { RestaurantCard } from '../components/restaurant/RestaurantCard.jsx';
import { Gallery } from '../components/restaurant/Gallery.jsx';
import { DAYS, costForTwo, humanize, statusText, time12, todayIST } from '../lib/restaurants.js';

const DetailMap = lazy(() => import('../components/restaurant/DetailMap.jsx'));

const AMENITY_ICONS = [
  [/wi-?fi|internet/i, Wifi], [/park|valet/i, Car], [/\bac\b|air|cool/i, Snowflake], [/deliver/i, Bike], [/take ?away|pick/i, ShoppingBag],
  [/seat|dine|indoor|family/i, Armchair], [/music|live|dj/i, Music], [/kid|child|baby/i, Baby], [/card|upi|pay/i, CreditCard], [/tv|screen|sport/i, Tv],
  [/bar|alcohol|wine|beer/i, Wine], [/outdoor|garden|terrace|roof/i, Trees],
];
const amenityIcon = (n) => AMENITY_ICONS.find(([re]) => re.test(n))?.[1] || Check;

function NotFoundRestaurant() {
  return (
    <Container size="md" className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"><UtensilsCrossed aria-hidden="true" className="h-6 w-6" /></span>
      <h1 className="mt-5 font-display text-display-md">This restaurant isn't available</h1>
      <p className="mt-3 max-w-md text-base text-text-muted">It may have been removed, or the link is mistyped. Plenty of other tables to try.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button as={Link} to="/restaurants" size="lg" leftIcon={<Compass className="h-4 w-4" />}>Browse restaurants</Button>
        <Button as={Link} to="/" size="lg" variant="outline">Back home</Button>
      </div>
    </Container>
  );
}

function DetailSkeleton() {
  return (
    <Container size="xl" className="py-8" role="status" aria-busy="true" aria-label="Loading restaurant">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-6 aspect-[16/9] w-full rounded-xl sm:aspect-[16/7]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </Container>
  );
}

const http = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

function Action({ href, icon: Icon, children, variant = 'outline', external = true, brand }) {
  return (
    <Button as="a" href={href} variant={variant} size="lg" className={cn('w-full justify-start', brand)} leftIcon={<Icon className="h-4 w-4" />} rightIcon={external ? <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" /> : undefined} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </Button>
  );
}

function Actions({ r }) {
  const l = r.externalLinks || {};
  const [lat, lng] = r.location?.coordinates?.[1] != null ? [r.location.coordinates[1], r.location.coordinates[0]] : [];
  const directions = http(l.mapsUrl) || (lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null);
  const phone = r.contactPhone ? r.contactPhone.replace(/[^\d+]/g, '') : '';
  const insta = http(l.instagram) || (l.instagram ? `https://www.instagram.com/${String(l.instagram).replace(/^@/, '').replace(/[^\w.]/g, '')}` : null);
  const items = [
    http(l.zomatoUrl) && <Action key="z" href={l.zomatoUrl} icon={ShoppingBag} variant="primary">Order on Zomato</Action>,
    http(l.swiggyUrl) && <Action key="s" href={l.swiggyUrl} icon={Bike} variant="primary">Order on Swiggy</Action>,
    directions && <Action key="d" href={directions} icon={Navigation}>Directions</Action>,
    phone && <Action key="c" href={`tel:${phone}`} icon={Phone} external={false}>Call {r.contactPhone}</Action>,
    http(l.website) && <Action key="w" href={l.website} icon={Globe}>Website</Action>,
    insta && <Action key="i" href={insta} icon={Instagram}>Instagram</Action>,
  ].filter(Boolean);
  if (!items.length) return <p className="text-sm text-text-muted">No ordering or contact links have been added for this restaurant yet.</p>;
  return <div className="flex flex-col gap-2.5">{items}</div>;
}

function Timings({ timings, status }) {
  const today = todayIST();
  const by = Object.fromEntries((timings || []).map((t) => [t.day, t]));
  if (!timings?.length) return <p className="text-sm text-text-muted">Opening hours haven't been added yet.</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Weekly opening hours</caption>
      <tbody>
        {DAYS.map((d) => {
          const t = by[d];
          const isToday = d === today;
          const hours = !t ? 'Not listed' : t.isClosed ? 'Closed' : `${time12(t.openTime)} – ${time12(t.closeTime)}`;
          return (
            <tr key={d} aria-current={isToday ? 'date' : undefined} className={cn('border-b border-border last:border-b-0', isToday && 'bg-primary-soft font-medium')}>
              <th scope="row" className="px-3 py-2.5 text-left font-[inherit]">{humanize(d)}{isToday ? <span className="ml-2 text-xs font-medium text-primary">Today</span> : null}</th>
              <td className={cn('px-3 py-2.5 text-right tabular-nums', (!t || t.isClosed) && 'text-text-muted')}>
                {hours}
                {isToday && status?.hasTimings ? <span className={cn('ml-2 text-xs', status.isOpen ? 'text-success' : 'text-text-muted')}>{status.isOpen ? '· open' : '· closed'}</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShareButton({ name }) {
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); return; }
      await navigator.clipboard.writeText(url);
      notify.success('Link copied', 'Paste it anywhere to share this restaurant.');
    } catch (e) {
      if (e?.name === 'AbortError') return; // user closed the share sheet
      notify.error("Couldn't copy the link", 'Copy it from the address bar instead.');
    }
  };
  return <Button variant="outline" size="sm" onClick={share} leftIcon={typeof navigator !== 'undefined' && navigator.share ? <Share2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}>{typeof navigator !== 'undefined' && navigator.share ? 'Share' : 'Copy link'}</Button>;
}

export default function RestaurantDetail() {
  const { slug } = useParams();
  const { data, isPending, isError, error, refetch } = useRestaurant(slug);
  if (isPending) return <DetailSkeleton />;
  if (isError) return error?.status === 404 || error?.status === 400 ? <NotFoundRestaurant /> : <Container size="md" className="py-16"><ErrorState title="Couldn't load this restaurant" error={error} onRetry={refetch} /></Container>;
  const r = data.data;
  const st = r.openStatus;
  const [lng, lat] = r.location?.coordinates || [];
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const addr = [r.address?.line1, r.address?.line2, r.address?.area, r.address?.city?.name, r.address?.pincode].filter(Boolean).join(', ');
  const cuisines = r.cuisines || [];
  const amenities = r.amenities || [];

  return (
    <Container size="xl" className="py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-text-muted">
        <Link to="/" className="hover:text-text">Home</Link><ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <Link to="/restaurants" className="hover:text-text">Restaurants</Link><ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <span aria-current="page" className="truncate text-text">{r.name}</span>
      </nav>

      <Gallery cover={r.coverImage} gallery={r.gallery} name={r.name} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-10">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{humanize(r.category)}</Badge>
              <Badge variant={r.type === 'veg' ? 'success' : 'neutral'}>{r.type === 'veg' ? 'Pure veg' : r.type === 'non-veg' ? 'Non-veg' : 'Veg & non-veg'}</Badge>
              {r.isVerified ? <Badge variant="primary"><BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />Verified</Badge> : null}
              {r.isFeatured ? <Badge variant="primary">Featured</Badge> : null}
              {st?.hasTimings ? <Badge variant={st.isOpen ? 'success' : 'neutral'} dot>{st.isOpen ? 'Open now' : 'Closed'}</Badge> : null}
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="font-display text-display-md sm:text-display-lg">{r.name}</h1>
              <ShareButton name={r.name} />
            </div>
            {cuisines.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {cuisines.map((c) => <li key={c._id}><Link to={`/restaurants?cuisines=${c.slug}`} className="inline-flex rounded-full border border-border-strong px-3 py-1 text-sm hover:bg-text/[0.05] focus-visible:shadow-ring focus-visible:outline-none">{c.name}</Link></li>)}
              </ul>
            ) : null}
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div><dt className="text-xs text-text-muted">Rating</dt><dd className="mt-0.5 flex items-center gap-2 font-medium">{r.ratingCount ? <><span className="tabular-nums">{Number(r.ratingAvg).toFixed(1)}</span><StarRating value={r.ratingAvg} readOnly size={15} /><span className="font-normal text-text-muted">({r.ratingCount})</span></> : <span className="font-normal text-text-muted">No ratings yet</span>}</dd></div>
              <div><dt className="text-xs text-text-muted">Cost for two</dt><dd className="mt-0.5 font-medium tabular-nums">{costForTwo(r.priceForTwo)?.replace(' for two', '') || '—'}</dd></div>
              {st?.hasTimings ? <div><dt className="text-xs text-text-muted">Hours today</dt><dd className="mt-0.5 font-medium">{statusText(st)}</dd></div> : null}
            </dl>
          </header>

          {r.description ? (
            <section aria-labelledby="about"><h2 id="about" className="font-display text-xl font-medium">About</h2><p className="mt-3 whitespace-pre-line text-base text-text-muted">{r.description}</p></section>
          ) : null}

          <section aria-labelledby="hours">
            <h2 id="hours" className="flex items-center gap-2 font-display text-xl font-medium"><Clock aria-hidden="true" className="h-5 w-5 text-primary" />Opening hours</h2>
            <Card className="mt-4 overflow-hidden"><Timings timings={r.timings} status={st} /></Card>
            <p className="mt-2 text-xs text-text-muted">Times shown in Indian Standard Time. Hours can change on holidays; confirm before you travel.</p>
          </section>

          {amenities.length ? (
            <section aria-labelledby="amen">
              <h2 id="amen" className="font-display text-xl font-medium">Amenities</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {amenities.map((a) => {
                  const Icon = amenityIcon(a.name);
                  return <li key={a._id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-3 text-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Icon aria-hidden="true" className="h-4 w-4" /></span>{a.name}</li>;
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="loc">
            <h2 id="loc" className="flex items-center gap-2 font-display text-xl font-medium"><MapPin aria-hidden="true" className="h-5 w-5 text-primary" />Location</h2>
            <p className="mt-3 text-base text-text-muted">{addr}</p>
            <div className="mt-4">
              {hasCoords ? (
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg sm:h-80" aria-label="Loading map" />}><DetailMap lat={lat} lng={lng} name={r.name} /></Suspense>
              ) : (
                <EmptyState className="rounded-lg border border-dashed border-border-strong py-8" icon={<MapPin className="h-5 w-5" />} title="Map not available" description="We don't have exact coordinates for this restaurant yet." />
              )}
            </div>
          </section>

          <section aria-labelledby="reviews">
            <div className="flex items-end justify-between gap-3">
              <h2 id="reviews" className="font-display text-xl font-medium">Reviews</h2>
              {r.ratingCount ? <span className="flex items-center gap-1.5 text-sm text-text-muted"><Star aria-hidden="true" className="h-4 w-4 fill-primary text-primary" /><span className="font-medium text-text tabular-nums">{Number(r.ratingAvg).toFixed(1)}</span> · {r.ratingCount} {r.ratingCount === 1 ? 'review' : 'reviews'}</span> : null}
            </div>
            <EmptyState className="mt-4 rounded-lg border border-dashed border-border-strong" icon={<MessageSquareText className="h-5 w-5" />} title="No reviews yet" description="Be the first to tell Indore what the food, service and value are really like. Reviews are coming very soon." />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order and contact">
          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Order, visit or call</h2>
            <p className="mb-4 mt-1 text-sm text-text-muted">These open in a new tab.</p>
            <Actions r={r} />
          </Card>
        </aside>
      </div>

      {r.similar?.length ? (
        <section className="mt-14 border-t border-border pt-10" aria-labelledby="similar">
          <h2 id="similar" className="font-display text-display-sm">Similar restaurants</h2>
          <ul className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {r.similar.map((s) => <li key={s._id} className="w-72 shrink-0 snap-start sm:w-auto"><RestaurantCard r={s} /></li>)}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
