import { useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, DataTable, FormField, Input, Modal, PageHeader, Select, Switch, notify } from '@rrb/ui';
import { api } from '../../lib/api.js';
import { confirmDiscard, useUnsavedGuard } from '../../lib/useUnsavedGuard.js';
import { ICON_OPTIONS, iconFor } from '../../lib/icons.js';

const DEFAULTS = { name: '', state: '', icon: '', isActive: true };

function MasterForm({ config, item, onClose, dirtyRef }) {
  const qc = useQueryClient();
  const editing = Boolean(item);
  const { register, control, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(config.schema),
    defaultValues: { ...DEFAULTS, ...Object.fromEntries(config.fields.map((f) => [f.name, item?.[f.name] ?? ''])), isActive: item?.isActive ?? true },
  });

  useUnsavedGuard(isDirty);
  dirtyRef.current = isDirty;

  const save = useMutation({
    meta: { silent: true },
    mutationFn: (v) => (editing ? api.patch(`${config.endpoint}/${item._id}`, v) : api.post(config.endpoint, v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.key] });
      qc.invalidateQueries({ queryKey: ['masters', config.key] });
      dirtyRef.current = false;
      onClose();
      notify.success(`${config.singular} ${editing ? 'updated' : 'created'}`, `The ${config.singular.toLowerCase()} was saved successfully.`);
    },
    onError: (e) => {
      const fieldErrs = e.errors && typeof e.errors === 'object' ? Object.entries(e.errors).filter(([k]) => config.fields.some((f) => f.name === k)) : [];
      fieldErrs.forEach(([k, m]) => setError(k, { message: String(m) }));
      notify.error({ title: `Could not save ${config.singular.toLowerCase()}`, message: e.message });
    },
  });

  // empty optional strings must not be sent as "" for state/icon in a way that fails validation; backend accepts ""
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <Modal.Body className="flex flex-col gap-4">
        {config.fields.map((f) => (
          <FormField key={f.name} label={f.label} required={f.required} hint={f.hint} error={errors[f.name]?.message}>
            {f.type === 'icon' ? <Select options={ICON_OPTIONS} {...register(f.name)} /> : <Input autoFocus={f.name === 'name'} {...register(f.name)} />}
          </FormField>
        ))}
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label={field.value ? 'Active (visible on the public site)' : 'Inactive (hidden)'} />}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="ghost" onClick={async () => { if (await confirmDiscard(isDirty)) onClose(); }}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : `Create ${config.singular.toLowerCase()}`}</Button>
      </Modal.Footer>
    </form>
  );
}

export default function MasterPage({ config }) {
  // remount all local state when switching between masters
  return <MasterInner key={config.key} config={config} />;
}

function MasterInner({ config }) {
  const qc = useQueryClient();
  const [params, setParams] = useState({ search: '', sort: 'name', order: 'asc', page: 1, limit: 10 });
  const dirtyRef = useRef(false);
  const [modal, setModal] = useState(null); // {item?} | null

  const query = useQuery({
    queryKey: [config.key, params],
    queryFn: () => api.get(config.endpoint, { params: { ...params, includeInactive: true } }),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    meta: { errorTitle: 'Could not update status' },
    mutationFn: (row) => api.patch(`${config.endpoint}/${row._id}`, { isActive: !row.isActive }),
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: [config.key] });
      const prev = qc.getQueriesData({ queryKey: [config.key] });
      qc.setQueriesData({ queryKey: [config.key] }, (old) => old && { ...old, data: old.data.map((r) => (r._id === row._id ? { ...r, isActive: !r.isActive } : r)) });
      return { prev };
    },
    onError: (_e, _r, ctx) => ctx?.prev.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: [config.key] }),
  });

  const remove = async (row) => {
    const ok = await notify.confirm({ title: `Delete ${config.singular.toLowerCase()}?`, message: `"${row.name}" will be permanently removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`${config.endpoint}/${row._id}`);
      qc.invalidateQueries({ queryKey: [config.key] });
      qc.invalidateQueries({ queryKey: ['masters', config.key] });
      notify.success(`${config.singular} deleted`, `"${row.name}" was removed.`);
    } catch (e) {
      notify.error({ title: e.status === 409 ? `${config.singular} is in use` : `Could not delete ${config.singular.toLowerCase()}`, message: e.message });
    }
  };

  const colDefs = {
    name: { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    state: { key: 'state', header: 'State', hideOnMobile: true },
    icon: {
      key: 'icon', header: 'Icon', width: '9rem',
      render: (r) => {
        const I = iconFor(r.icon);
        return r.icon ? <span className="inline-flex items-center gap-2 text-text-muted">{I ? <I className="h-4 w-4" /> : null}{r.icon}</span> : <span className="text-text-muted">-</span>;
      },
    },
  };
  const columns = [
    ...config.columns.map((c) => colDefs[c]),
    {
      key: 'isActive', header: 'Status', width: '8rem',
      render: (r) => <Switch checked={r.isActive} onCheckedChange={() => toggle.mutate(r)} aria-label={`${r.name} active`} />,
    },
    { key: 'createdAt', header: 'Created', sortable: true, hideOnMobile: true, render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const set = (patch) => setParams((p) => ({ ...p, ...patch }));
  const rows = query.data?.data || [];

  return (
    <>
      <PageHeader
        title={config.plural}
        description={config.description}
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal({})}>Add {config.singular.toLowerCase()}</Button>}
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={query.isLoading}
        error={query.isError ? query.error : undefined}
        onRetry={() => query.refetch()}
        emptyTitle={params.search ? `No ${config.plural.toLowerCase()} match your search` : `No ${config.plural.toLowerCase()} yet`}
        emptyDescription={params.search ? 'Try a different search term.' : `Add your first ${config.singular.toLowerCase()} to get started.`}
        emptyAction={params.search ? null : <Button onClick={() => setModal({})} leftIcon={<Plus className="h-4 w-4" />}>Add {config.singular.toLowerCase()}</Button>}
        searchValue={params.search}
        onSearchChange={(v) => set({ search: v, page: 1 })}
        searchPlaceholder={`Search ${config.plural.toLowerCase()}`}
        sort={{ key: params.sort, order: params.order }}
        onSortChange={({ key, order }) => set({ sort: key, order, page: 1 })}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onLimitChange={(limit) => set({ limit, page: 1 })}
        limitOptions={[5, 10, 25, 50]}
        rowActions={(r) => [
          { label: 'Edit', icon: <Pencil />, onSelect: () => setModal({ item: r }) },
          { type: 'separator' },
          { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
        ]}
      />
      <Modal open={Boolean(modal)} onOpenChange={async (o) => { if (!o && (await confirmDiscard(dirtyRef.current))) { dirtyRef.current = false; setModal(null); } }}>
        <Modal.Header title={modal?.item ? `Edit ${config.singular.toLowerCase()}` : `New ${config.singular.toLowerCase()}`} description={modal?.item ? <Badge variant={modal.item.isActive ? 'success' : 'neutral'} dot>{modal.item.isActive ? 'Active' : 'Inactive'}</Badge> : undefined} />
        {modal ? <MasterForm config={config} item={modal.item} onClose={() => { dirtyRef.current = false; setModal(null); }} dirtyRef={dirtyRef} /> : null}
      </Modal>
    </>
  );
}
