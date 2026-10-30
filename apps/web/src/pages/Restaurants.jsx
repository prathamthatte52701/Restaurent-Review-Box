import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crosshair, LayoutGrid, Loader2, Map as MapIcon, MapPinOff, SearchX, SlidersHorizontal, UtensilsCrossed, X } from 'lucide-react';
import { Button, Container, EmptyState, ErrorState, Pagination, SearchInput, Select, Sheet, Skeleton, cn } from '@rrb/ui';
import { useCities, useNearby, useRestaurants } from '../hooks/restaurants.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { RestaurantCard, RestaurantCardSkeleton } from '../components/restaurant/RestaurantCard.jsx';
import { FilterPanel } from '../components/listing/FilterPanel.jsx';
import { COSTS, MAP_LIMIT, PAGE_SIZE, RADII, SORTS, CATEGORIES, TYPES, humanize, readParams, toApiFilters, writeParams } from '../lib/restaurants.js';

const ListingMap = lazy(() => import('../components/listing/ListingMap.jsx'));

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-border-strong bg-surface-raised pl-3 pr-1 text-sm">
      {label}
      <button type="button" aria-label={`Remove filter ${label}`} onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-text/10 hover:text-text focus-visible:shadow-ring focus-visible:outline-none">
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function activeChips(state, facets, cityName, update) {
  const name = (list, key, v) => list?.find((i) => i[key] === v)?.name || humanize(v);
  const chips = [];
  if (state.q) chips.push({ k: 'q', label: `“${state.q}”`, off: () => update(() => ({ q: '' })) });
  if (state.city) chips.push({ k: 'city', label: cityName || humanize(state.city), off: () => update(() => ({ city: '' })) });
  for (const v of state.cuisines) chips.push({ k: `cu-${v}`, label: name(facets?.cuisines, 'slug', v), off: () => update((s) => ({ cuisines: s.cuisines.filter((x) => x !== v) })) });
  for (const v of state.amenities) chips.push({ k: `am-${v}`, label: name(facets?.amenities, 'slug', v), off: () => update((s) => ({ amenities: s.amenities.filter((x) => x !== v) })) });
  for (const v of state.cost) chips.push({ k: `co-${v}`, label: COSTS.find((c) => c.value === v)?.label, off: () => update((s) => ({ cost: s.cost.filter((x) => x !== v) })) });
  for (const v of state.category) chips.push({ k: `ca-${v}`, label: CATEGORIES.find((c) => c.value === v)?.label, off: () => update((s) => ({ category: s.category.filter((x) => x !== v) })) });
  for (const v of state.type) chips.push({ k: `ty-${v}`, label: TYPES.find((c) => c.value === v)?.label, off: () => update((s) => ({ type: s.type.filter((x) => x !== v) })) });
  if (state.minRating) chips.push({ k: 'mr', label: `${state.minRating}+ rating`, off: () => update(() => ({ minRating: null })) });
  if (state.openNow) chips.push({ k: 'on', label: 'Open now', off: () => update(() => ({ openNow: false })) });
  return chips;
}

const MapFallback = () => <Skeleton className="h-[28rem] w-full rounded-lg lg:h-[36rem]" aria-label="Loading map" />;

