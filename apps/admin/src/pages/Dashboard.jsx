import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { ChefHat, FileUp, ImageOff, MapPin, Plus, Sparkles, Star, UtensilsCrossed, Users, CheckCircle2 } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '@rrb/ui';
import { api, imgUrl } from '../lib/api.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m) => { const [y, mo] = String(m).split('-'); return `${MONTHS[Number(mo) - 1] || mo} ${String(y).slice(2)}`; };

const CARDS = [
  { key: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed, to: '/restaurants' },
  { key: 'activeRestaurants', label: 'Active', icon: CheckCircle2, to: '/restaurants' },
  { key: 'featuredRestaurants', label: 'Featured', icon: Star, to: '/restaurants' },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'cities', label: 'Cities', icon: MapPin, to: '/cities' },
  { key: 'cuisines', label: 'Cuisines', icon: ChefHat, to: '/cuisines' },
  { key: 'amenities', label: 'Amenities', icon: Sparkles, to: '/amenities' },
];

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface-overlay px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-text-muted">{payload[0].value} restaurant{payload[0].value === 1 ? '' : 's'} added</p>
    </div>
  );
}

export default function Dashboard() {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: async () => (await api.get('/admin/stats')).data });
  const d = q.data;
  const series = (d?.restaurantsPerMonth || []).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const hasSeries = series.some((s) => s.count > 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live look at the catalog."
        actions={
          <>
            <Button as={Link} to="/restaurants/import" variant="secondary" leftIcon={<FileUp className="h-4 w-4" />}>Bulk import</Button>
            <Button as={Link} to="/restaurants/new" leftIcon={<Plus className="h-4 w-4" />}>Add restaurant</Button>
          </>
        }
      />
      {q.isError ? (
        <Card><ErrorState description={q.error.message} onRetry={q.refetch} /></Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {CARDS.map((c) => {
              const I = c.icon;
              if (q.isLoading) return <Card key={c.key} className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-3 h-8 w-12" /></Card>;
              const card = <StatCard label={c.label} value={d.counts?.[c.key] ?? 0} icon={<I />} className={c.to ? 'transition-colors hover:border-border-strong' : ''} />;
              return c.to ? <Link key={c.key} to={c.to} aria-label={`${c.label}: ${d.counts?.[c.key] ?? 0}`}>{card}</Link> : <div key={c.key}>{card}</div>;
            })}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <Card.Header><Card.Title>Restaurants added per month</Card.Title><p className="text-sm text-text-muted">Last 12 months</p></Card.Header>
              <Card.Body>
                {q.isLoading ? <Skeleton className="h-64 w-full" /> : !hasSeries ? (
                  <EmptyState title="No restaurants added in the last 12 months" description="Add a restaurant and it will show up here." className="!py-10" />
                ) : (
                  <div className="h-64 w-full" role="img" aria-label="Bar chart of restaurants added per month">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--text-muted))', fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--text-muted))', fontSize: 12 }} />
                        <RTooltip content={<ChartTip />} cursor={{ fill: 'rgb(var(--text) / 0.06)' }} />
                        <Bar dataKey="count" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header><Card.Title>Recently added</Card.Title></Card.Header>
              {q.isLoading ? (
                <div className="flex flex-col gap-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !d.recentRestaurants?.length ? (
                <EmptyState title="No restaurants yet" className="!py-10" action={<Button as={Link} to="/restaurants/new" size="sm">Add the first one</Button>} />
              ) : (
                <ul className="divide-y divide-border">
                  {d.recentRestaurants.map((r) => (
                    <li key={r._id}>
                      <Link to={`/restaurants/${r._id}/edit`} className="flex items-center gap-3 px-5 py-3 hover:bg-text/[0.04]">
                        {r.coverImage?.url ? <img src={imgUrl(r.coverImage.url)} alt="" className="h-10 w-10 rounded-md border border-border object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-text-muted"><ImageOff className="h-4 w-4" /></span>}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString()}</span></span>
                        {!r.isActive ? <Badge>Inactive</Badge> : r.isFeatured ? <Badge variant="primary">Featured</Badge> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <Card.Header><Card.Title>Newest users</Card.Title></Card.Header>
            {q.isLoading ? (
              <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !d.recentUsers?.length ? (
              <EmptyState title="No users yet" className="!py-10" />
            ) : (
              <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">
                {d.recentUsers.map((u) => (
                  <li key={u._id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={u.fullName || u.username} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.fullName || u.username}</span><span className="block truncate text-xs text-text-muted">{u.email}</span></span>
                    <Badge variant={u.role === 'admin' ? 'primary' : 'neutral'}>{u.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
