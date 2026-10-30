import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Search, Store, UtensilsCrossed, X } from 'lucide-react';
import { cn, useDebounce } from '@rrb/ui';
import { useSuggest } from '../../hooks/restaurants.js';

const KEY = 'rrb-recent-searches';
const MAX_RECENT = 6;
const readRecent = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};
const writeRecent = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: recents just won't persist */ }
};

export function GlobalSearch({ className, onNavigate, autoFocus }) {
  const navigate = useNavigate();
  const uid = useId();
  const listId = `${uid}-list`;
  const root = useRef(null);
  const input = useRef(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const q = useDebounce(text.trim().slice(0, 100), 250);
  const suggest = useSuggest(q);
  const typed = text.trim().length > 0;

  // rows: flat list of selectable options, with group headings kept alongside for rendering
  const groups = useMemo(() => {
    if (!typed) return recent.length ? [{ key: 'recent', title: 'Recent searches', items: recent.map((t) => ({ id: `r-${t}`, label: t, icon: Clock, run: () => submit(t) })) }] : [];
    const d = suggest.data?.data;
    if (!d) return [];
    return [
      { key: 'restaurants', title: 'Restaurants', items: d.restaurants.map((r) => ({ id: `rs-${r.slug}`, label: r.name, sub: r.area, icon: Store, run: () => go(`/restaurants/${r.slug}`, r.name) })) },
      { key: 'cuisines', title: 'Cuisines', items: d.cuisines.map((c) => ({ id: `cu-${c.slug}`, label: c.name, icon: UtensilsCrossed, run: () => go(`/restaurants?cuisines=${encodeURIComponent(c.slug)}`, c.name) })) },
      { key: 'areas', title: 'Areas', items: d.areas.map((a) => ({ id: `ar-${a.name}`, label: a.name, sub: `${a.count} ${a.count === 1 ? 'place' : 'places'}`, icon: MapPin, run: () => go(`/restaurants?q=${encodeURIComponent(a.name)}`, a.name) })) },
    ].filter((g) => g.items.length);
  }, [typed, recent, suggest.data, q, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = groups.flatMap((g) => g.items);

  const remember = useCallback((term) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  }, []);
  const close = () => { setOpen(false); setActive(-1); };
  function go(path, term) {
    remember(term);
    close();
    setText('');
    input.current?.blur();
    onNavigate?.();
    navigate(path);
  }
  function submit(term) {
    const t = term.trim().slice(0, 100);
    go(t ? `/restaurants?q=${encodeURIComponent(t)}` : '/restaurants', t);
  }

  useEffect(() => { setActive(-1); }, [q, typed]);
  useEffect(() => {
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => (flat.length ? (i + 1) % flat.length : -1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (flat.length ? (i <= 0 ? flat.length - 1 : i - 1) : -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && flat[active]) flat[active].run();
      else submit(text);
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close(); } else if (text) setText('');
    }
  };

  const showPanel = open && (flat.length > 0 || (typed && !suggest.isFetching && suggest.isSuccess) || (typed && suggest.isError));
  const activeId = active >= 0 && flat[active] ? `${uid}-opt-${flat[active].id}` : undefined;
  let idx = -1;

  return (
    <div ref={root} className={cn('relative', className)}>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          ref={input}
          autoFocus={autoFocus}
          type="text"
          role="combobox"
          aria-label="Search restaurants, cuisines and areas"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          placeholder="Search restaurants, cuisines, areas"
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="h-10 w-full rounded-md border border-border-strong bg-surface-raised pl-9 pr-9 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:shadow-ring"
        />
        {text ? (
          <button type="button" aria-label="Clear search" onClick={() => { setText(''); input.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs p-0.5 text-text-muted hover:bg-text/10 hover:text-text">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div id={listId} role="listbox" aria-label="Search suggestions" hidden={!showPanel} className="absolute left-0 right-0 top-full z-dropdown mt-2 max-h-[70vh] min-w-[18rem] overflow-y-auto rounded-lg border border-border bg-surface-overlay p-1.5 shadow-lg">
        {groups.map((g) => (
          <div key={g.key} role="group" aria-labelledby={`${uid}-g-${g.key}`}>
            <div className="flex items-center justify-between px-2.5 pb-1 pt-2">
              <p id={`${uid}-g-${g.key}`} className="text-eyebrow uppercase text-text-muted">{g.title}</p>
              {g.key === 'recent' ? <button type="button" onClick={() => { writeRecent([]); setRecent([]); }} className="rounded-sm px-1 text-xs font-medium text-primary hover:underline">Clear</button> : null}
            </div>
            {g.items.map((it) => {
              idx += 1;
              const i = idx;
              const Icon = it.icon;
              return (
                <div
                  key={it.id}
                  id={`${uid}-opt-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => active !== i && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={it.run}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm', i === active ? 'bg-primary-soft text-text' : 'text-text')}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.sub ? <span className="shrink-0 text-xs text-text-muted">{it.sub}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
        {typed && !flat.length && suggest.isSuccess ? (
          <div className="px-3 py-4 text-sm text-text-muted">
            Nothing matches “{text.trim().slice(0, 40)}”. <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(text)} className="font-medium text-primary hover:underline">Search all restaurants</button>
          </div>
        ) : null}
        {typed && suggest.isError ? <div className="px-3 py-4 text-sm text-text-muted" role="alert">Suggestions are unavailable. Press Enter to search anyway.</div> : null}
      </div>
    </div>
  );
}
