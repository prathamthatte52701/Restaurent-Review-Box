import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, EmptyState } from '@rrb/ui';

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={<Compass className="h-5 w-5" />}
        title="404: this page is not on the menu"
        description="The page you are looking for does not exist or has moved."
        action={<Button as={Link} to="/">Back to dashboard</Button>}
      />
    </div>
  );
}
