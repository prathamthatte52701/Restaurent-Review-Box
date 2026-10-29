import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button, Card, ErrorState, PageHeader, Skeleton, notify, cn } from '@rrb/ui';
import { api } from '../../../lib/api.js';
import { useUnsavedGuard } from '../../../lib/useUnsavedGuard.js';
import { emptyValues, fromServer, schema, STEPS, toPayload } from '../../../lib/restaurantForm.js';
import { StepBasics, StepLinks, StepLocation, StepTags, StepTimings } from './Steps.jsx';
import MediaStep from './MediaStep.jsx';

/*
 * Flow: a restaurant needs an id before images can be uploaded (Step 5), so:
 *  - New: steps 1-4 live in the react-hook-form state and are mirrored to sessionStorage (draft survives reload).
 *    Moving 4 -> 5 validates steps 1-4 and POSTs the restaurant, then redirects to /restaurants/:id/edit?step=5 (draft cleared).
 *  - Edit (and new after creation): every "Next" validates the step and PATCHes the full payload, so progress is saved.
 *  - Step 6 "Save" validates everything, PATCHes and returns to the list.
 */
const DRAFT_KEY = 'rrb-admin-restaurant-draft';
const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || null; } catch { return null; } };
const writeDraft = (d) => { try { d ? sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ } };

const PANELS = [StepBasics, StepLocation, StepTimings, StepTags, null, StepLinks];
const TITLES = ['Basic details', 'Location', 'Opening hours', 'Cuisines and amenities', 'Images', 'Links'];

export default function RestaurantForm() {
  const { id } = useParams();
  return <FormLoader key={id || 'new'} id={id} />;
}

