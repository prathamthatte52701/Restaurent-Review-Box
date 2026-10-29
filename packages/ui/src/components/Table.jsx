import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils.js';
import { Button } from './Button.jsx';
import { Select } from './forms.jsx';

/** Semantic styled table. The wrapper scrolls horizontally so the page never does. */
export function Table({ className, wrapperClassName, ...p }) {
  return (
    <div className={cn('w-full overflow-x-auto', wrapperClassName)}>
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...p} />
    </div>
  );
}
export const THead = ({ className, ...p }) => <thead className={cn('border-b border-border bg-surface', className)} {...p} />;
export const TBody = ({ className, ...p }) => <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...p} />;
export const TR = ({ className, ...p }) => <tr className={cn('transition-colors duration-fast hover:bg-text/[0.025] data-[selected=true]:bg-primary-soft/60', className)} {...p} />;
export const TH = ({ className, align, ...p }) => (
  <th scope="col" className={cn('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted', align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left', className)} {...p} />
);
export const TD = ({ className, align, ...p }) => (
  <td className={cn('border-b border-border px-4 py-3.5 align-middle', align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left', className)} {...p} />
);
Table.Head = THead;
Table.Body = TBody;
Table.Row = TR;
Table.Th = TH;
Table.Td = TD;

/** Page list with ellipses: [1, '…', 4, 5, 6, '…', 20] */
export function pageList(page, total, siblings = 1) {
  if (total <= 5 + siblings * 2) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, total - 1);
  const out = [1];
  if (left > 2) out.push('l…');
  for (let i = left; i <= right; i += 1) out.push(i);
  if (right < total - 1) out.push('r…');
  out.push(total);
  return out;
}

/**
 * Pagination. page (1-based), totalPages, onPageChange; optional limit/limitOptions/onLimitChange/total.
 */
export function Pagination({ page = 1, totalPages = 1, total, limit, limitOptions = [10, 20, 50], onPageChange, onLimitChange, className }) {
  const tp = Math.max(1, Math.floor(Number(totalPages)) || 1);
  const p = Math.min(tp, Math.max(1, Math.floor(Number(page)) || 1));
  const go = (n) => typeof onPageChange === 'function' && n >= 1 && n <= tp && n !== p && onPageChange(n);
  const nTotal = Number(total);
  const nLimit = Number(limit);
  const showing = Number.isFinite(nTotal) && Number.isFinite(nLimit) && nLimit > 0 && nTotal > 0 ? `${(p - 1) * nLimit + 1}-${Math.min(nTotal, p * nLimit)} of ${nTotal}` : null;
  return (
    <nav aria-label="Pagination" className={cn('flex flex-col items-center gap-3 sm:flex-row sm:justify-between', className)}>
      <div className="flex items-center gap-3 text-sm text-text-muted">
        {showing ? <span className="tabular-nums">{showing}</span> : null}
        {typeof onLimitChange === 'function' && limit ? (
          <label className="flex items-center gap-2">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <Select size="sm" aria-label="Rows per page" value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} options={[...new Set([...limitOptions, nLimit])].sort((a, b) => a - b)} className="w-[4.5rem]" />
          </label>
        ) : null}
      </div>
      <ul className="flex items-center gap-1">
        <li>
          <Button variant="ghost" size="sm" aria-label="Previous page" disabled={p <= 1} onClick={() => go(p - 1)} className="!px-2"><ChevronLeft className="h-4 w-4" /></Button>
        </li>
        {pageList(p, tp).map((it) =>
          typeof it === 'string' ? (
            <li key={it} aria-hidden="true" className="px-1 text-text-muted">…</li>
          ) : (
            <li key={it}>
              <Button
                variant={it === p ? 'primary' : 'ghost'}
                size="sm"
                aria-label={`Page ${it}`}
                aria-current={it === p ? 'page' : undefined}
                onClick={() => go(it)}
                className="min-w-8 !px-2 tabular-nums"
              >
                {it}
              </Button>
            </li>
          ),
        )}
        <li>
          <Button variant="ghost" size="sm" aria-label="Next page" disabled={p >= tp} onClick={() => go(p + 1)} className="!px-2"><ChevronRight className="h-4 w-4" /></Button>
        </li>
      </ul>
    </nav>
  );
}
