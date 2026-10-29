# Progress

## Design System (Phase 0.3/0.4)

**Direction:** warm paper-white light + elevated warm-charcoal dark (4 surface levels), one saffron-ember accent, Fraunces display + Inter body self-hosted via @fontsource-variable, 1px borders, 3 restrained shadows, lucide icons only. See packages/ui/README.md.

**Decisions:** tokens are RGB-channel CSS vars mapped in the Tailwind preset (alpha utilities work, no `dark:` variants needed); Radix Dialog for Modal/Sheet; modal-based notification queue as a zustand store + `notify` singleton (works before provider mounts); single DataTable with mobile card-stack; native inputs for Select/Checkbox/Radio.

**Tests (throwaway Vite + Playwright harness, run and passed 53/53, then deleted; copy in scratchpad):** vite build clean; screenshots light/dark at 375/768/1440; no horizontal page scroll at 375/768/1440; zero unexpected console errors/warnings; fonts loaded; theme toggle + persistence + reload; 'banana' -> system; live OS change; localStorage-blocked mode; modal Tab trap, Esc, overlay close, focus returns to trigger; 3 stacked modals leave no body scroll lock; notification queue order, confirm true/false (action/Esc/overlay); DataTable search/sort/pagination/page-size/select-all/bulk/row actions/loading/error/retry/empty; wrong-prop robustness; ErrorBoundary.

**Gaps:** no automated test suite is committed (harness removed); notification modals have no exit animation (unmount on dismiss); Tooltip/IconButton/Pagination not exhaustively screen-reader tested; no combobox/date picker/toast; package-lock.json changed by adding @fontsource deps (not staged by this task).

## Backend (Phase 0.2 / 1 / 2) — API

Location: `apps/api` (Node 24, Express 5, Mongoose 8, ESM JS). Tests: **62 passing / 0 failing** (`npm test`, ~2.5 min, dominated by the 10k-row test).

### Built
- **Foundation**: `config/` (env, db), `app.js` (no listen) + `server.js` (graceful SIGINT/SIGTERM), helmet (CORP cross-origin), CORS limited to CLIENT_URL/ADMIN_URL, json 1mb (bulk route 25mb), `$`/`.` key sanitizer, rate limiters, central error handler (ApiError, Zod, Mongoose Validation/Cast/11000, multer, malformed JSON, 413), JSON 404, `asyncHandler`, `validate({body,query,params})` (parsed values in `req.validated`).
- **DB bootstrap**: MONGO_URI (2.5s selection timeout) -> running in-memory DB of another local process (`.mongo-memory/uri.txt`) -> start `mongodb-memory-server` persisted in `apps/api/.mongo-memory`. Production: missing/unreachable -> one-line error, exit(1).
- **Auth** (`/api/v1/auth`): register, verify-otp, resend-otp, login (email|username|identifier), logout, me, forgot-password, reset-password, change-password, check-username. OTP = HMAC-SHA256, 10 min, 5 attempts (atomic `$inc`), reset token = random 32 bytes, hash stored, 15 min, atomic single use. Dummy bcrypt compare for unknown users. Unverified login -> 403 with `errors.requiresVerification:true`. Tokens issued before a password change are void (`passwordChangedAt`).
- **Masters**: City/Cuisine/Amenity CRUD via one controller factory, unique slugs (-2, -3), 409 on in-use delete, `?includeInactive=true` admin-only.
- **Restaurants**: full model + indexes (2dsphere, text, city+isActive, cuisines+isActive, costBracket, ratingAvg, ...), CRUD, toggle, cover, gallery (max 10, atomic cap), reorder, delete-with-files. Location accepts GeoJSON or `{lat,lng}`.
- **Storage**: `services/storage/{index,local,cloudinary}.js`; image pipeline validates real signature (`file-type`), resizes to max 1600px webp (`sharp`), random filenames.
- **Bulk import** `POST /restaurants/bulk-import` + `npm run seed -- --file=... [--dry-run] [--no-auto-create]`; docs in `docs/bulk-import.md`; sample `data/restaurants.sample.json` (5 Indore places).
- **Admin stats** `GET /admin/stats`.
- **Admin seed**: `npm run seed:admin -w @rrb/api`; auto-created at start in non-production from ADMIN_EMAIL/ADMIN_PASSWORD (dev .env has admin@rrb.local / Admin@12345).

### Decisions
- Errors: `errors` is a `{field: message}` map. List responses: `{success,data,pagination,message}`.
- Bulk: chunks of 500 (batched lookups + one unordered `bulkWrite` per chunk); match by explicit slug, else same name + within 50 m; unchanged -> `skipped: "No changes"`; only keys present in the row are `$set` (admin flags survive re-imports). Max 20,000 rows/request (seed CLI has no cap).
- Slugs are stable after creation (name edits do not change them).
- Image URLs are absolute (`PUBLIC_API_URL`, default `http://localhost:PORT`).

