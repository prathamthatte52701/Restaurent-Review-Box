import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, MapPin, ChefHat, Sparkles, MessageSquareText, Users,
  PanelLeftClose, PanelLeftOpen, Menu, LogOut, ChevronDown,
} from 'lucide-react';
import { Avatar, Badge, BrandMark, DropdownMenu, IconButton, Sheet, ThemeToggle, Tooltip, cn, useMediaQuery } from '@rrb/ui';
import { useAuth } from '../stores/auth.js';

const NAV = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Catalog',
    items: [
      { to: '/restaurants', label: 'Restaurants', icon: UtensilsCrossed },
      { to: '/cities', label: 'Cities', icon: MapPin },
      { to: '/cuisines', label: 'Cuisines', icon: ChefHat },
      { to: '/amenities', label: 'Amenities', icon: Sparkles },
    ],
  },
  {
    title: 'Community',
    items: [
      { to: '/reviews', label: 'Reviews', icon: MessageSquareText, soon: true },
      { to: '/users', label: 'Users', icon: Users, soon: true },
    ],
  },
];

const TITLES = [
  ['/restaurants/new', 'New restaurant'], ['/restaurants/import', 'Bulk import'], ['/edit', 'Edit restaurant'],
  ['/restaurants', 'Restaurants'], ['/cities', 'Cities'], ['/cuisines', 'Cuisines'], ['/amenities', 'Amenities'],
];
const titleFor = (p) => (p === '/' ? 'Dashboard' : TITLES.find(([k]) => p.includes(k))?.[1] || 'Not found');

const LS = 'rrb-admin-sidebar';
const readCollapsed = () => { try { return localStorage.getItem(LS) === '1'; } catch { return false; } };

function NavItems({ collapsed, onNavigate }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.title && !collapsed ? <p className="px-2.5 pb-1 text-eyebrow uppercase text-text-muted">{g.title}</p> : null}
          {g.title && collapsed ? <div className="mx-2 my-1 border-t border-border" /> : null}
          {g.items.map((it) => {
            const Icon = it.icon;
            const base = 'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors duration-fast';
            const inner = (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                {collapsed ? <span className="sr-only">{it.label}</span> : <span className="flex-1 truncate">{it.label}</span>}
                {it.soon && !collapsed ? <Badge variant="outline" className="!px-1.5 !py-0 text-[10px]">Soon</Badge> : null}
              </>
            );
            const el = it.soon ? (
              <span aria-disabled="true" className={cn(base, 'cursor-not-allowed text-text-muted/60', collapsed && 'justify-center')}>{inner}</span>
            ) : (
              <NavLink
                to={it.to}
                end={it.end}
                onClick={onNavigate}
                className={({ isActive }) => cn(base, collapsed && 'justify-center', isActive ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-text/[0.06] hover:text-text')}
              >
                {inner}
              </NavLink>
            );
            return collapsed
              ? <Tooltip key={it.to} content={it.soon ? `${it.label} (soon)` : it.label} side="right">{el}</Tooltip>
              : <div key={it.to}>{el}</div>;
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }) {
  return (
    <Link to="/" className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4 font-display text-lg font-medium tracking-tight">
      <BrandMark size={26} />
      {collapsed ? null : <span className="truncate">RRB <span className="text-text-muted">Admin</span></span>}
    </Link>
  );
}

export default function Shell() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => { document.title = `${titleFor(pathname)} | RRB Admin`; }, [pathname]);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(LS, c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  return (
    <div className="min-h-dvh bg-bg text-text">
      {desktop ? (
        <aside className={cn('fixed inset-y-0 left-0 z-sticky flex flex-col border-r border-border bg-surface transition-[width] duration-base ease-standard', collapsed ? 'w-16' : 'w-60')}>
          <Brand collapsed={collapsed} />
          <NavItems collapsed={collapsed} />
          <div className="border-t border-border p-3">
            <button type="button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-text-muted hover:bg-text/[0.06] hover:text-text', collapsed && 'justify-center')}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {collapsed ? null : 'Collapse'}
            </button>
          </div>
        </aside>
      ) : (
        <Sheet open={drawer} onOpenChange={setDrawer} side="left" label="Navigation" className="bg-surface">
          <Brand />
          <NavItems onNavigate={() => setDrawer(false)} />
        </Sheet>
      )}

      <div className={cn('flex min-h-dvh min-w-0 flex-col transition-[padding] duration-base ease-standard', desktop && (collapsed ? 'pl-16' : 'pl-60'))}>
        <header className="sticky top-0 z-sticky flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
          {desktop ? null : <IconButton aria-label="Open navigation" icon={<Menu className="h-5 w-5" />} onClick={() => setDrawer(true)} />}
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-medium tracking-tight">{titleFor(pathname)}</h2>
          <ThemeToggle />
          <DropdownMenu
            label="Account menu"
            trigger={
              <button type="button" aria-label="Account menu" className="flex items-center gap-2 rounded-md p-1 hover:bg-text/[0.06]">
                <Avatar name={user?.fullName || user?.username} size="sm" />
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{user?.fullName || user?.username}</span>
                <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
              </button>
            }
            items={[
              { type: 'label', label: user?.email || '' },
              { type: 'separator' },
              { label: 'Log out', icon: <LogOut />, onSelect: logout },
            ]}
          />
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-7xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
