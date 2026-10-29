import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, XCircle, HelpCircle } from 'lucide-react';
import { cn } from './utils.js';
import { Button } from './components/Button.jsx';
import { Modal } from './components/Overlay.jsx';

let seq = 0;

/** Queue store. Items pushed before <NotificationProvider> mounts simply wait. */
export const notifyStore = create((set) => ({
  queue: [],
  push: (item) => set((s) => ({ queue: [...s.queue, item] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

const textOf = (v) => {
  if (v == null) return undefined;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v.message === 'string') return v.message;
  return undefined;
};

function enqueue(type, a, b) {
  const o = a && typeof a === 'object' && !(a instanceof Error) && !Array.isArray(a) ? a : { title: a, message: b };
  const defaults = { success: 'Success', error: 'Something went wrong', warning: 'Heads up', info: 'Notice', confirm: 'Are you sure?' };
  return new Promise((resolve) => {
    notifyStore.getState().push({
      id: ++seq,
      type,
      title: textOf(o.title) || defaults[type],
      message: textOf(o.message) ?? (a instanceof Error ? a.message : undefined),
      confirmLabel: textOf(o.confirmLabel) || (type === 'confirm' ? 'Confirm' : 'OK'),
      cancelLabel: textOf(o.cancelLabel) || 'Cancel',
      danger: Boolean(o.danger),
      resolve,
    });
  });
}

/**
 * Imperative notification API (modal based, queued one-at-a-time). Safe to import anywhere,
 * e.g. an axios interceptor: `import { notify } from '@rrb/ui'`.
 *   notify.success('Saved', 'Restaurant updated')      -> Promise<void>
 *   notify.error({ title, message, confirmLabel })
 *   notify.confirm({ title, message, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 */
export const notify = {
  success: (a, b) => enqueue('success', a, b).then(() => undefined),
  error: (a, b) => enqueue('error', a, b).then(() => undefined),
  warning: (a, b) => enqueue('warning', a, b).then(() => undefined),
  info: (a, b) => enqueue('info', a, b).then(() => undefined),
  confirm: (a, b) => enqueue('confirm', typeof a === 'string' ? { title: a, message: b } : a, b).then(Boolean),
};

export const useNotify = () => notify;

const tone = {
  success: { Icon: CheckCircle2, cls: 'bg-success-soft text-success' },
  error: { Icon: XCircle, cls: 'bg-danger-soft text-danger' },
  warning: { Icon: AlertTriangle, cls: 'bg-warning-soft text-warning' },
  info: { Icon: Info, cls: 'bg-primary-soft text-primary' },
  confirm: { Icon: HelpCircle, cls: 'bg-primary-soft text-primary' },
};

/** Mount once near the app root. Renders the head of the queue as a centered modal. */
export function NotificationProvider({ children }) {
  const current = notifyStore((s) => s.queue[0]);
  const done = (result) => {
    if (!current) return;
    current.resolve(result);
    notifyStore.getState().shift();
  };
  const isConfirm = current?.type === 'confirm';
  const t = tone[current?.type] || tone.info;
  return (
    <>
      {children}
      {current ? (
        <Modal key={current.id} open size="sm" onOpenChange={(o) => { if (!o) done(false); }}>
          <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
            <span className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full', current.danger ? 'bg-danger-soft text-danger' : t.cls)}>
              <t.Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <Modal.Title className="font-display text-xl font-medium tracking-tight">{current.title}</Modal.Title>
            {current.message ? <Modal.Description className="mt-2 text-sm text-text-muted">{current.message}</Modal.Description> : null}
          </div>
          <Modal.Footer className="border-t-0 bg-transparent pt-4">
            {isConfirm ? <Button variant="ghost" onClick={() => done(false)}>{current.cancelLabel}</Button> : null}
            <Button variant={current.danger || current.type === 'error' ? 'danger' : 'primary'} onClick={() => done(true)} className={isConfirm ? '' : 'sm:min-w-24'}>
              {current.confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal>
      ) : null}
    </>
  );
}
