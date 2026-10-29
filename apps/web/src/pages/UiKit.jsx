import { useMemo, useState } from 'react';
import { Bell, Heart, Mail, Plus, Settings, Star, Trash2, Users, Utensils } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, Container, DataTable, Divider, DropdownMenu, EmptyState, ErrorState,
  FormField, IconButton, Input, Modal, PageHeader, Pagination, Popover, Radio, RadioGroup, SearchInput, Select, Sheet, Skeleton,
  Spinner, StarRating, StatCard, Switch, TBody, TD, TH, THead, TR, Table, Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
  ThemeToggle, Tooltip, notify,
} from '@rrb/ui';

const Section = ({ title, children }) => (
  <section className="border-t border-border py-10">
    <h2 className="mb-6 font-display text-display-sm">{title}</h2>
    <div className="flex flex-col gap-6">{children}</div>
  </section>
);
const Row = ({ label, children }) => (
  <div>
    {label ? <p className="mb-2 text-eyebrow uppercase text-text-muted">{label}</p> : null}
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

const NAMES = ['Sarafa Night Market', 'Chappan Dukan Chaat', 'Johny Hot Dog', 'Guru Kripa Sweets', 'Ratlami Sev House', 'Annapurna Thali', 'Cafe Nukkad', 'Barbeque Nation', 'Jaiswal Poha', 'Vijay Chaat House', 'Bapu Ki Kutia', 'Mohan Nagar Dhaba'];
const FAKE = NAMES.map((name, i) => ({ id: i + 1, name, area: ['Sarafa', 'Palasia', 'Vijay Nagar', 'Rajwada'][i % 4], rating: +(3.4 + ((i * 37) % 16) / 10).toFixed(1), reviews: 40 + i * 53, status: i % 3 ? 'Published' : 'Draft' }));

function DataTableDemo({ mode }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', order: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const rows = useMemo(() => {
    const f = FAKE.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
    const s = [...f].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : -1) * (sort.order === 'asc' ? 1 : -1));
    return s;
  }, [search, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const shown = rows.slice((page - 1) * limit, page * limit);
  return (
    <DataTable
      columns={[
        { key: 'name', header: 'Restaurant', sortable: true },
        { key: 'area', header: 'Area', sortable: true, hideOnMobile: true },
        { key: 'rating', header: 'Rating', sortable: true, align: 'right', render: (r) => <span className="tabular-nums">{r.rating}</span> },
        { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'Published' ? 'success' : 'neutral'} dot>{r.status}</Badge> },
      ]}
      rows={mode === 'loading' ? [] : mode === 'empty' ? [] : shown}
      loading={mode === 'loading'}
      error={mode === 'error' ? 'Could not load restaurants' : undefined}
      onRetry={() => {}}
      emptyTitle="No restaurants match"
      emptyDescription="Try a different search."
      searchValue={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      sort={sort}
      onSortChange={setSort}
      pagination={{ page, limit, total: rows.length, totalPages }}
      onPageChange={setPage}
      onLimitChange={(l) => { setLimit(l); setPage(1); }}
      limitOptions={[5, 10]}
      rowActions={() => [{ label: 'Edit', icon: <Settings /> }, { type: 'separator' }, { label: 'Delete', icon: <Trash2 />, danger: true }]}
      getRowId={(r) => r.id}
    />
  );
}

function ModalDemos() {
  const [size, setSize] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [stack, setStack] = useState(0);
  return (
    <>
      <Row label="Modal sizes">
        {['sm', 'md', 'lg', 'full'].map((s) => <Button key={s} variant="secondary" onClick={() => setSize(s)}>Open {s}</Button>)}
        <Button variant="secondary" onClick={() => setStack(1)}>Stacked x3</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>Confirm dialog</Button>
        <Sheet side="right" label="Right sheet" trigger={<Button variant="outline">Right sheet</Button>}>
          <Sheet.Header title="Filters" description="Sheet slides from the right" />
          <Sheet.Body>Sheet body content.</Sheet.Body>
          <Sheet.Footer><Sheet.Close asChild><Button>Done</Button></Sheet.Close></Sheet.Footer>
        </Sheet>
      </Row>
      <Modal open={Boolean(size)} onOpenChange={(o) => !o && setSize(null)} size={size || 'md'}>
        <Modal.Header title={`Modal (${size})`} description="Focus is trapped. Esc closes." />
        <Modal.Body><p>Tab around: focus stays inside and returns to the trigger on close.</p><Input className="mt-4" placeholder="Focusable input" aria-label="Demo input" /></Modal.Body>
        <Modal.Footer><Modal.Close asChild><Button variant="ghost">Cancel</Button></Modal.Close><Modal.Close asChild><Button>Save</Button></Modal.Close></Modal.Footer>
      </Modal>
      {[1, 2, 3].map((n) => (
        <Modal key={n} open={stack >= n} onOpenChange={(o) => !o && setStack(n - 1)} size="sm">
          <Modal.Header title={`Stacked modal ${n} of 3`} />
          <Modal.Body>{n < 3 ? <Button onClick={() => setStack(n + 1)}>Open another</Button> : 'Deepest level. Press Esc three times.'}</Modal.Body>
        </Modal>
      ))}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title="Delete this review?" description="This cannot be undone." confirmLabel="Delete" onConfirm={() => new Promise((r) => setTimeout(r, 700))} />
    </>
  );
}

