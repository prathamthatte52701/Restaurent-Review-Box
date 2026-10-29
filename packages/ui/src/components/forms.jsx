import { Children, cloneElement, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Minus, Search, X } from 'lucide-react';
import { cn, asArray, asText } from '../utils.js';

const fieldBase =
  'flex w-full items-center rounded-md border bg-surface-raised text-text transition-[border-color,box-shadow] duration-base ease-standard';
const fieldState = (invalid, disabled) =>
  cn(
    invalid ? 'border-danger focus-within:shadow-[0_0_0_3px_rgb(var(--danger)/0.22)]' : 'border-border-strong hover:border-text-muted/60 focus-within:border-primary focus-within:shadow-ring',
    disabled && 'opacity-55 cursor-not-allowed bg-surface',
  );
const innerInput =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/70 outline-none disabled:cursor-not-allowed';

/** Input with optional `leftAdornment` / `rightAdornment` nodes and `invalid` state. */
export const Input = forwardRef(function Input(
  { className, inputClassName, leftAdornment, rightAdornment, invalid, disabled, size = 'md', ...rest },
  ref,
) {
  return (
    <div className={cn(fieldBase, size === 'sm' ? 'h-8' : 'h-10', fieldState(invalid, disabled), className)}>
      {leftAdornment ? <span className="pl-3 text-text-muted flex items-center [&_svg]:h-4 [&_svg]:w-4">{leftAdornment}</span> : null}
      <input ref={ref} disabled={disabled} aria-invalid={invalid || undefined} className={cn(innerInput, leftAdornment && 'pl-2', rightAdornment && 'pr-2', inputClassName)} {...rest} />
      {rightAdornment ? <span className="pr-3 text-text-muted flex items-center [&_svg]:h-4 [&_svg]:w-4">{rightAdornment}</span> : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, disabled, rows = 4, ...rest }, ref) {
  return (
    <div className={cn(fieldBase, 'items-stretch', fieldState(invalid, disabled), className)}>
      <textarea ref={ref} rows={rows} disabled={disabled} aria-invalid={invalid || undefined} className={cn(innerInput, 'resize-y min-h-[5rem] leading-relaxed')} {...rest} />
    </div>
  );
});

/** Native <select>, styled. Pass `options=[{value,label}]` or <option> children. */
export const Select = forwardRef(function Select({ className, selectClassName, invalid, disabled, options, children, size = 'md', ...rest }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          size === 'sm' ? 'h-8' : 'h-10',
          fieldState(invalid, disabled),
          'appearance-none pl-3 pr-9 text-sm focus:border-primary focus:shadow-ring outline-none cursor-pointer',
          selectClassName,
        )}
        {...rest}
      >
        {asArray(options).map((o) => {
          const opt = o && typeof o === 'object' ? o : { value: o, label: o };
          return (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
              {asText(opt.label)}
            </option>
          );
        })}
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
    </div>
  );
});

const box =
  'peer h-[18px] w-[18px] shrink-0 appearance-none border border-border-strong bg-surface-raised transition-colors duration-fast checked:border-primary checked:bg-primary hover:border-text-muted focus-visible:shadow-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

/** Checkbox with optional `label` and `indeterminate`. */
export const Checkbox = forwardRef(function Checkbox({ label, indeterminate = false, className, id, ...rest }, ref) {
  const inner = useRef(null);
  const auto = useId();
  const cid = id || auto;
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const setRef = (el) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <label htmlFor={cid} className={cn('inline-flex items-center gap-2.5 text-sm cursor-pointer has-[:disabled]:cursor-not-allowed', className)}>
      <span className="relative inline-flex">
        <input ref={setRef} id={cid} type="checkbox" className={cn(box, 'rounded-xs', indeterminate && 'border-primary bg-primary')} {...rest} />
        <Check aria-hidden="true" strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-fg opacity-0 peer-checked:opacity-100" style={indeterminate ? { opacity: 0 } : undefined} />
        <Minus aria-hidden="true" strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-fg opacity-0" style={indeterminate ? { opacity: 1 } : undefined} />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
});

const RadioCtx = createContext(null);

