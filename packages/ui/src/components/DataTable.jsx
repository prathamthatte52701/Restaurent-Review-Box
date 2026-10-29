import { ArrowDown, ArrowUp, ChevronsUpDown, SearchX } from 'lucide-react';
import { cn, asArray, asText, useMediaQuery } from '../utils.js';
import { Card, EmptyState, ErrorState, Skeleton } from './display.jsx';
import { Checkbox, SearchInput } from './forms.jsx';
import { DropdownMenu } from './Overlay.jsx';
import { Pagination, Table, TBody, TD, TH, THead, TR } from './Table.jsx';
import { Button } from './Button.jsx';

const defaultRowId = (row, i) => row?.id ?? row?._id ?? i;

function cell(col, row, i) {
  if (typeof col.render === 'function') {
    try { return col.render(row, i); } catch { return '-'; }
  }
  const v = row?.[col.key];
  return v === undefined || v === null || v === '' ? <span className="text-text-muted">-</span> : typeof v === 'object' ? '' : String(v);
}

/**
 * DataTable: the one list component for every admin screen. Fully controlled / server-side.
 *
 * columns: [{ key, header, sortable, render(row), width, align: 'left'|'right'|'center', hideOnMobile }]
 * rows, loading, error + onRetry, emptyTitle/emptyDescription/emptyAction
 * searchValue/onSearchChange (+ searchPlaceholder, searchDebounce=300)
 * sort {key, order:'asc'|'desc'} + onSortChange({key, order})
 * pagination {page, limit, total, totalPages} + onPageChange(page) + onLimitChange(limit) + limitOptions
 * rowActions(row) -> DropdownMenu items; inlineActions(row) -> node
 * selectable, selectedIds, onSelectionChange(ids), bulkActions (node or (ids)=>node)
 * toolbar: node (filters) ; getRowId(row)
 */
