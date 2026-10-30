import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Cake, ChefHat, Clock, Coffee, Compass, CookingPot, Crosshair, Flame, IceCream, Pizza, Salad, Sandwich, Search, Soup, Sparkles, Star, Utensils, UtensilsCrossed,
} from 'lucide-react';
import { Badge, Button, Card, Container, EmptyState, ErrorState, Select, Skeleton } from '@rrb/ui';
import { useCities, useRestaurants } from '../hooks/restaurants.js';
import { RestaurantStrip } from '../components/restaurant/Section.jsx';
import { Cover } from '../components/restaurant/RestaurantCard.jsx';
import { costForTwo, statusText } from '../lib/restaurants.js';

const ICONS = [
  [/pizza|italian/i, Pizza], [/cafe|coffee|tea/i, Coffee], [/bak|dessert|cake|sweet/i, Cake], [/ice|kulfi/i, IceCream],
  [/sandwich|burger|fast/i, Sandwich], [/soup|chinese|thai|asian/i, Soup], [/salad|health|veg/i, Salad], [/tandoor|bbq|grill|kebab|mughlai|north|punjabi/i, Flame],
  [/south|dosa|idli/i, CookingPot], [/chaat|street/i, ChefHat],
];
const iconFor = (name) => ICONS.find(([re]) => re.test(name))?.[1] || Utensils;