/** RadioGroup: `value`/`onValueChange` (controlled) or `defaultValue`; children are <Radio value=...>. */
export function RadioGroup({ value, defaultValue, onValueChange, name, orientation = 'vertical', className, children, ...rest }) {
  const auto = useId();
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const ctx = {
    name: name || auto,
    value: current,
    onChange: (v) => {
      if (!controlled) setInner(v);
      if (typeof onValueChange === 'function') onValueChange(v);
    },
  };
  return (
    <RadioCtx.Provider value={ctx}>
      <div role="radiogroup" className={cn('flex gap-3', orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col', className)} {...rest}>
        {children}
      </div>
    </RadioCtx.Provider>
  );
}

export const Radio = forwardRef(function Radio({ label, value, className, id, onChange, checked, ...rest }, ref) {
  const ctx = useContext(RadioCtx);
  const auto = useId();
  const rid = id || auto;
  const isChecked = ctx ? ctx.value === value : checked;
  return (
    <label htmlFor={rid} className={cn('inline-flex items-center gap-2.5 text-sm cursor-pointer has-[:disabled]:cursor-not-allowed', className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          id={rid}
          type="radio"
          name={ctx?.name}
          value={value}
          checked={isChecked === undefined ? undefined : Boolean(isChecked)}
          onChange={(e) => {
            if (ctx) ctx.onChange(value);
            if (typeof onChange === 'function') onChange(e);
          }}
          className={cn(box, 'rounded-full')}
          {...rest}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-primary-fg opacity-0 peer-checked:opacity-100" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
});

/** Switch (role="switch"). Controlled via `checked`/`onCheckedChange`, or uncontrolled with `defaultChecked`. */
export const Switch = forwardRef(function Switch({ checked, defaultChecked = false, onCheckedChange, disabled, label, className, id, ...rest }, ref) {
  const [inner, setInner] = useState(Boolean(defaultChecked));
  const controlled = checked !== undefined;
  const on = controlled ? Boolean(checked) : inner;
  const auto = useId();
  const toggle = () => {
    if (!controlled) setInner(!on);
    if (typeof onCheckedChange === 'function') onCheckedChange(!on);
  };
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-sm', className)}>
      <button
        ref={ref}
        id={id || auto}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-base ease-standard disabled:opacity-50 disabled:cursor-not-allowed',
          on ? 'bg-primary border-primary' : 'bg-border-strong/50 border-border-strong',
        )}
        {...rest}
      >
        <span aria-hidden="true" className={cn('inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-base ease-emphasized', on ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
      </button>
      {label ? <label htmlFor={id || auto} className="cursor-pointer">{label}</label> : null}
    </span>
  );
});

/**
 * FormField: label + control + hint/error. Injects id, aria-describedby, aria-invalid, required
 * into the single child control (Input/Textarea/Select/...). `children` may also be a function ({id, ...aria}) => node.
 */
export function FormField({ label, hint, error, required, className, children, htmlFor }) {
  const auto = useId();
  const id = htmlFor || auto;
  const hintId = `${id}-hint`;
  const errId = `${id}-error`;
  const errText = typeof error === 'string' || typeof error === 'number' ? String(error) : error === true ? '' : null;
  const hasError = errText !== null && error !== false && error != null;
  const describedBy = [hint ? hintId : null, hasError && errText ? errId : null].filter(Boolean).join(' ') || undefined;
  const props = { id, 'aria-describedby': describedBy, invalid: hasError || undefined, required: required || undefined };
  let control = children;
  if (typeof children === 'function') control = children(props);
  else if (isValidElement(Children.toArray(children)[0]) && Children.count(children) === 1) control = cloneElement(Children.toArray(children)[0], props);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {required ? <span aria-hidden="true" className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {control}
      {hint && !hasError ? <p id={hintId} className="text-xs text-text-muted">{hint}</p> : null}
      {hasError && errText ? <p id={errId} role="alert" className="text-xs font-medium text-danger">{errText}</p> : null}
    </div>
  );
}

/** SearchInput: clear button; `debounce` (ms) delays onChange(value). `value` syncs from parent. */
export const SearchInput = forwardRef(function SearchInput({ value, defaultValue = '', onChange, debounce = 0, placeholder = 'Search', className, 'aria-label': aria, ...rest }, ref) {
  const [text, setText] = useState(asText(value !== undefined ? value : defaultValue));
  const timer = useRef(null);
  const last = useRef(text);
  useEffect(() => {
    if (value !== undefined && asText(value) !== last.current) {
      last.current = asText(value);
      setText(last.current);
    }
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const emit = (v, immediate) => {
    last.current = v;
    setText(v);
    clearTimeout(timer.current);
    if (typeof onChange !== 'function') return;
    if (immediate || !debounce) onChange(v);
    else timer.current = setTimeout(() => onChange(v), Number(debounce) || 0);
  };
  return (
    <Input
      ref={ref}
      type="search"
      role="searchbox"
      value={text}
      placeholder={placeholder}
      aria-label={aria || placeholder}
      onChange={(e) => emit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape' && text) { e.preventDefault(); emit('', true); } }}
      leftAdornment={<Search />}
      rightAdornment={
        text ? (
          <button type="button" aria-label="Clear search" onClick={() => emit('', true)} className="rounded-xs p-0.5 text-text-muted hover:text-text hover:bg-text/10">
            <X />
          </button>
        ) : null
      }
      inputClassName="[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      className={className}
      {...rest}
    />
  );
});
