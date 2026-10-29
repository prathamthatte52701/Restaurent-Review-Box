import { forwardRef, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DD from '@radix-ui/react-dropdown-menu';
import * as TT from '@radix-ui/react-tooltip';
import * as PP from '@radix-ui/react-popover';
import * as TB from '@radix-ui/react-tabs';
import { MoreHorizontal, X } from 'lucide-react';
import { cn, asArray, asText } from '../utils.js';
import { Button, IconButton } from './Button.jsx';

/** Radix only restores focus to a <Trigger>; for controlled dialogs remember the opener ourselves. */
function useRestoreFocus() {
  const prev = useRef(null);
  return {
    onOpenAutoFocus: () => { prev.current = document.activeElement; },
    onCloseAutoFocus: (e) => {
      const el = prev.current;
      if (el && el !== document.body && el.isConnected && typeof el.focus === 'function') { e.preventDefault(); el.focus(); }
    },
  };
}

/* ================= Modal ================= */
const modalSizes = {
  sm: 'w-[calc(100%-2rem)] max-w-sm',
  md: 'w-[calc(100%-2rem)] max-w-lg',
  lg: 'w-[calc(100%-2rem)] max-w-2xl',
  full: 'inset-3 sm:inset-6 animate-slide-up',
};
const sr = 'absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]';

/**
 * Modal (Radix Dialog). Props: open, onOpenChange, defaultOpen, size sm|md|lg|full, trigger (node),
 * label (screen-reader title when you don't use Modal.Header), dismissible (false blocks esc/overlay close).
 * Compose with Modal.Header / Modal.Body / Modal.Footer / Modal.Close.
 */
export function Modal({ open, onOpenChange, defaultOpen, size = 'md', trigger, label, dismissible = true, className, children, overlayClassName }) {
  const block = (e) => { if (!dismissible) e.preventDefault(); };
  const restore = useRestoreFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 z-overlay bg-scrim/50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out', overlayClassName)} />
        <Dialog.Content
          aria-describedby={undefined}
          {...restore}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          className={cn(
            'fixed z-modal flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface-overlay text-text shadow-lg focus:outline-none',
            size === 'full' ? '' : 'left-1/2 top-1/2 data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
            size === 'full' ? 'max-h-none' : '',
            modalSizes[size] || modalSizes.md,
            className,
          )}
        >
          {label ? <Dialog.Title className={sr}>{label}</Dialog.Title> : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
const ModalHeader = ({ title, description, hideClose, className, children }) => (
  <div className={cn('flex items-start gap-4 border-b border-border px-6 py-4', className)}>
    <div className="min-w-0 flex-1">
      <Dialog.Title className="font-display text-xl font-medium tracking-tight">{title}</Dialog.Title>
      {description ? <Dialog.Description className="mt-1 text-sm text-text-muted">{description}</Dialog.Description> : null}
      {children}
    </div>
    {hideClose ? null : (
      <Dialog.Close asChild>
        <IconButton aria-label="Close" size="sm" icon={<X className="h-4 w-4" />} className="-mr-2 -mt-1" />
      </Dialog.Close>
    )}
  </div>
);
const ModalBody = ({ className, ...p }) => <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm', className)} {...p} />;
const ModalFooter = ({ className, ...p }) => <div className={cn('flex flex-col-reverse gap-2 border-t border-border bg-surface/60 px-6 py-4 sm:flex-row sm:justify-end', className)} {...p} />;
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.Close = Dialog.Close;
Modal.Trigger = Dialog.Trigger;
Modal.Title = Dialog.Title;
Modal.Description = Dialog.Description;

/* ================= Sheet / Drawer ================= */
const sheetSide = {
  right: 'right-0 inset-y-0 w-[min(24rem,100%)] border-l data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
  left: 'left-0 inset-y-0 w-[min(20rem,88%)] border-r data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
};
/** Sheet / Drawer: side 'left' | 'right'. Same slots as Modal (Sheet.Header/Body/Footer). */
export function Sheet({ open, onOpenChange, defaultOpen, side = 'right', trigger, label, className, children }) {
  const restore = useRestoreFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-scrim/50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content aria-describedby={undefined} {...restore} className={cn('fixed z-modal flex flex-col border-border bg-surface-overlay text-text shadow-lg focus:outline-none', sheetSide[side] || sheetSide.right, className)}>
          {label ? <Dialog.Title className={sr}>{label}</Dialog.Title> : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
Sheet.Header = ModalHeader;
Sheet.Body = ModalBody;
Sheet.Footer = ModalFooter;
Sheet.Close = Dialog.Close;
Sheet.Trigger = Dialog.Trigger;

/* ================= ConfirmDialog ================= */
/** ConfirmDialog: onConfirm may be async (button shows loading; dialog closes on success, stays open if it throws). */
export function ConfirmDialog({ open, onOpenChange, title = 'Are you sure?', description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel, children }) {
  const [busy, setBusy] = useState(false);
  const close = (v) => typeof onOpenChange === 'function' && onOpenChange(v);
  const run = async () => {
    setBusy(true);
    try {
      if (typeof onConfirm === 'function') await onConfirm();
      close(false);
    } catch {
      /* keep open; caller reports the error */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onOpenChange={(v) => { if (!busy) { if (!v && typeof onCancel === 'function') onCancel(); close(v); } }} size="sm">
      <Modal.Header title={title} description={description} hideClose />
      {children ? <Modal.Body>{children}</Modal.Body> : null}
      <Modal.Footer>
        <Modal.Close asChild><Button variant="ghost" disabled={busy}>{cancelLabel}</Button></Modal.Close>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={run}>{confirmLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}

/* ================= DropdownMenu ================= */
const menuContent = 'z-popover min-w-[11rem] overflow-hidden rounded-lg border border-border bg-surface-overlay p-1 text-sm text-text shadow-lg data-[state=open]:animate-pop-in';
const menuItem =
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors duration-fast data-[highlighted]:bg-text/[0.07] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-text-muted';

/**
 * DropdownMenu. `items`: [{label, icon, onSelect, danger, disabled, href}, {type:'separator'}, {type:'label', label}].
 * `trigger`: any focusable element (defaults to a "..." icon button).
 */
export function DropdownMenu({ items, trigger, align = 'end', side = 'bottom', label = 'Open menu', className }) {
  const list = asArray(items).filter(Boolean);
  return (
    <DD.Root>
      <DD.Trigger asChild>
        {trigger || <IconButton aria-label={label} size="sm" icon={<MoreHorizontal className="h-4 w-4" />} />}
      </DD.Trigger>
      <DD.Portal>
        <DD.Content align={align} side={side} sideOffset={6} className={cn(menuContent, className)}>
          {list.map((it, i) => {
            if (it.type === 'separator') return <DD.Separator key={i} className="-mx-1 my-1 h-px bg-border" />;
            if (it.type === 'label') return <DD.Label key={i} className="px-2.5 py-1.5 text-eyebrow uppercase text-text-muted">{asText(it.label)}</DD.Label>;
            return (
              <DD.Item
                key={i}
                disabled={it.disabled}
                asChild={Boolean(it.href)}
                onSelect={() => typeof it.onSelect === 'function' && it.onSelect()}
                className={cn(menuItem, it.danger && 'text-danger data-[highlighted]:bg-danger-soft [&_svg]:!text-danger')}
              >
                {it.href ? <a href={it.href}>{it.icon}{asText(it.label)}</a> : <>{it.icon}{asText(it.label)}</>}
              </DD.Item>
            );
          })}
        </DD.Content>
      </DD.Portal>
    </DD.Root>
  );
}

/* ================= Tooltip ================= */
export const TooltipProvider = ({ delayDuration = 250, children, ...p }) => <TT.Provider delayDuration={delayDuration} {...p}>{children}</TT.Provider>;
export function Tooltip({ content, children, side = 'top', delayDuration }) {
  if (!content) return children;
  return (
    <TT.Provider delayDuration={delayDuration ?? 250}>
      <TT.Root delayDuration={delayDuration}>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content side={side} sideOffset={6} className="z-tooltip max-w-xs rounded-md bg-text px-2.5 py-1.5 text-xs font-medium text-bg shadow-md data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-pop-in">
            {content}
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}

/* ================= Popover ================= */
export function Popover({ trigger, children, open, onOpenChange, align = 'center', side = 'bottom', className }) {
  return (
    <PP.Root open={open} onOpenChange={onOpenChange}>
      <PP.Trigger asChild>{trigger}</PP.Trigger>
      <PP.Portal>
        <PP.Content align={align} side={side} sideOffset={8} className={cn('z-popover w-72 rounded-lg border border-border bg-surface-overlay p-4 text-sm text-text shadow-lg data-[state=open]:animate-pop-in', className)}>
          {children}
        </PP.Content>
      </PP.Portal>
    </PP.Root>
  );
}
Popover.Close = PP.Close;

/* ================= Tabs ================= */
export const Tabs = TB.Root;
export const TabsList = forwardRef(function TabsList({ className, ...p }, ref) {
  return <TB.List ref={ref} className={cn('flex gap-1 overflow-x-auto border-b border-border', className)} {...p} />;
});
export const TabsTrigger = forwardRef(function TabsTrigger({ className, ...p }, ref) {
  return (
    <TB.Trigger
      ref={ref}
      className={cn(
        '-mb-px whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-text-muted transition-colors duration-base hover:text-text data-[state=active]:border-primary data-[state=active]:text-text',
        className,
      )}
      {...p}
    />
  );
});
export const TabsContent = forwardRef(function TabsContent({ className, ...p }, ref) {
  return <TB.Content ref={ref} className={cn('pt-5 focus-visible:outline-offset-4', className)} {...p} />;
});