function FormLoader({ id }) {
  const q = useQuery({
    queryKey: ['restaurant', id],
    queryFn: async () => (await api.get(`/restaurants/${id}`)).data,
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  if (id && q.isLoading) return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (id && q.isError) {
    return (
      <Card><ErrorState title={q.error.status === 404 ? 'Restaurant not found' : 'Could not load restaurant'} description={q.error.message} onRetry={q.error.status === 404 ? undefined : q.refetch} />
        <div className="flex justify-center pb-8"><Button as={Link} to="/restaurants" variant="secondary">Back to restaurants</Button></div></Card>
    );
  }
  return <Wizard id={id} server={q.data} />;
}

function Wizard({ id: routeId, server }) {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const draft = useRef(routeId ? null : readDraft()).current;
  const initialStep = (() => {
    const s = Number(new URLSearchParams(loc.search).get('step')) - 1;
    if (routeId && s >= 0 && s < STEPS.length) return s;
    return routeId ? 0 : Math.min(draft?.step ?? 0, 3);
  })();
  const [step, setStep] = useState(initialStep);
  const [id, setId] = useState(routeId);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(routeId);

  const methods = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: server ? fromServer(server) : { ...emptyValues(), ...(draft?.values || {}) },
  });
  const { trigger, getValues, setError, watch, reset, formState: { errors, isDirty } } = methods;
  const allowLeave = useUnsavedGuard(isDirty);

  useEffect(() => {
    if (editing) return undefined;
    const sub = watch((values) => writeDraft({ values, step }));
    return () => sub.unsubscribe();
  }, [watch, editing, step]);
  useEffect(() => { if (!editing) writeDraft({ values: getValues(), step }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const headRef = useRef(null);
  useEffect(() => { headRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); }, [step]);

  const applyServerErrors = (e) => {
    if (e.errors && typeof e.errors === 'object') {
      for (const [k, m] of Object.entries(e.errors)) {
        const path = k.startsWith('location') ? 'lat' : k;
        try { setError(path, { message: String(m) }); } catch { /* unknown path */ }
      }
    }
    notify.error({ title: 'Could not save restaurant', message: e.message });
  };

  const save = async () => {
    const body = toPayload(getValues());
    if (id) return (await api.patch(`/restaurants/${id}`, body)).data;
    return (await api.post('/restaurants', body)).data;
  };

  const go = (n) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  const next = async () => {
    const ok = await trigger(STEPS[step].fields, { shouldFocus: true });
    if (!ok) return;
    // steps 1-4 must all be valid before the record exists
    if (step === 3 && !id) {
      if (!(await trigger(STEPS.slice(0, 4).flatMap((s) => s.fields), { shouldFocus: true }))) return;
    }
    if (step < 4) {
      if (id || step === 3) {
        setSaving(true);
        try {
          const doc = await save();
          qc.invalidateQueries({ queryKey: ['restaurants'] });
          qc.invalidateQueries({ queryKey: ['restaurant', doc._id] });
          if (!id) {
            writeDraft(null);
            allowLeave();
            nav(`/restaurants/${doc._id}/edit?step=5`, { replace: true, state: { created: true } });
            return;
          }
          reset(getValues()); // saved: current values become the new baseline (not dirty)
        } catch (e) {
          applyServerErrors(e);
          return;
        } finally {
          setSaving(false);
        }
      }
    }
    go(step + 1);
  };

  const finish = async () => {
    const valid = await trigger(undefined, { shouldFocus: true });
    if (!valid) {
      const bad = STEPS.findIndex((s) => s.fields.some((f) => f.split('.').reduce((o, k) => o?.[k], methods.formState.errors)));
      if (bad >= 0) go(bad);
      notify.error({ title: 'Some details need attention', message: 'Fix the highlighted fields before saving.' });
      return;
    }
    setSaving(true);
    try {
      await save();
      qc.invalidateQueries({ queryKey: ['restaurants'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.removeQueries({ queryKey: ['restaurant', id] });
      writeDraft(null);
      reset(getValues());
      allowLeave();
      await notify.success('Restaurant saved', `"${getValues('name')}" is up to date.`);
      nav('/restaurants');
    } catch (e) {
      applyServerErrors(e);
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    if (!(await notify.confirm({ title: 'Discard draft?', message: 'All entered details will be cleared.', confirmLabel: 'Discard', danger: true }))) return;
    writeDraft(null);
    methods.reset(emptyValues());
    setStep(0);
  };

  const Panel = PANELS[step];
  const errorSteps = new Set(STEPS.map((s, i) => (s.fields.some((f) => f.split('.').reduce((o, k) => o?.[k], errors)) ? i : -1)));
  const name = getValues('name');
  const last = step === STEPS.length - 1;

  return (
    <FormProvider {...methods}>
      <div ref={headRef} />
      <PageHeader
        breadcrumb={<Link to="/restaurants" className="inline-flex items-center gap-1 hover:text-text"><ArrowLeft className="h-4 w-4" />Restaurants</Link>}
        title={editing || id ? `Edit ${name || 'restaurant'}` : 'New restaurant'}
        description={id ? 'Changes are saved as you move between steps.' : 'Complete the first four steps to create the listing, then add images.'}
        actions={!editing && !id ? <Button variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={discard}>Discard draft</Button> : null}
      />

      <ol className="mb-6 grid grid-cols-6 gap-1 sm:gap-2" aria-label="Progress">
        {STEPS.map((s, i) => {
          const done = i < step || (id && i !== step);
          const reachable = i < step || (Boolean(id) && editing);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable && i !== step}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => go(i)}
                className={cn('flex w-full flex-col items-center gap-1.5 rounded-md px-1 py-1.5 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm',
                  i === step ? 'text-text' : 'text-text-muted', reachable && i !== step && 'hover:bg-text/[0.06]', !reachable && i !== step && 'cursor-not-allowed opacity-60')}
              >
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs',
                  errorSteps.has(i) ? 'border-danger bg-danger-soft text-danger' : i === step ? 'border-primary bg-primary text-primary-fg' : done ? 'border-primary/40 bg-primary-soft text-primary' : 'border-border-strong')}>
                  {done && i !== step && !errorSteps.has(i) ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn('truncate', i === step ? 'block' : 'hidden sm:block')}>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <Card.Header><Card.Title as="h2">{`Step ${step + 1} of ${STEPS.length}: ${TITLES[step]}`}</Card.Title></Card.Header>
        <Card.Body>
          {loc.state?.created && step === 4 ? (
            <p role="status" className="mb-5 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">Restaurant created. Add a cover image and gallery photos, then continue.</p>
          ) : null}
          <form noValidate onSubmit={(e) => { e.preventDefault(); last ? finish() : next(); }}>
            {Panel ? <Panel /> : <MediaStep id={id} />}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          </form>
        </Card.Body>
        <Card.Footer className="justify-between">
          <Button type="button" variant="ghost" leftIcon={<ChevronLeft className="h-4 w-4" />} disabled={step === 0 || saving} onClick={() => go(step - 1)}>Back</Button>
          {last ? (
            <Button type="button" loading={saving} leftIcon={<Check className="h-4 w-4" />} onClick={finish}>Save restaurant</Button>
          ) : (
            <Button type="button" loading={saving} rightIcon={<ChevronRight className="h-4 w-4" />} onClick={next}>{step === 3 && !id ? 'Create and continue' : 'Next'}</Button>
          )}
        </Card.Footer>
      </Card>
    </FormProvider>
  );
}
