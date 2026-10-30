import { useState } from 'react';
import { Star } from 'lucide-react';
import { Checkbox, Switch, cn } from '@rrb/ui';
import { CATEGORIES, COSTS, RATINGS, TYPES } from '../../lib/restaurants.js';

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Group({ title, children, className }) {
  return (
    <fieldset className={cn('border-b border-border py-5 first:pt-0 last:border-b-0', className)}>
      <legend className="mb-3 text-eyebrow uppercase text-text-muted">{title}</legend>
      <div className="flex flex-col gap-2.5">{children}</div>
    </fieldset>
  );
}

function Row({ label, count, ...rest }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Checkbox label={label} {...rest} />
      {count !== undefined ? <span className="text-xs tabular-nums text-text-muted" aria-label={`${count} restaurants`}>{count}</span> : null}
    </div>
  );
}

/** Facet-aware list: selected values stay visible (count 0) so they can always be unchecked. */
function FacetList({ items, selected, onToggle, limit = 7, bySlug }) {
  const [all, setAll] = useState(false);
  const key = (i) => (bySlug ? i.slug : i.id);
  const known = new Set(items.map(key));
  const extra = selected.filter((s) => !known.has(s)).map((s) => ({ id: s, slug: s, name: s.replace(/-/g, ' '), count: 0 }));
  const rows = [...items, ...extra];
  if (!rows.length) return <p className="text-sm text-text-muted">No options for this selection.</p>;
  const shown = all ? rows : rows.filter((r, i) => i < limit || selected.includes(key(r)));
  return (
    <>
      {shown.map((i) => (
        <Row key={key(i)} label={i.name} count={i.count} checked={selected.includes(key(i))} onChange={() => onToggle(key(i))} />
      ))}
      {rows.length > limit ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="self-start rounded-sm text-sm font-medium text-primary hover:underline focus-visible:shadow-ring focus-visible:outline-none">
          {all ? 'Show less' : `Show ${rows.length - shown.length} more`}
        </button>
      ) : null}
    </>
  );
}

/** `update(fn)` receives the CURRENT url state, so rapid clicks never clobber each other. */
export function FilterPanel({ state, facets, update }) {
  const costCount = Object.fromEntries((facets?.cost || []).map((c) => [c.id, c.count]));
  const catCount = Object.fromEntries((facets?.category || []).map((c) => [c.id, c.count]));
  return (
    <div>
      <Group title="Availability">
        <Switch label="Open now" checked={state.openNow} onCheckedChange={(v) => update(() => ({ openNow: v }))} />
      </Group>
      <Group title="Cuisine">
        <FacetList bySlug items={facets?.cuisines || []} selected={state.cuisines} onToggle={(v) => update((s) => ({ cuisines: toggle(s.cuisines, v) }))} />
      </Group>
      <Group title="Cost for two">
        {COSTS.map((c) => (
          <Row key={c.value} label={`${c.label} · ${c.hint}`} count={costCount[c.value] ?? 0} checked={state.cost.includes(c.value)} disabled={!costCount[c.value] && !state.cost.includes(c.value)} onChange={() => update((s) => ({ cost: toggle(s.cost, c.value) }))} />
        ))}
      </Group>
      <Group title="Category">
        {CATEGORIES.map((c) => (
          <Row key={c.value} label={c.label} count={catCount[c.value] ?? 0} checked={state.category.includes(c.value)} disabled={!catCount[c.value] && !state.category.includes(c.value)} onChange={() => update((s) => ({ category: toggle(s.category, c.value) }))} />
        ))}
      </Group>
      <Group title="Diet">
        {TYPES.map((t) => (
          <Row key={t.value} label={t.label} checked={state.type.includes(t.value)} onChange={() => update((s) => ({ type: toggle(s.type, t.value) }))} />
        ))}
      </Group>
      <Group title="Amenities">
        <FacetList bySlug items={facets?.amenities || []} selected={state.amenities} onToggle={(v) => update((s) => ({ amenities: toggle(s.amenities, v) }))} />
      </Group>
      <Group title="Minimum rating">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum rating">
          {RATINGS.map((r) => {
            const on = state.minRating === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => update(() => ({ minRating: on ? null : r }))}
                className={cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm tabular-nums transition-colors focus-visible:shadow-ring focus-visible:outline-none', on ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong text-text hover:bg-text/[0.05]')}
              >
                {r}+ <Star aria-hidden="true" className="h-3 w-3 fill-current" />
              </button>
            );
          })}
        </div>
      </Group>
    </div>
  );
}
