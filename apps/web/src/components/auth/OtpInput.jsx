import { useEffect, useRef } from 'react';
import { cn } from '@rrb/ui';

const LEN = 6;

/** Six single-digit boxes. Controlled by `value` (string of digits). Calls onComplete(code) when all 6 are filled. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }) {
  const refs = useRef([]);
  const digits = Array.from({ length: LEN }, (_, i) => value[i] || '');
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const commit = (next, focusAt) => {
    const v = next.join('').slice(0, LEN);
    onChange(v);
    if (focusAt != null) refs.current[Math.min(focusAt, LEN - 1)]?.focus();
    if (v.length === LEN && /^\d{6}$/.test(v)) onComplete?.(v);
  };
  const fill = (start, str) => {
    const clean = str.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    let i = start;
    for (const ch of clean) { if (i >= LEN) break; next[i++] = ch; }
    commit(next, i);
  };

  return (
    <div role="group" aria-label="6 digit verification code" className="flex justify-between gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LEN}
          aria-label={`Digit ${i + 1} of ${LEN}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            if (!raw) { const n = [...digits]; n[i] = ''; commit(n); return; }
            if (raw.length > 1) return fill(i, raw);
            const n = [...digits]; n[i] = raw; commit(n, i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) { e.preventDefault(); const n = [...digits]; n[i - 1] = ''; commit(n, i - 1); }
            else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < LEN - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); fill(0, e.clipboardData.getData('text')); }}
          className={cn(
            'h-14 w-full min-w-0 rounded-md border bg-surface-raised text-center font-display text-2xl tabular-nums text-text outline-none transition-[border-color,box-shadow] duration-base ease-standard disabled:opacity-55',
            invalid ? 'border-danger shadow-[0_0_0_3px_rgb(var(--danger)/0.18)]' : 'border-border-strong focus:border-primary focus:shadow-ring',
          )}
        />
      ))}
    </div>
  );
}
