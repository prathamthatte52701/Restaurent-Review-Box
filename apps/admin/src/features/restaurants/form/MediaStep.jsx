import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import { Button, ErrorState, IconButton, Skeleton, notify } from '@rrb/ui';
import { api, imgUrl } from '../../../lib/api.js';

const MAX_GALLERY = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Returns a readable error string or ''. */
export function checkFile(f) {
  if (!OK_TYPES.includes(f.type)) return `"${f.name}" is not a supported image. Use JPEG, PNG or WebP.`;
  if (f.size > MAX_BYTES) return `"${f.name}" is ${(f.size / 1048576).toFixed(1)} MB. The limit is 5 MB per image.`;
  if (f.size === 0) return `"${f.name}" is empty.`;
  return '';
}

const upload = (url, method, fd, onProgress) =>
  api.request({ url, method, data: fd, timeout: 120000, onUploadProgress: (ev) => ev.total && onProgress(Math.round((ev.loaded / ev.total) * 100)) });

function Progress({ value }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full bg-primary transition-[width] duration-base" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function MediaStep({ id }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['restaurant', id], queryFn: async () => (await api.get(`/restaurants/${id}`)).data });
  const [jobs, setJobs] = useState([]); // {key,name,progress,error,file,kind}
  const [order, setOrder] = useState([]);
  const dragId = useRef(null);
  const [over, setOver] = useState(null);
  const coverIn = useRef(null);
  const galleryIn = useRef(null);
  const seq = useRef(0);

  const gallery = q.data?.gallery || [];
  useEffect(() => { setOrder(gallery.map((g) => g._id)); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(gallery.map((g) => [g._id, g]));
  const ordered = order.map((o) => byId.get(o)).filter(Boolean);
  const refresh = () => qc.invalidateQueries({ queryKey: ['restaurant', id] });
  const patchJob = (key, p) => setJobs((j) => j.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const run = async (job) => {
    patchJob(job.key, { progress: 0, error: '' });
    try {
      const fd = new FormData();
      if (job.kind === 'cover') {
        fd.append('image', job.file);
        await upload(`/restaurants/${id}/cover`, 'patch', fd, (p) => patchJob(job.key, { progress: p }));
      } else {
        fd.append('images', job.file);
        await upload(`/restaurants/${id}/gallery`, 'post', fd, (p) => patchJob(job.key, { progress: p }));
      }
      setJobs((j) => j.filter((x) => x.key !== job.key));
      await refresh();
    } catch (e) {
      patchJob(job.key, { error: e.network ? `${e.message} Retry once the server is back.` : e.message, progress: 0 });
    }
  };

  const start = (files, kind) => {
    const list = Array.from(files);
    const errs = [];
    const good = [];
    let room = MAX_GALLERY - gallery.length - jobs.filter((j) => j.kind === 'gallery' && !j.error).length;
    for (const f of list) {
      const m = checkFile(f);
      if (m) errs.push(m);
      else if (kind === 'gallery' && good.length >= room) errs.push(`"${f.name}" skipped: the gallery is limited to ${MAX_GALLERY} images.`);
      else good.push(f);
    }
    if (errs.length) notify.error({ title: 'Some files were not added', message: errs.join('\n') });
    const newJobs = (kind === 'cover' ? good.slice(0, 1) : good).map((file) => ({ key: ++seq.current, name: file.name, file, kind, progress: 0, error: '' }));
    setJobs((j) => [...j.filter((x) => !(kind === 'cover' && x.kind === 'cover')), ...newJobs]);
    // gallery uploads run one at a time so per-file progress is meaningful and order is stable
    (async () => { for (const job of newJobs) await run(job); })();
  };

  const removeImage = async (img) => {
    if (!(await notify.confirm({ title: 'Delete image?', message: 'This image will be permanently removed.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/restaurants/${id}/gallery/${img._id}`);
      await refresh();
    } catch (e) {
      notify.error({ title: 'Could not delete image', message: e.message });
    }
  };

  const commitOrder = async (next, prev) => {
    setOrder(next);
    try {
      await api.patch(`/restaurants/${id}/gallery/reorder`, { order: next });
      refresh();
    } catch (e) {
      setOrder(prev);
      notify.error({ title: 'Could not reorder images', message: e.message });
    }
  };
  const move = (from, to) => {
    if (from === to || from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commitOrder(next, order);
  };

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <ErrorState description={q.error.message} onRetry={q.refetch} />;

  const cover = q.data?.coverImage?.url;
  const coverJob = jobs.find((j) => j.kind === 'cover');
  const galJobs = jobs.filter((j) => j.kind === 'gallery');
  const full = gallery.length + galJobs.filter((j) => !j.error).length >= MAX_GALLERY;

  const jobRow = (j) => (
    <li key={j.key} className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{j.name}</span>
        {j.error ? (
          <span className="flex shrink-0 gap-1">
            <Button type="button" size="sm" variant="secondary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => run(j)}>Retry</Button>
            <IconButton type="button" size="sm" aria-label={`Dismiss ${j.name}`} icon={<X className="h-4 w-4" />} onClick={() => setJobs((x) => x.filter((y) => y.key !== j.key))} />
          </span>
        ) : <span className="shrink-0 tabular-nums text-text-muted">{j.progress}%</span>}
      </div>
      {j.error ? <p role="alert" className="text-xs font-medium text-danger">{j.error}</p> : <Progress value={j.progress} />}
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="cover-h" className="flex flex-col gap-3">
        <h3 id="cover-h" className="font-display text-lg font-medium">Cover image</h3>
        <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface text-text-muted">
            {cover ? <img src={imgUrl(cover)} alt="Cover preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8" aria-hidden="true" />}
          </div>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-muted">Shown first on listings. JPEG, PNG or WebP up to 5 MB.</p>
            <input ref={coverIn} type="file" accept={OK_TYPES.join(',')} className="sr-only" aria-label="Choose cover image" data-testid="cover-input"
              onChange={(e) => { if (e.target.files?.length) start(e.target.files, 'cover'); e.target.value = ''; }} />
            <Button type="button" variant="secondary" leftIcon={<ImagePlus className="h-4 w-4" />} onClick={() => coverIn.current?.click()} loading={Boolean(coverJob && !coverJob.error)}>
              {cover ? 'Replace cover' : 'Upload cover'}
            </Button>
            {coverJob ? <ul className="w-full">{jobRow(coverJob)}</ul> : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="gal-h" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id="gal-h" className="font-display text-lg font-medium">Gallery</h3>
            <p className="text-sm text-text-muted">{gallery.length} of {MAX_GALLERY} images. Drag to reorder.</p>
          </div>
          <input ref={galleryIn} type="file" multiple accept={OK_TYPES.join(',')} className="sr-only" aria-label="Choose gallery images" data-testid="gallery-input"
            onChange={(e) => { if (e.target.files?.length) start(e.target.files, 'gallery'); e.target.value = ''; }} />
          <Button type="button" variant="secondary" disabled={full} leftIcon={<ImagePlus className="h-4 w-4" />} onClick={() => galleryIn.current?.click()}>Add images</Button>
        </div>
        {ordered.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Gallery images">
            {ordered.map((g, i) => (
              <li
                key={g._id}
                draggable
                onDragStart={(e) => { dragId.current = g._id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g._id); }}
                onDragOver={(e) => { e.preventDefault(); setOver(g._id); }}
                onDragLeave={() => setOver(null)}
                onDragEnd={() => { dragId.current = null; setOver(null); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); move(order.indexOf(dragId.current), i); dragId.current = null; }}
                data-testid="gallery-item"
                className={`group relative overflow-hidden rounded-lg border bg-surface ${over === g._id ? 'border-primary shadow-ring' : 'border-border'}`}
              >
                <img src={imgUrl(g.url)} alt={`Gallery image ${i + 1}`} draggable={false} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-scrim/70 px-1.5 py-0.5 text-xs text-white"><GripVertical className="h-3.5 w-3.5" />{i + 1}</span>
                <div className="flex items-center justify-between gap-1 border-t border-border bg-surface-raised p-1">
                  <span className="flex">
                    <IconButton type="button" size="sm" aria-label={`Move image ${i + 1} earlier`} disabled={i === 0} icon={<ArrowLeft className="h-4 w-4" />} onClick={() => move(i, i - 1)} />
                    <IconButton type="button" size="sm" aria-label={`Move image ${i + 1} later`} disabled={i === ordered.length - 1} icon={<ArrowRight className="h-4 w-4" />} onClick={() => move(i, i + 1)} />
                  </span>
                  <IconButton type="button" size="sm" aria-label={`Delete image ${i + 1}`} icon={<Trash2 className="h-4 w-4 text-danger" />} onClick={() => removeImage(g)} />
                </div>
              </li>
            ))}
          </ul>
        ) : !galJobs.length ? <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">No gallery images yet.</p> : null}
        {galJobs.length ? <ul className="flex flex-col gap-2" aria-label="Uploads">{galJobs.map(jobRow)}</ul> : null}
      </section>
    </div>
  );
}
