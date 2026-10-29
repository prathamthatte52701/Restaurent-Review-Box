import { lazy, Suspense, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Copy, MapPinned, Moon } from 'lucide-react';
import { Button, FormField, Input, Select, Skeleton, Switch, Textarea } from '@rrb/ui';
import { CATEGORIES, TYPES } from '../../../lib/constants.js';
import { parseMapsUrl } from '../../../lib/mapsUrl.js';
import { useMasters } from '../../../lib/useMasters.js';
import { MultiSelect } from '../../../components/MultiSelect.jsx';

const MapPicker = lazy(() => import('./MapPicker.jsx'));
const grid = 'grid gap-4 sm:grid-cols-2';
const pick = (o) => [{ value: '', label: 'Select' }, ...o];

export function StepBasics() {
  const { register, formState: { errors: e } } = useFormContext();
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Restaurant name" required error={e.name?.message}><Input autoComplete="off" {...register('name')} /></FormField>
      <FormField label="Description" hint="Shown on the public listing. Up to 3000 characters." error={e.description?.message}><Textarea rows={5} {...register('description')} /></FormField>
      <div className={grid}>
        <FormField label="Category" required error={e.category?.message}><Select options={pick(CATEGORIES)} {...register('category')} /></FormField>
        <FormField label="Type" required error={e.type?.message}><Select options={pick(TYPES)} {...register('type')} /></FormField>
        <FormField label="Established year" error={e.establishedYear?.message}><Input inputMode="numeric" placeholder="e.g. 1998" {...register('establishedYear')} /></FormField>
        <FormField label="Price for two (INR)" required hint="Used to derive the cost bracket automatically." error={e.priceForTwo?.message}><Input inputMode="decimal" placeholder="e.g. 600" {...register('priceForTwo')} /></FormField>
        <FormField label="Owner name" error={e.ownerName?.message}><Input {...register('ownerName')} /></FormField>
        <FormField label="Contact phone" error={e.contactPhone?.message}><Input type="tel" {...register('contactPhone')} /></FormField>
        <FormField label="Contact email" error={e.contactEmail?.message} className="sm:col-span-2"><Input type="email" {...register('contactEmail')} /></FormField>
      </div>
    </div>
  );
}

export function StepLocation() {
  const { register, control, setValue, formState: { errors: e } } = useFormContext();
  const cities = useMasters('cities');
  const [lat, lng] = useWatch({ control, name: ['lat', 'lng'] });
  const [url, setUrl] = useState('');
  const [urlErr, setUrlErr] = useState('');
  const [urlOk, setUrlOk] = useState('');
  const setPos = (a, b) => {
    setValue('lat', String(a), { shouldValidate: true, shouldDirty: true });
    setValue('lng', String(b), { shouldValidate: true, shouldDirty: true });
  };
  const apply = () => {
    setUrlOk('');
    try {
      const p = parseMapsUrl(url);
      setPos(p.lat, p.lng);
      setUrlErr('');
      setUrlOk(`Pin moved to ${p.lat}, ${p.lng}`);
    } catch (err) {
      setUrlErr(err.message);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <div className={grid}>
        <FormField label="Address line 1" required error={e.address?.line1?.message} className="sm:col-span-2"><Input {...register('address.line1')} /></FormField>
        <FormField label="Address line 2" error={e.address?.line2?.message}><Input {...register('address.line2')} /></FormField>
        <FormField label="Area / locality" error={e.address?.area?.message}><Input {...register('address.area')} /></FormField>
        <FormField label="City" required error={e.address?.city?.message || (cities.isError ? cities.error.message : undefined)} hint={cities.isLoading ? 'Loading cities' : undefined}>
          <Select options={pick((cities.data || []).map((c) => ({ value: c._id, label: c.state ? `${c.name}, ${c.state}` : c.name })))} {...register('address.city')} />
        </FormField>
        <FormField label="Pincode" error={e.address?.pincode?.message}><Input inputMode="numeric" maxLength={6} {...register('address.pincode')} /></FormField>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <FormField label="Paste a Google Maps link" hint="Reads coordinates from links like .../@22.7196,75.8577,15z" error={urlErr || undefined}>
          <Input
            value={url}
            onChange={(ev) => { setUrl(ev.target.value); setUrlErr(''); setUrlOk(''); }}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } }}
            placeholder="https://www.google.com/maps/place/.../@22.7196,75.8577,15z"
            rightAdornment={<Button type="button" size="sm" variant="secondary" onClick={apply} leftIcon={<MapPinned className="h-4 w-4" />} className="-mr-2">Use link</Button>}
          />
        </FormField>
        {urlOk ? <p role="status" className="text-xs font-medium text-success">{urlOk}</p> : null}
        <Suspense fallback={<Skeleton className="h-72 w-full sm:h-96" />}>
          <MapPicker lat={parseFloat(lat)} lng={parseFloat(lng)} onPick={setPos} />
        </Suspense>
        <p className="text-xs text-text-muted">Click the map or drag the pin to set the exact location.</p>
        <div className={grid}>
          <FormField label="Latitude" required error={e.lat?.message}><Input inputMode="decimal" {...register('lat')} /></FormField>
          <FormField label="Longitude" required error={e.lng?.message}><Input inputMode="decimal" {...register('lng')} /></FormField>
        </div>
      </div>
    </div>
  );
}

