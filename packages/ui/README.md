# @rrb/ui

## Design direction

**"Warm paper, one ember accent."** Light theme is warm paper-white with crisp 1px warm-grey borders; dark theme is a genuinely
elevated warm charcoal (four surface steps: `bg < surface < surface-raised < surface-overlay`), not an inversion.
A single saffron-ember accent (`primary`, burnt amber in light, lit amber in dark). Fraunces (display serif, confident and tight)
over Inter (body), both self-hosted via `@fontsource-variable`. Depth is restrained: borders first, three warm-tinted shadow levels
only, no glassmorphism, no gradients, no emoji. Motion is short and purposeful and respects `prefers-reduced-motion`. Icons: `lucide-react` only.

## Consuming it

```js
// tailwind.config.js (apps/web, apps/admin)
import preset from '@rrb/ui/tailwind-preset';
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}', '../../packages/ui/src/**/*.{js,jsx}'], // UI path is REQUIRED
};
```
```js
// main.jsx
import '@rrb/ui/styles.css';          // tokens, fonts, base styles, tailwind layers
```
```js
// vite.config.js : injects the no-flash theme script into <head>
import { rrbThemeInitPlugin } from '@rrb/ui/vite-theme-plugin';
export default defineConfig({ plugins: [react(), rrbThemeInitPlugin()] });
```
Without Vite you can paste `themeInitScript` (exported from `@rrb/ui`) inside a `<script>` in `<head>`.

```jsx
<TooltipProvider><NotificationProvider><ErrorBoundary><App /></ErrorBoundary></NotificationProvider></TooltipProvider>
```
The app needs a PostCSS config with `tailwindcss` and `autoprefixer` (the CSS file contains `@tailwind` directives).

## Tokens

Colors are CSS variables holding RGB channels (so `bg-primary/10` works) and flip under `:root[data-theme="dark"]`. Use semantic
classes only, never raw hex:
`bg`, `surface`, `surface-raised`, `surface-overlay`, `border`, `border-strong`, `text`, `text-muted`, `primary`, `primary-hover`,
`primary-fg`, `primary-soft`, `success|warning|danger` + `-fg` + `-soft`, `ring`, `scrim`.
Fonts: `font-display`, `font-sans`. Sizes: `text-xs..xl`, `text-display-sm|md|lg|xl|2xl`, `text-eyebrow`. Radii `xs..2xl`.
Shadows `shadow-xs|sm|md|lg|ring`. z-index: `dropdown 1000, sticky 1100, overlay 1200, modal 1300, popover 1400, toast 1500, tooltip 1600`.
Durations `fast|base|slow`; easings `standard|emphasized|exit`. Animations: `fade-in/out`, `slide-up`, `slide-in/out-left/right`,
`scale-in/out` (dialogs), `pop-in`, `shimmer`, `spin`. Dark mode: `darkMode: ['selector','[data-theme="dark"]']`.

## Theme

`useThemeStore()` -> `{ mode: 'light'|'dark'|'system', resolved, setMode }`. Persisted in `localStorage['rrb-theme']`
(try/catch safe; invalid values fall back to `system`); follows the OS live while in `system`. `<ThemeToggle />` is a dropdown.

## Notifications (modal based)

```js
import { notify, useNotify } from '@rrb/ui';       // mount <NotificationProvider> once
notify.success('Saved', 'Restaurant updated');      // also error / warning / info; accepts ({title, message, confirmLabel})
const yes = await notify.confirm({ title: 'Delete?', message: '...', danger: true, confirmLabel: 'Delete' }); // Promise<boolean>
```
One modal visible at a time, the rest queue (also if called before the provider mounts, e.g. axios interceptors). Esc/overlay resolves `false` for confirm.

## Components

Button, IconButton, Spinner, Input, Textarea, Select, Checkbox, Radio, RadioGroup, Switch, FormField, SearchInput (`debounce`),
Card (+Header/Title/Body/Footer), Badge, Avatar, Divider, Skeleton, Container, Logo, BrandMark, StarRating, Stat, StatCard,
EmptyState, ErrorState, PageHeader, Modal (+Header/Body/Footer/Close/Trigger; sizes sm|md|lg|full; `label` for a hidden title),
Sheet (left|right), ConfirmDialog, DropdownMenu (`items`), Tooltip, TooltipProvider, Popover, Tabs/TabsList/TabsTrigger/TabsContent,
Table (+THead/TBody/TR/TH/TD), Pagination, DataTable, ErrorBoundary, ThemeToggle, NotificationProvider.
Hooks/utils: `cn`, `useDebounce`, `useMediaQuery`, `useThemeStore`, `notify`, `notifyStore`.

### DataTable

```jsx
<DataTable
  columns={[{ key: 'name', header: 'Name', sortable: true, render: (r) => ..., width, align, hideOnMobile }]}
  rows loading error onRetry emptyTitle emptyDescription emptyAction
  searchValue onSearchChange searchDebounce={300}
  sort={{ key, order }} onSortChange={({ key, order }) => ...}
  pagination={{ page, limit, total, totalPages }} onPageChange onLimitChange limitOptions
  rowActions={(row) => [{ label, icon, onSelect, danger, disabled }, { type: 'separator' }]} inlineActions={(row) => node}
  selectable selectedIds onSelectionChange bulkActions={(ids) => node} toolbar={filters} getRowId />
```
Below 640px rows become a card stack; on wider screens only the table scrolls horizontally, never the page.