export default function UiKit() {
  const [rating, setRating] = useState(3);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('a');
  const [sw, setSw] = useState(true);
  const [page, setPage] = useState(3);
  const [mode, setMode] = useState('ready');
  return (
    <Container size="xl" className="py-10">
      <PageHeader eyebrow="Design system" title="UI kit" description="Every @rrb/ui primitive in every variant and state." actions={<ThemeToggle />} />

      <Section title="Buttons">
        {['primary', 'secondary', 'outline', 'ghost', 'danger'].map((v) => (
          <Row key={v} label={v}>
            {['sm', 'md', 'lg'].map((s) => <Button key={s} variant={v} size={s}>{v} {s}</Button>)}
            <Button variant={v} loading>Loading</Button>
            <Button variant={v} disabled>Disabled</Button>
            <Button variant={v} leftIcon={<Plus className="h-4 w-4" />}>Left icon</Button>
          </Row>
        ))}
        <Row label="Icon buttons">
          {['sm', 'md', 'lg'].map((s) => <IconButton key={s} size={s} aria-label={`Like ${s}`} variant="outline" icon={<Heart className="h-4 w-4" />} />)}
          <IconButton aria-label="Loading icon" loading variant="secondary" />
          <IconButton aria-label="Disabled icon" disabled icon={<Bell className="h-4 w-4" />} />
          <Spinner size={24} />
        </Row>
      </Section>

      <Section title="Inputs and form fields">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="Default" hint="Helper text sits here"><Input placeholder="Placeholder" /></FormField>
          <FormField label="With icon"><Input leftAdornment={<Mail />} placeholder="you@example.com" /></FormField>
          <FormField label="Required" required><Input placeholder="Required field" /></FormField>
          <FormField label="Error" error="That doesn't look right"><Input defaultValue="bad value" /></FormField>
          <FormField label="Disabled"><Input disabled defaultValue="Can't edit" /></FormField>
          <FormField label="Select"><Select options={[{ value: '', label: 'Choose area' }, 'Sarafa', 'Palasia', 'Vijay Nagar']} /></FormField>
          <FormField label="Select error" error="Pick one"><Select options={['Pick...', 'One']} /></FormField>
          <FormField label="Textarea" hint="Tell us more"><Textarea rows={3} placeholder="Write something" /></FormField>
          <FormField label="Search"><SearchInput placeholder="Search restaurants" /></FormField>
        </div>
        <Row label="Checkbox / Radio / Switch">
          <Checkbox label="Checked" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <Checkbox label="Unchecked" />
          <Checkbox label="Indeterminate" indeterminate />
          <Checkbox label="Disabled" disabled />
          <RadioGroup value={radio} onValueChange={setRadio} orientation="horizontal">
            <Radio value="a" label="Vegetarian" /><Radio value="b" label="Non-veg" /><Radio value="c" label="Disabled" disabled />
          </RadioGroup>
          <Switch checked={sw} onCheckedChange={setSw} label="Notifications" />
          <Switch disabled label="Disabled" />
        </Row>
      </Section>

      <Section title="Cards, badges, avatars, ratings">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><Card.Header><Card.Title>Card with parts</Card.Title></Card.Header><Card.Body className="text-sm text-text-muted">Body copy lives here.</Card.Body><Card.Footer><Button size="sm" variant="ghost">Cancel</Button><Button size="sm">Save</Button></Card.Footer></Card>
          <Card interactive className="p-5"><p className="font-display text-lg">Interactive card</p><p className="mt-1 text-sm text-text-muted">Hover for the lifted border.</p></Card>
          <Card className="p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-3 h-4" /><Skeleton className="mt-2 h-4 w-5/6" /><div className="mt-4 flex gap-3"><Skeleton circle className="h-10 w-10" /><Skeleton className="h-10 flex-1" /></div></Card>
        </div>
        <Row label="Badges">
          {['neutral', 'primary', 'success', 'warning', 'danger', 'outline'].map((v) => <Badge key={v} variant={v}>{v}</Badge>)}
          <Badge variant="success" dot>with dot</Badge>
        </Row>
        <Row label="Avatars">
          {['xs', 'sm', 'md', 'lg', 'xl'].map((s) => <Avatar key={s} size={s} name="Aarti Sharma" />)}
          <Avatar name="" /><Avatar name="Rohan" src="/missing.png" />
        </Row>
        <Row label="Star rating">
          <StarRating value={4.5} readOnly /><StarRating value={rating} onChange={setRating} label="Your rating" /><StarRating value={2} readOnly size={28} /><span className="text-sm text-text-muted">{rating} / 5</span>
        </Row>
        <Divider label="Divider with label" />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Reviews" value="12,480" delta={8} icon={<Star />} hint="vs last month" />
          <StatCard label="Restaurants" value="842" delta={-3} icon={<Utensils />} />
          <StatCard label="Members" value="3,201" icon={<Users />} />
        </div>
      </Section>

      <Section title="Tabs, dropdown, tooltip, popover">
        <Tabs defaultValue="one">
          <TabsList><TabsTrigger value="one">Overview</TabsTrigger><TabsTrigger value="two">Reviews</TabsTrigger><TabsTrigger value="three" disabled>Disabled</TabsTrigger></TabsList>
          <TabsContent value="one" className="pt-4 text-sm text-text-muted">Overview panel</TabsContent>
          <TabsContent value="two" className="pt-4 text-sm text-text-muted">Reviews panel</TabsContent>
        </Tabs>
        <Row label="Overlays">
          <DropdownMenu items={[{ type: 'label', label: 'Actions' }, { label: 'Edit', icon: <Settings /> }, { label: 'Disabled', disabled: true }, { type: 'separator' }, { label: 'Delete', icon: <Trash2 />, danger: true }]} />
          <Tooltip content="Helpful hint"><Button variant="outline">Hover me</Button></Tooltip>
          <Popover trigger={<Button variant="outline">Open popover</Button>}><p className="text-sm">Popover content with <b>rich</b> text.</p></Popover>
        </Row>
      </Section>

      <Section title="Table, pagination, DataTable">
        <Table>
          <THead><TR><TH>Dish</TH><TH align="right">Price</TH></TR></THead>
          <TBody><TR><TD>Poha</TD><TD align="right">40</TD></TR><TR><TD>Jalebi</TD><TD align="right">60</TD></TR></TBody>
        </Table>
        <Pagination page={page} totalPages={12} total={118} limit={10} onPageChange={setPage} onLimitChange={() => {}} />
        <Row label="DataTable state">
          {['ready', 'loading', 'empty', 'error'].map((m) => <Button key={m} size="sm" variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)}>{m}</Button>)}
        </Row>
        <DataTableDemo mode={mode} />
      </Section>

      <Section title="States and headers">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><EmptyState title="No reviews yet" description="Be the first to share a meal." action={<Button size="sm">Write a review</Button>} /></Card>
          <Card><ErrorState description="We couldn't load this." onRetry={() => {}} /></Card>
        </div>
        <Card className="px-6 pt-6"><PageHeader eyebrow="Eyebrow" title="Page header" description="With description and actions" actions={<><Button variant="outline">Secondary</Button><Button>Primary</Button></>} /></Card>
      </Section>

      <Section title="Modals">
        <ModalDemos />
      </Section>

      <Section title="Notifications">
        <Row>
          <Button variant="secondary" onClick={() => notify.success('Saved', 'Your changes were saved.')}>Success</Button>
          <Button variant="secondary" onClick={() => notify.error('Failed', 'Something went wrong.')}>Error</Button>
          <Button variant="secondary" onClick={() => notify.warning('Careful', 'This might be a problem.')}>Warning</Button>
          <Button variant="secondary" onClick={() => notify.info('Heads up', 'Just so you know.')}>Info</Button>
          <Button variant="secondary" onClick={async () => notify.info('Result', (await notify.confirm({ title: 'Continue?', message: 'Are you sure?' })) ? 'Confirmed' : 'Cancelled')}>Confirm</Button>
          <Button variant="secondary" onClick={() => { notify.info('First in queue'); notify.warning('Second in queue'); notify.success('Third in queue'); }}>Queue of 3</Button>
        </Row>
      </Section>
    </Container>
  );
}