const cap = (d) => d[0].toUpperCase() + d.slice(1);

export function StepTimings() {
  const { register, control, setValue, getValues, formState: { errors: e } } = useFormContext();
  const timings = useWatch({ control, name: 'timings' });
  const copyToAll = (i) => {
    const src = getValues(`timings.${i}`);
    getValues('timings').forEach((_, j) => {
      setValue(`timings.${j}.isClosed`, src.isClosed, { shouldDirty: true });
      setValue(`timings.${j}.openTime`, src.openTime, { shouldDirty: true, shouldValidate: true });
      setValue(`timings.${j}.closeTime`, src.closeTime, { shouldDirty: true, shouldValidate: true });
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">Set opening hours for each day. A closing time earlier than the opening time means the restaurant closes after midnight.</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {timings.map((t, i) => {
          const err = e.timings?.[i];
          const overnight = !t.isClosed && t.openTime && t.closeTime && t.closeTime < t.openTime;
          return (
            <li key={t.day} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-28 text-sm font-medium">{cap(t.day)}</span>
              <Controller control={control} name={`timings.${i}.isClosed`} render={({ field }) => (
                <Switch checked={!field.value} onCheckedChange={(v) => field.onChange(!v)} label={field.value ? 'Closed' : 'Open'} aria-label={cap(t.day) + ' open'} className="w-28" />
              )} />
              {t.isClosed ? <span className="flex-1" /> : (
                <div className="flex flex-1 flex-wrap items-start gap-2">
                  <FormField error={err?.openTime?.message}><Input type="time" aria-label={`${cap(t.day)} opens`} className="w-32" {...register(`timings.${i}.openTime`)} /></FormField>
                  <span className="pt-2 text-text-muted">to</span>
                  <FormField error={err?.closeTime?.message}><Input type="time" aria-label={`${cap(t.day)} closes`} className="w-32" {...register(`timings.${i}.closeTime`)} /></FormField>
                  {overnight ? <span className="inline-flex items-center gap-1 pt-2 text-xs text-text-muted"><Moon className="h-3.5 w-3.5" />closes next day</span> : null}
                </div>
              )}
              <Button type="button" size="sm" variant="ghost" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => copyToAll(i)} aria-label={`Copy ${cap(t.day)} hours to all days`}>Copy to all</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StepTags() {
  const { control } = useFormContext();
  const cuisines = useMasters('cuisines');
  const amenities = useMasters('amenities');
  const block = (name, label, q) => (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-medium">{label}</h3>
      <Controller control={control} name={name} render={({ field }) => (
        <MultiSelect label={label} options={q.data} value={field.value} onChange={field.onChange} loading={q.isLoading} error={q.isError ? q.error : null} onRetry={q.refetch} emptyText={`No ${label.toLowerCase()} exist yet. Create some under ${label}.`} />
      )} />
    </div>
  );
  return <div className="grid gap-8 lg:grid-cols-2">{block('cuisines', 'Cuisines', cuisines)}{block('amenities', 'Amenities', amenities)}</div>;
}

export function StepLinks() {
  const { register, formState: { errors: e } } = useFormContext();
  const f = (name, label, ph) => (
    <FormField label={label} error={e.externalLinks?.[name]?.message}><Input type="url" placeholder={ph} {...register(`externalLinks.${name}`)} /></FormField>
  );
  return (
    <div className={grid}>
      {f('zomatoUrl', 'Zomato', 'https://www.zomato.com/indore/...')}
      {f('swiggyUrl', 'Swiggy', 'https://www.swiggy.com/restaurants/...')}
      {f('mapsUrl', 'Google Maps', 'https://www.google.com/maps/place/...')}
      {f('website', 'Website', 'https://')}
      {f('instagram', 'Instagram', 'https://www.instagram.com/...')}
    </div>
  );
}