### Break tests (all pass)
Phase 1: garbage/expired/foreign-secret/alg-none/ghost-user/other-user tokens; wrong OTP x6 locks (correct code then refused, resend restores); OTP reuse; reset token reuse (incl. 3 parallel -> 1 wins); expired reset message; duplicate email/username 409 with field errors; rate limiter fires (login 20/15min, resend 3/10min, forgot 5/h); `{"email":{"$gt":""}}` -> 400; no sensitive keys in responses; login timing ratio 1.03-1.40 (limit 3); 6 parallel registers -> exactly 1 account; disabled user cannot log in.
Phase 2: renamed exe/php/gif/svg/truncated jpeg rejected by signature; 50MB -> 413 "too large (max 5MB)"; 15 files / 10-cap (sequential, single request, concurrent); same-name distinct slugs (also 5 parallel); coords 999,999 rejected; nonexistent cuisine/amenity/city 400; delete used cuisine -> "Cuisine is used by 3 restaurants"; 18:00->02:00 accepted; price -500/0/"500"/null rejected; every admin endpoint 401 anon / 403 user; 10,000-row bulk (first run ~20-43s, idempotent re-run ~8-19s on in-memory Mongo); 3 valid + 2 broken exact reasons; bulk twice idempotent; page=99999 empty; `';DROP` and 500-char search safe; restaurant delete removes files; unknown route 404 JSON; thrown error shape; production no stack; missing/unreachable Mongo in production exits 1 with one line; seed CLI dry-run/real/rerun/path resolution.

### Known gaps
- No geo "near me" query endpoint yet (2dsphere index is in place); no thumbnails; no `owner` role flows; no reviews (later phase).
- Cloudinary driver is untested (no credentials).
- Tokens are stateless; logout does not revoke; password change voids tokens only from the next second.
- Bulk import does not handle images; amenities are auto-created like cuisines.
- Master slug collision on names that slugify identically ("R&B" vs "RB") get `-2` slugs but bulk lookup is by name.

### Commands
`npm run dev:api` | `npm test` | `npm run seed -- --file=./data/restaurants.sample.json [--dry-run]` | `npm run seed:admin -w @rrb/api`

## Web app (Phase 0 / 1)

**Built (apps/web, @rrb/web):** Vite/Tailwind/PostCSS config on the @rrb/ui preset + theme plugin; providers (QueryClient with 60s stale, no 4xx retry, mutation errors -> `notify.error` unless `meta.silent`; TooltipProvider; NotificationProvider; root ErrorBoundary); `src/lib/api.js` axios instance (Bearer from `rrb-token`, unwraps `{success,data,message,pagination}` to `{data,message,pagination}`, normalised errors with `.message/.status/.errors`, network-down message, 401 on authed non-auth endpoints -> clear session + one debounced "Session ended" modal + redirect to `/login?next=`); zustand auth store with boot hydration (`isHydrating` loading screen, garbage token -> clean logout, server unreachable -> keeps token and shows retry state); hooks `useLogin/Register/VerifyOtp/ResendOtp/Me/Logout/ForgotPassword/ResetPassword/ChangePassword/useUsernameAvailability`; router (`createBrowserRouter`) with `/`, `/restaurants`, `/ui-kit`, `/profile` (placeholder), 404, `ProtectedRoute` (`?next=`), `GuestRoute`; shell (Header with search, nav, ThemeToggle, auth buttons / avatar dropdown; Sheet mobile menu; Footer); pages `/signup /login /verify-otp /forgot-password /reset-password /change-password` (split-screen on desktop, single column mobile); `/ui-kit` showing every primitive/state.

**Decisions:** login sends `{identifier,password}` plus exactly one of `email`/`username`; server field errors map to RHF fields, 4xx without fields -> inline banner, 429/network/5xx -> modal; `?next=` sanitised (same-site paths only); OTP page auto-requests a fresh code when arriving from a blocked (unverified) login; change-password stores the rotated token. **packages/ui fix:** Modal/Sheet now restore focus to the opener when controlled (Radix only does it for `<Trigger>`).

**Tests (real API + vite + Playwright; scripts in `apps/web/e2e`, run from repo root, see header comments; screenshots default to `apps/web/e2e/.shots` or `SHOTS_DIR`):**
- `smoke.mjs` 132/132: every page light+dark at 375/768/1440 - theme applied, no horizontal scroll, zero console errors/warnings.
- `journeys.mjs` 49/49: empty/invalid forms readable inline errors; wrong credentials; password strength + show/hide; live username availability (available/taken); double-click signup = 1 request; OTP wrong code, backspace, paste, auto-submit, countdown; reload stays logged in with no login flash; change password (wrong current, mismatch, success, old password then fails, new works, `?next=` return); logout; forgot -> reset (token read from API console) -> login, reused link rejected; garbage token -> clean logout to login; unverified login -> OTP page with new code; duplicate signup field errors. 7 expected 4xx "Failed to load resource" console lines reported separately.
- `ui.mjs` 19/19: no theme flash, persists across reload, `banana` -> system; modal Tab trap, Esc, focus returns to opener; 3 stacked modals + 3x Esc leaves no scroll lock; notification queue order; 404; mobile Sheet menu.
- `failure.mjs`: `MODE=down` 6/6 (API stopped: readable modal on login, session retry state, no white screen, home renders; 3 expected network console lines); `MODE=ratelimit` 3/3 (default limits: 429 after 21 attempts, modal "Please slow down ... try again in 15 minutes").
- Defects found and fixed: home hero h-scroll at 375, hero floating card overlapping rating, strength meter blank for short non-empty passwords, focus not restored for controlled modals, regex/test-selector issues.

**Gaps:** inactive-user message not exercised (no admin API route to deactivate used); no unit tests; bundle is one 730kB chunk (no route code-splitting); profile page is a placeholder; Restaurants page is a placeholder; run the API with `REGISTER_RATE_MAX=1000 FORGOT_RATE_MAX=1000 RESEND_RATE_MAX=1000 LOGIN_RATE_MAX=1000 node apps/api/src/server.js > api.log` before `journeys.mjs` (`API_LOG=api.log`).

**Commands:** `npm run dev -w @rrb/web`; `npm run build -w @rrb/web`; e.g. `API_LOG=<log> node apps/web/e2e/journeys.mjs`.
