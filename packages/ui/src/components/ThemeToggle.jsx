import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../theme/themeStore.js';
import { DropdownMenu } from './Overlay.jsx';
import { IconButton } from './Button.jsx';

const ICON = { light: Sun, dark: Moon, system: Monitor };

/** Theme dropdown: Light / Dark / System. */
export function ThemeToggle({ size = 'md', className }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const Icon = ICON[mode] || Monitor;
  const item = (m, label) => {
    const I = ICON[m];
    return { label: `${label}${mode === m ? ' (active)' : ''}`, icon: <I />, onSelect: () => setMode(m) };
  };
  return (
    <DropdownMenu
      label={`Theme: ${mode}`}
      trigger={<IconButton aria-label={`Theme: ${mode}`} size={size} className={className} icon={<Icon className="h-4 w-4" />} />}
      items={[item('light', 'Light'), item('dark', 'Dark'), item('system', 'System')]}
    />
  );
}