export function DataTable({
  columns, rows, loading = false, error, onRetry,
  emptyTitle = 'No results', emptyDescription, emptyAction,
  searchValue, onSearchChange, searchPlaceholder = 'Search', searchDebounce = 300,
  sort, onSortChange,
  pagination, onPageChange, onLimitChange, limitOptions,
  rowActions, inlineActions,
  selectable, selectedIds, onSelectionChange, bulkActions,
  toolbar, getRowId = defaultRowId, className, caption,
}) {
  const cols = asArray(columns).filter((c) => c && c.key !== undefined);
  const data = asArray(rows);
  const mobile = useMediaQuery('(max-width: 639px)');
  const canSelect = Boolean(selectable ?? onSelectionChange);
  const selected = asArray(selectedIds);
  const hasActions = typeof rowActions === 'function' || typeof inlineActions === 'function';
  const ids = data.map((r, i) => getRowId(r, i));
  const allOn = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someOn = !allOn && ids.some((id) => selected.includes(id));
  const setSel = (next) => typeof onSelectionChange === 'function' && onSelectionChange(next);
  const toggleAll = () => setSel(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  const toggleOne = (id) => setSel(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const sortKey = sort?.key;
  const sortOrder = sort?.order === 'desc' ? 'desc' : 'asc';
  const sortBy = (key) => typeof onSortChange === 'function' && onSortChange({ key, order: sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc' });
  const pg = pagination && typeof pagination === 'object' ? pagination : null;
  const skeletonCount = Math.min(Math.max(Number(pg?.limit) || 5, 3), 8);

  const actionsFor = (row) => {
    if (!hasActions) return null;
    let items = [];
    try { items = typeof rowActions === 'function' ? asArray(rowActions(row)) : []; } catch { items = []; }
    return (
      <div className="flex items-center justify-end gap-1">
        {typeof inlineActions === 'function' ? inlineActions(row) : null}
        {items.length ? <DropdownMenu items={items} label="Row actions" /> : null}
      </div>
    );
  };

  const showSearch = typeof onSearchChange === 'function';
  const hasBulk = canSelect && selected.length > 0 && bulkActions;

  let body;
  if (error) {
    body = <ErrorState description={typeof error === 'string' ? error : error?.message} onRetry={onRetry} />;
  } else if (loading) {
    body = mobile ? (
      <ul aria-busy="true" className="divide-y divide-border">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <li key={i} className="space-y-2.5 p-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></li>
        ))}
      </ul>
    ) : (
      <Table aria-busy="true">
        <TBody>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <TR key={i}>
              {canSelect ? <TD className="w-10"><Skeleton className="h-4 w-4" /></TD> : null}
              {cols.map((c, j) => <TD key={c.key}><Skeleton className={cn('h-4', j === 0 ? 'w-3/4' : 'w-1/2')} /></TD>)}
              {hasActions ? <TD className="w-12"><Skeleton className="ml-auto h-6 w-6" /></TD> : null}
            </TR>
          ))}
        </TBody>
      </Table>
    );
  } else if (!data.length) {
    body = (
      <EmptyState
        icon={searchValue ? <SearchX className="h-5 w-5" /> : undefined}
        title={searchValue ? 'No matches' : emptyTitle}
        description={searchValue ? `Nothing found for "${asText(searchValue)}". Try a different search.` : emptyDescription}
        action={emptyAction}
      />
    );
  } else if (mobile) {
    body = (
      <ul className="divide-y divide-border">
        {data.map((row, i) => {
          const id = ids[i];
          const on = selected.includes(id);
          return (
            <li key={`${id}-${i}`} data-selected={on} className={cn('flex gap-3 p-4', on && 'bg-primary-soft/60')}>
              {canSelect ? <Checkbox aria-label="Select row" checked={on} onChange={() => toggleOne(id)} className="mt-0.5" /> : null}
              <dl className="min-w-0 flex-1 space-y-2">
                {cols.filter((c) => !c.hideOnMobile).map((c, ci) => (
                  <div key={c.key} className={cn(ci === 0 ? '' : 'flex items-baseline justify-between gap-3 text-sm')}>
                    {ci === 0 ? <dd className="font-medium">{cell(c, row, i)}</dd> : (
                      <>
                        <dt className="shrink-0 text-xs uppercase tracking-wider text-text-muted">{asText(c.header)}</dt>
                        <dd className="min-w-0 text-right">{cell(c, row, i)}</dd>
                      </>
                    )}
                  </div>
                ))}
              </dl>
              {hasActions ? <div className="shrink-0">{actionsFor(row)}</div> : null}
            </li>
          );
        })}
      </ul>
    );
  } else {
    body = (
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <THead>
          <tr>
            {canSelect ? (
              <TH className="w-10 !pr-0"><Checkbox aria-label="Select all rows" checked={allOn} indeterminate={someOn} onChange={toggleAll} /></TH>
            ) : null}
            {cols.map((c) => {
              const active = sortKey === c.key;
              return (
                <TH
                  key={c.key}
                  align={c.align}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={c.sortable ? (active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => sortBy(c.key)} className={cn('-mx-1 inline-flex items-center gap-1 rounded-xs px-1 uppercase tracking-wider transition-colors hover:text-text', active && 'text-text', c.align === 'right' && 'flex-row-reverse')}>
                      {asText(c.header)}
                      {active ? (sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </button>
                  ) : asText(c.header)}
                </TH>
              );
            })}
            {hasActions ? <TH className="w-12"><span className="sr-only">Actions</span></TH> : null}
          </tr>
        </THead>
        <TBody>
          {data.map((row, i) => {
            const id = ids[i];
            const on = selected.includes(id);
            return (
              <TR key={`${id}-${i}`} data-selected={on}>
                {canSelect ? <TD className="w-10 !pr-0"><Checkbox aria-label="Select row" checked={on} onChange={() => toggleOne(id)} /></TD> : null}
                {cols.map((c) => <TD key={c.key} align={c.align}>{cell(c, row, i)}</TD>)}
                {hasActions ? <TD className="w-12 !py-2">{actionsFor(row)}</TD> : null}
              </TR>
            );
          })}
        </TBody>
      </Table>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      {showSearch || toolbar || hasBulk ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showSearch ? (
            <SearchInput value={asText(searchValue)} onChange={onSearchChange} debounce={searchDebounce} placeholder={searchPlaceholder} className="sm:max-w-xs sm:flex-1" />
          ) : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
          {hasBulk ? (
            <div role="region" aria-label="Bulk actions" className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft px-3 py-1.5 sm:ml-auto">
              <span className="text-sm font-medium tabular-nums">{selected.length} selected</span>
              {typeof bulkActions === 'function' ? bulkActions(selected) : bulkActions}
              <Button variant="ghost" size="sm" onClick={() => setSel([])}>Clear</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <Card className="min-w-0 overflow-hidden">{body}</Card>
      {pg && !error && (pg.total > 0 || data.length > 0) ? (
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} limit={pg.limit} limitOptions={limitOptions} onPageChange={onPageChange} onLimitChange={onLimitChange} />
      ) : null}
    </div>
  );
}
