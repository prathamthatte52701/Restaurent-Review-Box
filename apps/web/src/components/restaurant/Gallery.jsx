import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { Modal, cn } from '@rrb/ui';
import { Cover } from './RestaurantCard.jsx';

function Lightbox({ images, index, onIndex, onClose, name }) {
  const n = images.length;
  const go = useCallback((d) => onIndex((i) => (i + d + n) % n), [n, onIndex]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  const img = images[index];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} size="full" label={`${name} photo gallery`} className="inset-0 !max-h-none rounded-none border-0 bg-scrim/95" overlayClassName="bg-scrim/90">
      <div className="relative flex h-dvh w-full items-center justify-center p-4 sm:p-10" role="group" aria-roledescription="carousel" aria-label={`${name} photos`}>
        <img src={img.url} alt={img.caption || `${name} photo ${index + 1} of ${n}`} className="max-h-full max-w-full rounded-md object-contain" />
        <button type="button" onClick={onClose} aria-label="Close gallery" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:shadow-ring focus-visible:outline-none"><X className="h-5 w-5" /></button>
        {n > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:shadow-ring focus-visible:outline-none"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:shadow-ring focus-visible:outline-none"><ChevronRight className="h-6 w-6" /></button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums text-white" aria-live="polite">{index + 1} / {n}</p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/** Cover + gallery. No images at all -> a typographic placeholder of the same size, so the page never collapses. */
export function Gallery({ cover, gallery = [], name }) {
  const images = [cover?.url ? { url: cover.url, caption: '' } : null, ...gallery.filter((g) => g?.url)].filter(Boolean);
  const [open, setOpen] = useState(null);
  if (!images.length) {
    return <div className="aspect-[16/7] max-h-56 overflow-hidden rounded-xl border border-border sm:aspect-[16/5]"><Cover name={name} className="text-6xl" /></div>;
  }
  const side = images.slice(1, 3);
  const openAt = (i) => () => setOpen(i);
  const tile = 'group relative block h-full w-full overflow-hidden focus-visible:shadow-ring focus-visible:outline-none';
  return (
    <>
      <div className={cn('grid gap-2 overflow-hidden rounded-xl border border-border', side.length ? 'sm:grid-cols-[2fr_1fr] sm:grid-rows-2' : '', 'aspect-[16/9] sm:aspect-[16/7]')}>
        <button type="button" onClick={openAt(0)} aria-label={`Open photo 1 of ${images.length}`} className={cn(tile, side.length && 'sm:row-span-2')}>
          <img src={images[0].url} alt={`${name} cover`} className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-[1.02]" />
        </button>
        {side.map((g, i) => (
          <button key={g.url} type="button" onClick={openAt(i + 1)} aria-label={`Open photo ${i + 2} of ${images.length}`} className={cn(tile, 'hidden sm:block')}>
            <img src={g.url} alt={g.caption || `${name} photo ${i + 2}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-[1.02]" />
            {i === side.length - 1 && images.length > 3 ? <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-medium text-white"><Images className="mr-1.5 h-4 w-4" />+{images.length - 3} more</span> : null}
          </button>
        ))}
      </div>
      {open !== null ? <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} name={name} /> : null}
    </>
  );
}
