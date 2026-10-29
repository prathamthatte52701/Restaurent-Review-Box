# Progress

## Design System (Phase 0.3/0.4)

**Direction:** warm paper-white light + elevated warm-charcoal dark (4 surface levels), one saffron-ember accent, Fraunces display + Inter body self-hosted via @fontsource-variable, 1px borders, 3 restrained shadows, lucide icons only. See packages/ui/README.md.

**Decisions:** tokens are RGB-channel CSS vars mapped in the Tailwind preset (alpha utilities work, no `dark:` variants needed); Radix Dialog for Modal/Sheet; modal-based notification queue as a zustand store + `notify` singleton (works before provider mounts); single DataTable with mobile card-stack; native inputs for Select/Checkbox/Radio.

**Tests (throwaway Vite + Playwright harness, run and passed 53/53, then deleted; copy in scratchpad):** vite build clean; screenshots light/dark at 375/768/1440; no horizontal page scroll at 375/768/1440; zero unexpected console errors/warnings; fonts loaded; theme toggle + persistence + reload; 'banana' -> system; live OS change; localStorage-blocked mode; modal Tab trap, Esc, overlay close, focus returns to trigger; 3 stacked modals leave no body scroll lock; notification queue order, confirm true/false (action/Esc/overlay); DataTable search/sort/pagination/page-size/select-all/bulk/row actions/loading/error/retry/empty; wrong-prop robustness; ErrorBoundary.

**Gaps:** no automated test suite is committed (harness removed); notification modals have no exit animation (unmount on dismiss); Tooltip/IconButton/Pagination not exhaustively screen-reader tested; no combobox/date picker/toast; package-lock.json changed by adding @fontsource deps (not staged by this task).
