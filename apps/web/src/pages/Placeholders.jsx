import { Link } from 'react-router-dom';
import { Compass, Home, UserRound, UtensilsCrossed } from 'lucide-react';
import { Button, Container, EmptyState, PageHeader } from '@rrb/ui';
import { useAuth } from '../store/auth.js';

export function Restaurants() {
  return (
    <Container size="xl" className="py-10">
      <PageHeader eyebrow="Discover" title="Restaurants" description="Search and filters are coming in the next release." />
      <EmptyState
        className="rounded-lg border border-dashed border-border-strong"
        icon={<UtensilsCrossed className="h-5 w-5" />}
        title="The restaurant directory is being plated"
        description="We're finishing the listings. Come back soon, or create an account to be first in line."
        action={<Button as={Link} to="/signup">Create account</Button>}
      />
    </Container>
  );
}

export function Profile() {
  const user = useAuth((s) => s.user);
  return (
    <Container size="md" className="py-10">
      <PageHeader eyebrow="Account" title={user?.fullName || 'Your profile'} description={user?.email} />
      <EmptyState
        className="rounded-lg border border-dashed border-border-strong"
        icon={<UserRound className="h-5 w-5" />}
        title="Profile editing is coming soon"
        description="You'll be able to update your photo, bio and review history here."
        action={<Button as={Link} to="/change-password" variant="secondary">Change password</Button>}
      />
    </Container>
  );
}

export function NotFound() {
  return (
    <Container size="md" className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-[7rem] font-medium leading-none tracking-tighter text-primary sm:text-[10rem]" aria-hidden="true">404</p>
      <h1 className="mt-4 font-display text-display-md">This table isn't on the menu</h1>
      <p className="mt-3 max-w-md text-base text-text-muted">The page you're after has moved, or never existed. Let's get you back to something delicious.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button as={Link} to="/" size="lg" leftIcon={<Home className="h-4 w-4" />}>Back home</Button>
        <Button as={Link} to="/restaurants" size="lg" variant="outline" leftIcon={<Compass className="h-4 w-4" />}>Browse restaurants</Button>
      </div>
    </Container>
  );
}
