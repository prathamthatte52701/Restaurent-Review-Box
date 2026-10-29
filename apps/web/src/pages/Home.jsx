import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, PenLine, Search, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, Container, StarRating } from '@rrb/ui';

const STEPS = [
  { icon: Search, title: 'Find', text: 'Search by dish, area or mood and see what Indore is really eating.' },
  { icon: PenLine, title: 'Review', text: 'Rate the food, the room and the value in a minute, with photos.' },
  { icon: ShieldCheck, title: 'Trust', text: 'Every review comes from a verified account. Owners can reply, never edit.' },
];

export default function Home() {
  return (
    <>
      <section className="overflow-x-clip border-b border-border">
        <Container size="xl" className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <Badge variant="primary" dot>Indore, Madhya Pradesh</Badge>
            <h1 className="mt-6 font-display text-display-lg text-text sm:text-display-xl lg:text-display-2xl">
              Find the table <span className="italic text-primary">worth</span> the wait.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-text-muted">
              Honest, recent reviews from people who actually went. From Sarafa's midnight stalls to Vijay Nagar dining rooms.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to="/restaurants" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Browse restaurants</Button>
              <Button as={Link} to="/signup" size="lg" variant="outline">Write a review</Button>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:max-w-none">
            <Card className="relative z-10 p-6 pb-24 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-medium">Chappan Dukan Chaat</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted"><MapPin className="h-3.5 w-3.5" />56 Dukan, Old Palasia</p>
                </div>
                <span className="rounded-md bg-primary px-2.5 py-1 font-display text-lg text-primary-fg tabular-nums">4.6</span>
              </div>
              <div className="mt-4 flex items-center gap-2"><StarRating value={4.5} readOnly size={16} /><span className="text-xs text-text-muted">1,284 reviews</span></div>
              <p className="mt-4 border-t border-border pt-4 text-sm text-text">"Get the raj kachori first. Queue moves faster than it looks."</p>
            </Card>
            <Card className="absolute -bottom-6 -left-4 z-20 hidden w-56 p-4 shadow-md sm:block">
              <p className="text-xs text-text-muted">Today's pick</p>
              <p className="mt-1 font-display text-base font-medium">Sarafa Night Market</p>
              <Badge variant="success" className="mt-2">Open now</Badge>
            </Card>
            <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full border border-primary/25" />
          </div>
        </Container>
      </section>
      <section>
        <Container size="xl" className="py-16">
          <p className="text-eyebrow uppercase text-primary">How it works</p>
          <h2 className="mt-3 max-w-xl font-display text-display-md">A review site that remembers it's about dinner.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.title} className="p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary"><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-display text-xl font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{s.text}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
