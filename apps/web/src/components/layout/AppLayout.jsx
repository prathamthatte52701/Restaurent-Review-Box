import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu, ShieldOff, User } from 'lucide-react';
import { Avatar, Button, Container, DropdownMenu, IconButton, Logo, SearchInput, Sheet, ThemeToggle, cn } from '@rrb/ui';
import { useAuth } from '../../store/auth.js';
import { useLogout, useLogoutAll } from '../../hooks/auth.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/restaurants', label: 'Restaurants' },
];

const navCls = ({ isActive }) =>
  cn('rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast', isActive ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-text/[0.06] hover:text-text');

function HeaderSearch({ className }) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q')?.toString().trim();
        navigate(q ? `/restaurants?q=${encodeURIComponent(q)}` : '/restaurants');
      }}
    >
      <SearchInput name="q" placeholder="Search restaurants, dishes, areas" />
    </form>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const logout = useLogout();
  const logoutAll = useLogoutAll();
  const out = () => logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) });
  const outAll = () => logoutAll.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) });
  return (
    <DropdownMenu
      label="Account menu"
      trigger={
        <button type="button" aria-label="Account menu" className="rounded-full focus-visible:shadow-ring focus-visible:outline-none">
          <Avatar name={user?.fullName || user?.username} src={user?.avatar?.url || user?.avatar} size="md" />
        </button>
      }
      items={[
        { type: 'label', label: user?.fullName || user?.username || 'Account' },
        { label: 'Profile', icon: <User />, onSelect: () => navigate('/profile') },
        { label: 'Change password', icon: <KeyRound />, onSelect: () => navigate('/change-password') },
        { type: 'separator' },
        { label: 'Log out', icon: <LogOut />, danger: true, onSelect: out },
        { label: 'Log out of all devices', icon: <ShieldOff />, danger: true, onSelect: outAll },
      ]}
    />
  );
}

function AuthActions({ stacked, onNavigate }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const isHydrating = useAuth((s) => s.isHydrating);
  const location = useLocation();
  if (isHydrating) return <span className="h-10 w-10 rounded-full rrb-skeleton animate-shimmer" aria-hidden="true" />;
  if (isAuthenticated) return stacked ? null : <UserMenu />;
  const next = location.pathname === '/' ? '' : `?next=${encodeURIComponent(location.pathname + location.search)}`;
  return (
    <div className={cn('flex items-center gap-2', stacked && 'flex-col items-stretch')}>
      <Button as={Link} to={`/login${next}`} variant={stacked ? 'secondary' : 'ghost'} onClick={onNavigate}>Log in</Button>
      <Button as={Link} to="/signup" onClick={onNavigate}>Sign up</Button>
    </div>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const logout = useLogout();
  const close = () => setOpen(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      side="left"
      label="Main menu"
      trigger={<IconButton aria-label="Open menu" icon={<Menu className="h-5 w-5" />} className="md:hidden" />}
    >
      <Sheet.Header title={<Logo size="sm" />} />
      <Sheet.Body className="flex flex-col gap-6">
        <HeaderSearch />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} onClick={close} className={navCls}>{n.label}</NavLink>)}
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" onClick={close} className={navCls}>Profile</NavLink>
              <NavLink to="/change-password" onClick={close} className={navCls}>Change password</NavLink>
            </>
          ) : null}
        </nav>
      </Sheet.Body>
      <Sheet.Footer className="sm:flex-col">
        {isAuthenticated ? (
          <>
            <p className="text-sm text-text-muted">Signed in as <span className="font-medium text-text">{user?.fullName || user?.username}</span></p>
            <Button variant="secondary" leftIcon={<LogOut className="h-4 w-4" />} loading={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => { close(); navigate('/', { replace: true }); } })}>Log out</Button>
          </>
        ) : (
          <AuthActions stacked onNavigate={close} />
        )}
      </Sheet.Footer>
    </Sheet>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-sticky border-b border-border bg-bg/90 backdrop-blur-sm">
      <Container size="xl" className="flex h-16 items-center gap-3">
        <MobileMenu />
        <Link to="/" aria-label="Review Box home" className="rounded-md focus-visible:shadow-ring focus-visible:outline-none"><Logo size="md" /></Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={navCls}>{n.label}</NavLink>)}
        </nav>
        <HeaderSearch className="ml-auto hidden w-full max-w-xs lg:block" />
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <ThemeToggle />
          <div className="hidden md:block"><AuthActions /></div>
          <div className="md:hidden"><MobileAvatar /></div>
        </div>
      </Container>
    </header>
  );
}

// on phones the avatar menu stays reachable in the bar; guests use the sheet
function MobileAvatar() {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  return isAuthenticated ? <UserMenu /> : null;
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container size="xl" className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Logo size="sm" />
          <p className="mt-3 text-sm text-text-muted">Honest reviews and discovery for the restaurants of Indore.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <p className="text-eyebrow uppercase text-text-muted">Explore</p>
          <Link to="/restaurants" className="text-text hover:text-primary">Restaurants</Link>
          <Link to="/signup" className="text-text hover:text-primary">Join Review Box</Link>
        </nav>
      </Container>
      <div className="border-t border-border py-4 text-center text-xs text-text-muted">&copy; {new Date().getFullYear()} Restaurant Review Box</div>
    </footer>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg">Skip to content</a>
      <Header />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
