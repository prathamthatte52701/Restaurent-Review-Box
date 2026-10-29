import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@rrb/ui';

export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      type={show ? 'text' : 'password'}
      rightAdornment={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="rounded-xs p-1 text-text-muted hover:text-text focus-visible:shadow-ring focus-visible:outline-none">
          {show ? <EyeOff /> : <Eye />}
        </button>
      }
      {...props}
    />
  );
});
