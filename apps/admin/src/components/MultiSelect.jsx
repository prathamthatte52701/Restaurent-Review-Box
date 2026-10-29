import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Checkbox, ErrorState, SearchInput, Skeleton } from '@rrb/ui';

/** Searchable multi-select. options: [{_id, name}]. value: string[] of ids. */
export function MultiSelect({ label, options, value, onChange, loading, error, onRetry, emptyText = 'Nothing to select yet.' }) {
  const [q, setQ] = useState('');
  const sel = new Set(value);
  const shown = useMemo(() => (options || []).filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);
  const toggle = (id) => onChange(sel.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const byId = new Map((options || []).map((o) => [o._id, o]));

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={q} onChange={setQ} placeholder={`Search ${label.toLowerCase()}`} />
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${label.toLowerCase()}`}>
          {value.map((id) => (
            <li key={id}>
              <Badge variant="primary" className="gap-1 pr-1">
                {byId.get(id)?.name || 'Unavailable'}
                <button type="button" aria-label={`Remove ${byId.get(id)?.name || 'item'}`} onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-primary/15">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-surface-raised p-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-1">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-2/3" />)}</div>
        ) : error ? (
          <ErrorState title={`Could not load ${label.toLowerCase()}`} description={error.message} onRetry={onRetry} className="!py-6" />
        ) : !options?.length ? (
          <p className="p-3 text-sm text-text-muted">{emptyText}</p>
        ) : !shown.length ? (
          <p className="p-3 text-sm text-text-muted">No match for "{q}".</p>
        ) : (
          <ul className="grid gap-0.5 sm:grid-cols-2">
            {shown.map((o) => (
              <li key={o._id} className="rounded-md px-2 py-1.5 hover:bg-text/[0.05]">
                <Checkbox label={o.name} checked={sel.has(o._id)} onChange={() => toggle(o._id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