export default function Restaurants() {
  const [sp, setSp] = useSearchParams();
  const state = useMemo(() => readParams(sp), [sp]);
  const [drawer, setDrawer] = useState(false);
  const cities = useCities();

  // functional form: always merges into the CURRENT url, so rapid toggles never lose a click
  const update = useCallback(
    (patch, { replace = false, keepPage = false } = {}) =>
      setSp((prev) => {
        const cur = readParams(prev);
        const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) };
        if (!keepPage) next.page = 1;
        return writeParams(next);
      }, { replace }),
    [setSp],
  );
  const clearAll = () => update(() => ({ q: '', city: '', cuisines: [], amenities: [], cost: [], category: [], type: [], minRating: null, openNow: false }));

  // ---- near me ----
  const geo = useGeolocation(useCallback((pos) => update(() => ({ nearMe: false, near: pos }), { replace: true }), [update]));
  const { locate } = geo;
  useEffect(() => { if (state.nearMe && geo.status === 'idle' && !geo.error) locate(); }, [state.nearMe]); // eslint-disable-line react-hooks/exhaustive-deps
  const near = state.near;
  const nearActive = !!near;

  // ---- data ----
  const filters = toApiFilters(state);
  const mapView = state.view === 'map';
  const listQ = useRestaurants(
    { ...filters, sort: state.sort, ...(mapView ? { limit: MAP_LIMIT } : { page: state.page, limit: PAGE_SIZE }) },
    { enabled: !nearActive },
  );
  const nearQ = useNearby(near ? { ...filters, lat: near.lat, lng: near.lng, radius: state.radius, limit: MAP_LIMIT } : {}, { enabled: nearActive });
  const facetQ = useRestaurants({ ...filters, limit: 1 }, { enabled: nearActive });
  const main = nearActive ? nearQ : listQ;
  const facets = (nearActive ? facetQ.data : listQ.data)?.facets;
  const items = main.data?.data || [];
  const pg = main.data?.pagination;
  const total = pg?.total ?? 0;

  // typed past the end (?page=99999): hop to the last real page
  useEffect(() => {
    if (!nearActive && !mapView && !main.isFetching && main.data && items.length === 0 && state.page > 1 && pg?.totalPages >= 1) update({ page: pg.totalPages }, { replace: true, keepPage: true });
  }, [nearActive, mapView, main.isFetching, main.data, items.length, state.page, pg?.totalPages, update]);

  const cityName = cities.data?.data?.find((c) => c.slug === state.city)?.name;
  const chips = activeChips(state, facets, cityName, update);
  const filterCount = chips.filter((c) => c.k !== 'q').length;
  const showSkeleton = main.isPending && !main.data;
  const stale = main.isPlaceholderData;

  const countText = nearActive
    ? `${total} ${total === 1 ? 'restaurant' : 'restaurants'} within ${state.radius} km`
    : mapView
      ? `${total} ${total === 1 ? 'restaurant' : 'restaurants'}${total > MAP_LIMIT ? ` · showing the first ${MAP_LIMIT} on the map` : ''}`
      : `${total} ${total === 1 ? 'restaurant' : 'restaurants'}`;

  const cityOptions = [{ value: '', label: 'All cities' }, ...(cities.data?.data || []).map((c) => ({ value: c.slug, label: c.name }))];

  return (
    <Container size="xl" className="py-8">
      <header className="mb-6">
        <p className="text-eyebrow uppercase text-primary">Discover</p>
        <h1 className="mt-1 font-display text-display-md sm:text-display-lg">{nearActive ? 'Restaurants near you' : 'Restaurants'}{cityName && !nearActive ? <span className="text-text-muted"> in {cityName}</span> : null}</h1>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={state.q} debounce={300} onChange={(v) => update(() => ({ q: v.slice(0, 100) }), { replace: true })} placeholder="Search restaurants, cuisines, areas" aria-label="Search restaurants" className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="City" size="md" value={state.city} onChange={(e) => update(() => ({ city: e.target.value }))} options={cityOptions} className="w-36" />
          <Select aria-label="Sort by" value={state.sort} disabled={nearActive} onChange={(e) => update(() => ({ sort: e.target.value }))} options={nearActive ? [{ value: state.sort, label: 'Nearest first' }] : SORTS} className="w-48" />
          <div role="group" aria-label="View" className="inline-flex rounded-md border border-border-strong p-0.5">
            {[['list', 'List', LayoutGrid], ['map', 'Map', MapIcon]].map(([v, label, Icon]) => (
              <button key={v} type="button" aria-pressed={state.view === v} onClick={() => update(() => ({ view: v }), { keepPage: true })} className={cn('inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:shadow-ring focus-visible:outline-none', state.view === v ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text')}>
                <Icon aria-hidden="true" className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant={nearActive || state.nearMe ? 'primary' : 'outline'} size="sm" leftIcon={geo.status === 'locating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} disabled={geo.status === 'locating'} onClick={() => (nearActive ? update(() => ({ near: null, nearMe: false })) : locate())}>
          {geo.status === 'locating' ? 'Locating…' : nearActive ? 'Near me · on' : 'Near me'}
        </Button>
        {nearActive ? (
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Within
            <Select size="sm" aria-label="Search radius" value={state.radius} onChange={(e) => update(() => ({ radius: Number(e.target.value) }))} options={RADII.map((r) => ({ value: r, label: `${r} km` }))} className="w-24" />
          </label>
        ) : null}
        <Sheet open={drawer} onOpenChange={setDrawer} side="left" label="Filters" trigger={<Button variant="outline" size="sm" className="lg:hidden" leftIcon={<SlidersHorizontal className="h-4 w-4" />}>Filters{filterCount ? ` (${filterCount})` : ''}</Button>}>
          <Sheet.Header title="Filters" />
          <Sheet.Body><FilterPanel state={state} facets={facets} update={update} /></Sheet.Body>
          <Sheet.Footer>
            <Button variant="ghost" onClick={clearAll} disabled={!chips.length}>Clear all</Button>
            <Button onClick={() => setDrawer(false)}>Show {total} {total === 1 ? 'result' : 'results'}</Button>
          </Sheet.Footer>
        </Sheet>
      </div>

      {geo.error ? (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-text"><MapPinOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{geo.error.message}</p>
          <div className="flex shrink-0 gap-2">
            {geo.error.code !== 'unsupported' && geo.error.code !== 'denied' ? <Button size="sm" variant="secondary" onClick={locate}>Try again</Button> : null}
            <Button size="sm" variant="outline" onClick={() => { geo.reset(); update(() => ({ nearMe: false, near: null, city: state.city || cities.data?.data?.[0]?.slug || '' })); }}>Use a city instead</Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">Filters</h2>
              {chips.length ? <button type="button" onClick={clearAll} className="text-sm font-medium text-primary hover:underline">Clear all</button> : null}
            </div>
            <FilterPanel state={state} facets={facets} update={update} />
          </div>
        </aside>

        <section aria-label="Results" aria-busy={main.isFetching} className="min-w-0">
          <div className="mb-4 flex min-h-8 flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-text-muted" role="status" aria-live="polite">{showSkeleton ? 'Loading…' : countText}</p>
            {chips.map((c) => <Chip key={c.k} label={c.label} onRemove={c.off} />)}
            {chips.length > 1 ? <button type="button" onClick={clearAll} className="text-sm font-medium text-primary hover:underline">Clear all</button> : null}
          </div>

          {showSkeleton ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <RestaurantCardSkeleton key={i} />)}</div>
          ) : main.isError && !main.data ? (
            <ErrorState className="rounded-lg border border-dashed border-border-strong" title="Couldn't load restaurants" error={main.error} onRetry={main.refetch} />
          ) : items.length === 0 ? (
            <EmptyState
              className="rounded-lg border border-dashed border-border-strong"
              icon={nearActive ? <MapPinOff className="h-5 w-5" /> : chips.length ? <SearchX className="h-5 w-5" /> : <UtensilsCrossed className="h-5 w-5" />}
              title={nearActive ? `Nothing within ${state.radius} km` : chips.length ? 'No restaurants match these filters' : 'No restaurants yet'}
              description={nearActive ? 'Try a wider radius, or remove a filter.' : chips.length ? 'Try removing a filter or searching for something broader.' : 'Restaurants will appear here once they are added.'}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {nearActive && state.radius < 25 ? <Button size="sm" onClick={() => update(() => ({ radius: RADII.find((r) => r > state.radius) }))}>Widen radius</Button> : null}
                  {chips.length ? <Button size="sm" variant={nearActive ? 'secondary' : 'primary'} onClick={clearAll}>Clear filters</Button> : null}
                  {nearActive ? <Button size="sm" variant="ghost" onClick={() => update(() => ({ near: null }))}>Stop using my location</Button> : null}
                </div>
              }
            />
          ) : mapView ? (
            <Suspense fallback={<MapFallback />}>
              <ListingMap restaurants={items} center={near} radiusKm={nearActive ? state.radius : null} />
            </Suspense>
          ) : (
            <>
              <ul className={cn('grid gap-5 transition-opacity duration-base sm:grid-cols-2 xl:grid-cols-3', stale && 'opacity-60')}>
                {items.map((r) => <li key={r._id}><RestaurantCard r={r} /></li>)}
              </ul>
              {!nearActive && pg?.totalPages > 1 ? (
                <Pagination className="mt-8" page={pg.page} totalPages={pg.totalPages} total={pg.total} limit={pg.limit} onPageChange={(p) => { update({ page: p }, { keepPage: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              ) : null}
            </>
          )}
          {main.isError && main.data ? <p role="alert" className="mt-4 text-sm text-danger">Couldn't refresh results. <button type="button" className="font-medium underline" onClick={() => main.refetch()}>Retry</button></p> : null}
          {!showSkeleton && !items.length && !chips.length && !nearActive ? <p className="mt-6 text-center text-sm text-text-muted"><Link to="/" className="text-primary hover:underline">Back to home</Link></p> : null}
        </section>
      </div>
    </Container>
  );
}
