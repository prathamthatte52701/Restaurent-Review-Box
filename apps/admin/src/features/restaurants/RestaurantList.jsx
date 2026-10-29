import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, DataTable, PageHeader, Select, Switch, notify } from '@rrb/ui';
import { api, imgUrl } from '../../lib/api.js';
import { CATEGORIES, inr, labelOf, TYPES } from '../../lib/constants.js';
import { useMasters } from '../../lib/useMasters.js';

const opts = (first, list, get = (x) => ({ value: x._id, label: x.name })) => [{ value: '', label: first }, ...(list || []).map(get)];
const YESNO = (all, yes, no) => [{ value: '', label: all }, { value: 'true', label: yes }, { value: 'false', label: no }];

export default function RestaurantList() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [p, setP] = useState({ search: '', sort: 'createdAt', order: 'desc', page: 1, limit: 10, city: '', cuisine: '', category: '', isActive: '', isFeatured: '' });
  const cities = useMasters('cities');
  const cuisines = useMasters('cuisines');

  const params = Object.fromEntries(Object.entries({ ...p, includeInactive: true }).filter(([, v]) => v !== ''));
  const query = useQuery({
    queryKey: ['restaurants', params],
    queryFn: () => api.get('/restaurants', { params }),
    placeholderData: keepPreviousData,
  });

  const flip = useMutation({
    meta: { errorTitle: 'Could not update restaurant' },
    mutationFn: ({ row, field }) => api.patch(`/restaurants/${row._id}`, { [field]: !row[field] }),
    onMutate: async ({ row, field }) => {
      await qc.cancelQueries({ queryKey: ['restaurants'] });
      const prev = qc.getQueriesData({ queryKey: ['restaurants'] });
      qc.setQueriesData({ queryKey: ['restaurants'] }, (old) => old?.data && { ...old, data: old.data.map((r) => (r._id === row._id ? { ...r, [field]: !r[field] } : r)) });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['restaurants'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); },
  });

  const remove = async (r) => {
    const ok = await notify.confirm({
      title: 'Delete restaurant?',
      message: `"${r.name}" and all of its uploaded images will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/restaurants/${r._id}`);
      qc.invalidateQueries({ queryKey: ['restaurants'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      notify.success('Restaurant deleted', `"${r.name}" was removed.`);
    } catch (e) {
      notify.error({ title: 'Could not delete restaurant', message: e.message });
    }
  };

  const set = (patch) => setP((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const filtered = ['city', 'cuisine', 'category', 'isActive', 'isFeatured'].some((k) => p[k] !== '') || p.search;

  const columns = [
    {
      key: 'name', header: 'Restaurant', sortable: true,
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          {r.coverImage?.url ? (
            <img src={imgUrl(r.coverImage.url)} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded-md border border-border object-cover" />
          ) : (
            <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-muted"><ImageOff className="h-4 w-4" /></span>
          )}
          <div className="min-w-0">
            <Link to={`/restaurants/${r._id}/edit`} className="block truncate font-medium hover:text-primary">{r.name}</Link>
            <p className="truncate text-xs text-text-muted">{[r.address?.area, r.address?.city?.name].filter(Boolean).join(', ') || '-'}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (r) => <Badge variant="outline">{labelOf(CATEGORIES, r.category)}</Badge> },
    { key: 'type', header: 'Type', hideOnMobile: true, render: (r) => labelOf(TYPES, r.type) },
    { key: 'priceForTwo', header: 'For two', sortable: true, align: 'right', hideOnMobile: true, render: (r) => inr(r.priceForTwo) },
    { key: 'ratingAvg', header: 'Rating', sortable: true, align: 'right', hideOnMobile: true, render: (r) => (r.ratingCount ? `${Number(r.ratingAvg).toFixed(1)} (${r.ratingCount})` : <span className="text-text-muted">-</span>) },
    { key: 'isActive', header: 'Active', render: (r) => <Switch checked={!!r.isActive} onCheckedChange={() => flip.mutate({ row: r, field: 'isActive' })} aria-label={`${r.name} active`} /> },
    { key: 'isFeatured', header: 'Featured', render: (r) => <Switch checked={!!r.isFeatured} onCheckedChange={() => flip.mutate({ row: r, field: 'isFeatured' })} aria-label={`${r.name} featured`} /> },
  ];

  const filters = (
    <div className="flex flex-wrap gap-2">
      <Select size="sm" aria-label="Filter by city" value={p.city} onChange={(e) => set({ city: e.target.value })} options={opts('All cities', cities.data)} />
      <Select size="sm" aria-label="Filter by cuisine" value={p.cuisine} onChange={(e) => set({ cuisine: e.target.value })} options={opts('All cuisines', cuisines.data)} />
      <Select size="sm" aria-label="Filter by category" value={p.category} onChange={(e) => set({ category: e.target.value })} options={opts('All categories', CATEGORIES, (c) => c)} />
      <Select size="sm" aria-label="Filter by status" value={p.isActive} onChange={(e) => set({ isActive: e.target.value })} options={YESNO('Any status', 'Active', 'Inactive')} />
      <Select size="sm" aria-label="Filter by featured" value={p.isFeatured} onChange={(e) => set({ isFeatured: e.target.value })} options={YESNO('Any featured', 'Featured', 'Not featured')} />
      {filtered ? <Button size="sm" variant="ghost" onClick={() => set({ search: '', city: '', cuisine: '', category: '', isActive: '', isFeatured: '' })}>Clear</Button> : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Restaurants"
        description="Every listing on the public discovery site."
        actions={
          <>
            <Button as={Link} to="/restaurants/import" variant="secondary" leftIcon={<FileUp className="h-4 w-4" />}>Bulk import</Button>
            <Button as={Link} to="/restaurants/new" leftIcon={<Plus className="h-4 w-4" />}>Add restaurant</Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.data || []}
        loading={query.isLoading}
        error={query.isError ? query.error : undefined}
        onRetry={() => query.refetch()}
        emptyTitle={filtered ? 'No restaurants match these filters' : 'No restaurants yet'}
        emptyDescription={filtered ? 'Try clearing a filter or searching for something else.' : 'Add a restaurant, or bulk import a JSON file, to get started.'}
        emptyAction={filtered ? null : <Button as={Link} to="/restaurants/new" leftIcon={<Plus className="h-4 w-4" />}>Add restaurant</Button>}
        searchValue={p.search}
        onSearchChange={(v) => set({ search: v })}
        searchPlaceholder="Search name, area or owner"
        toolbar={filters}
        sort={{ key: p.sort, order: p.order }}
        onSortChange={({ key, order }) => set({ sort: key, order })}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onLimitChange={(limit) => set({ limit })}
        limitOptions={[5, 10, 25, 50]}
        rowActions={(r) => [
          { label: 'Edit', icon: <Pencil />, onSelect: () => nav(`/restaurants/${r._id}/edit`) },
          { type: 'separator' },
          { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
        ]}
      />
    </>
  );
}