function Hero() {
  const navigate = useNavigate();
  const cities = useCities();
  const live = useRestaurants({ openNow: 'true', limit: 3, sort: 'rating' });
  const [city, setCity] = useState('');
  const cityOptions = useMemo(() => [{ value: '', label: 'All cities' }, ...(cities.data?.data || []).map((c) => ({ value: c.slug, label: c.name }))], [cities.data]);
  const go = (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q')?.toString().trim();
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (city) sp.set('city', city);
    navigate(`/restaurants${sp.toString() ? `?${sp}` : ''}`);
  };
  const open = live.data?.data || [];
  return (
    <section className="overflow-x-clip border-b border-border">
      <Container size="xl" className="grid grid-cols-1 items-center gap-12 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <div className="min-w-0">
          <Badge variant="primary" dot>Indore, Madhya Pradesh</Badge>
          <h1 className="mt-6 font-display text-display-lg text-text sm:text-display-xl lg:text-display-2xl">
            Find the table <span className="italic text-primary">worth</span> the wait.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text-muted">
            Search real restaurants, check what is open right now, read honest reviews, then jump straight to Zomato, Swiggy or Maps.
          </p>
          <form role="search" onSubmit={go} className="mt-8 flex max-w-2xl flex-col gap-2 rounded-xl border border-border-strong bg-surface-raised p-2 shadow-md sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Restaurant name or cuisine</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                name="q"
                type="search"
                maxLength={100}
                autoComplete="off"
                placeholder="Restaurant or cuisine"
                className="h-12 w-full rounded-lg bg-transparent pl-10 pr-3 text-base text-text placeholder:text-text-muted focus:outline-none focus-visible:shadow-ring [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            <Select aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} options={cityOptions} className="sm:w-44" selectClassName="h-12 border-transparent bg-surface" />
            <Button type="submit" size="lg" leftIcon={<Search className="h-4 w-4" />}>Search</Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Button as={Link} to="/restaurants?near=me" variant="outline" size="sm" leftIcon={<Crosshair className="h-4 w-4" />}>Near me</Button>
            <Button as={Link} to="/restaurants?openNow=true" variant="ghost" size="sm" leftIcon={<Clock className="h-4 w-4" />}>Open now</Button>
            <Button as={Link} to="/restaurants?view=map" variant="ghost" size="sm" leftIcon={<Compass className="h-4 w-4" />}>Map view</Button>
          </div>
        </div>
        <div className="mx-auto w-full min-w-0 max-w-md lg:max-w-none">
          <Card className="overflow-hidden shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />Open right now</p>
              <Link to="/restaurants?openNow=true" className="text-xs font-medium text-primary hover:underline">See all</Link>
            </div>
            {live.isPending ? (
              <ul className="divide-y divide-border" aria-hidden="true">
                {[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-14 w-14 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-4/5" /></div></li>)}
              </ul>
            ) : live.isError ? (
              <ErrorState className="py-8" title="Couldn't check what's open" error={live.error} onRetry={live.refetch} />
            ) : open.length === 0 ? (
              <EmptyState className="py-8" icon={<Clock className="h-5 w-5" />} title="Nothing is open right now" description="Check back in the morning, or browse every restaurant." action={<Button as={Link} to="/restaurants" size="sm" variant="secondary">Browse all</Button>} />
            ) : (
              <ul className="divide-y divide-border">
                {open.map((r) => (
                  <li key={r._id}>
                    <Link to={`/restaurants/${r.slug}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-text/[0.03] focus-visible:shadow-ring focus-visible:outline-none">
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border"><Cover src={r.coverImage?.url} name={r.name} className="text-2xl" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-text-muted">{[r.address?.area, costForTwo(r.priceForTwo)].filter(Boolean).join(' · ')}</span>
                        <span className="block truncate text-xs text-success">{statusText(r.openStatus)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Container>
    </section>
  );
}

function CuisineTiles() {
  const { data, isPending, isError, error, refetch } = useRestaurants({ limit: 1 });
  const items = data?.facets?.cuisines || [];
  return (
    <section className="border-y border-border bg-surface py-12" aria-labelledby="h-cuisines">
      <Container size="xl">
        <p className="text-eyebrow uppercase text-primary">Hungry for something specific?</p>
        <h2 id="h-cuisines" className="mt-1 font-display text-display-sm sm:text-display-md">Browse by cuisine</h2>
        <div className="mt-6">
          {isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          ) : isError ? (
            <ErrorState className="rounded-lg border border-dashed border-border-strong py-10" title="Couldn't load cuisines" error={error} onRetry={refetch} />
          ) : items.length === 0 ? (
            <EmptyState className="rounded-lg border border-dashed border-border-strong py-10" icon={<UtensilsCrossed className="h-5 w-5" />} title="No cuisines yet" description="Cuisines appear here as restaurants are added." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {items.slice(0, 12).map((c) => {
                const Icon = iconFor(c.name);
                return (
                  <li key={c.id}>
                    <Link to={`/restaurants?cuisines=${c.slug}`} className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 transition-[border-color,box-shadow] duration-base hover:border-border-strong hover:shadow-md focus-visible:shadow-ring focus-visible:outline-none">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-fg"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                      <span>
                        <span className="block font-medium leading-tight">{c.name}</span>
                        <span className="text-xs text-text-muted">{c.count} {c.count === 1 ? 'place' : 'places'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}

export default function Home() {
  const featured = useRestaurants({ featured: 'true', limit: 8, sort: 'rating' });
  const top = useRestaurants({ minRating: 0.1, sort: 'rating', limit: 8 });
  const open = useRestaurants({ openNow: 'true', limit: 8 });
  const fresh = useRestaurants({ sort: 'newest', limit: 8 });
  return (
    <>
      <Hero />
      <RestaurantStrip
        eyebrow="Hand-picked"
        title="Featured in Indore"
        to="/restaurants?sort=rating"
        query={featured}
        emptyIcon={<Sparkles className="h-5 w-5" />}
        emptyTitle="No featured restaurants yet"
        emptyText="Featured spots are picked by our team. Meanwhile, every restaurant is a click away."
      />
      <CuisineTiles />
      <RestaurantStrip
        eyebrow="Loved by locals"
        title="Top rated"
        to="/restaurants?sort=rating"
        query={top}
        emptyIcon={<Star className="h-5 w-5" />}
        emptyTitle="No ratings yet"
        emptyText="Ratings show up once people start reviewing. Be among the first to share your table."
      />
      <RestaurantStrip
        className="bg-surface border-y border-border"
        eyebrow="Live"
        title="Open now"
        description="Based on Indian Standard Time"
        to="/restaurants?openNow=true"
        query={open}
        emptyIcon={<Clock className="h-5 w-5" />}
        emptyTitle="Nothing is open right now"
        emptyText="Kitchens are closed at the moment. Check back soon."
      />
      <RestaurantStrip
        eyebrow="Fresh on the list"
        title="Newly added"
        to="/restaurants?sort=newest"
        query={fresh}
        emptyIcon={<UtensilsCrossed className="h-5 w-5" />}
        emptyTitle="Nothing new yet"
        emptyText="New restaurants will appear here."
      />
    </>
  );
}
