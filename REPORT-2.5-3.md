# Report - Phase 2.5 + Phase 3

## 1. Summary
**Completed:** 2.5.1 clearing optional fields, 2.5.2 session revocation, 2.5.3 code splitting, 2.5.4 unsaved-changes guard + SSRF-safe map-link resolver, 2.5.5 real Indore seed, 2.5.6 housekeeping; Phase 3: 3.1 listing API, 3.2 nearby, 3.3 detail API, 3.4 home, 3.5 listing page, 3.6 map + near me, 3.7 detail page, 3.8 global search.
**Not completed / caveats:** nothing skipped. Weak spots are listed per phase (seed data partly unverified; no real covers/links/ratings in the data). Phase 4 not started.

Note: Phase 2.5 and the Phase 3 backend were built and committed earlier in this run; in this session I re-verified them (API suite 114/114, secrets check, bundle) and built and tested the Phase 3 frontend.

## 2. Per mini-phase
| Phase | Status | Notes |
|---|---|---|
| 2.5.1 | DONE | truthiness/strip bugs fixed in validators, controllers, admin payload; null convention; dot-notation nested updates. `clearing.test.js` 13 tests. |
| 2.5.2 | DONE | jti sessions + tokenVersion; 13 session tests (two-device, logout-all, password change/reset, deactivate, 12 logins -> 10, forged jti, 10x revoked, one DB op in `protect`, in-flight revoke). Sessions-list UI is Phase 5. |
| 2.5.3 | PARTIAL | gzip targets met (web 204 kB, admin 178 kB); raw 644 / 566 kB misses the raw targets because react-dom alone is 224 kB. |
| 2.5.4 | DONE | blocker + beforeunload guard, resolver with allowlist / IP blocklist / 5 hops / 5s / rate limit / admin only (12 tests). `beforeunload` is only unit-reasoned, not driven in a browser. |
| 2.5.5 | PARTIAL | 5 real outlets seeded to Atlas, idempotent; many fields unverified (section 5). |
| 2.5.6 | DONE | screenshots in repo (5.9 MB total incl. Phase 3, a little over the ~5 MB aim); secrets check empty. |
| 3.1-3.3, 3.8 API | DONE | `$facet` listing, `$geoNear`, detail + similar + openStatus (IST, past midnight), suggest. 13 discovery tests. |
| 3.4 home | DONE | all sections real data with skeleton/error/empty. |
| 3.5 listing | DONE | URL is the state; verified by new-tab restore and back/forward. |
| 3.6 map | DONE | clustering, popups, near me. Denied and granted geolocation driven in a browser; timeout and unsupported paths are code-only. |
| 3.7 detail | DONE | with the current seed only the Directions button renders; Zomato/Swiggy/Call/Website/Instagram were verified by code and mocked data only. |
| 3.8 search | DONE | ARIA combobox, keyboard, recents. |

## 3. Blockers
None logged (no BLOCKERS.md needed). Missing SMTP and Cloudinary behaved as documented: emails print to the API console, local disk storage.

## 4. Decisions
See `DECISIONS.md` (sections 2.5.5 and "Phase 3 frontend", plus earlier phases).

## 5. Seed data
Per-restaurant sources and the NEEDS VERIFICATION table: `docs/seed-sources.md`. Headline: all 5 `priceForTwo` values are estimates; hours are from Yappe (Jan 2024); no Zomato/Swiggy/Maps links (none could be resolved to a page actually read); Shreemaya's phone has a conflicting listing; Bapu Ki Kutia coordinates are landmark-level; Pizza Hut Malhar may be closed; Domino's has no outlet phone. Coordinates are OSM Nominatim, all inside the Indore bounds.

## 6. Bundle sizes (initial JS, raw / gzip)
| App | Before | After |
|---|---|---|
| web | 732.0 kB / 228.9 kB | 643.5 kB / 203.6 kB (Phase 3 adds only lazy chunks: Home 17, Restaurants 18, Detail 25, ListingMap 37, map libs 153 kB raw) |
| admin | 1058.8 kB / 317.3 kB | 566.0 kB / 178.4 kB |

## 7. DB performance
`docs/db-performance.md` (5,000-document in-memory run). Every listing query with a narrowing filter, search, nearby and suggest uses an index. **One COLLSCAN: the unfiltered listing**, inherent (`isActive:true` matches ~95% and facets must see all documents). Revisit above ~50k restaurants per city. Not run against Atlas.

## 8. Security
- No secrets tracked (`git ls-files | grep -E "node_modules|\.env$"` empty; `.env.example` has blank credentials).
- SSRF allowlist + IP blocklist tested (26 rejections, redirect-to-internal, DNS64 handled).
- Revoked tokens dead (two-device, logout-all, password change/reset, deactivate, in-flight revoke).
- No password / session / jti / tokenVersion in any response (tested). Public detail strips createdBy, __v, publicIds; list hides gallery, contactEmail, ownerName.
- Map popups are built with `textContent`, so restaurant names cannot inject HTML.

## 9. Break test log (Phase 3, `discovery-break.mjs`, 64/64)
| Case | Result |
|---|---|
| 4 filters, copy URL to new tab | same results and chips |
| back/forward through filters | steps correctly |
| `?page=-5`, `abc`, `99999`, `limit=99999`, `sort=garbage`, `cuisines=notanid`, bad cost/type, `minRating=99`, `near=999,999`, 1000-char q, emoji q, `';DROP` | no 5xx, page never blank; `page=99999` recovers to the last real page |
| no matches | designed empty state; Clear filters restores 5 |
| 20 rapid toggles | final UI count equals API for the final URL |
| search: arrows/Enter/Escape, ARIA, no selection, 1000 chars, emoji, localStorage throwing | fine (input capped at 100) |
| detail: unknown slug, mocked 404 (deleted while open), no images/timings/links/phone | designed 404; fallbacks, no crash |
| geolocation denied | message + "Use a city instead" works; granted: distances nearest-first, radius, circle + marker |
| map: pins vs results, 10x rapid filter churn, popup link | counts match, one Leaflet container, no duplicate pins, SPA navigation |
| slow API (1.5s delay) | skeletons shown, then content |

Bugs found and fixed: map froze and crashed the tab (missing `maxZoom` with markercluster); hero text clipped at 375; empty cover hero too tall on detail. Test-only fixes: checkbox `.check()` asserts before URL-driven state updates; URL comma encoding; wait for near results.
Phase 2.5 gate cases (clear all optionals, 5x nested update, revoked token 10x, in-flight revoke, 2MB resolver body, broken seed row) are covered by the API tests above; production bundle has 0 source maps and 0 `console.log`. Not done: a literal Slow 3G throttle and a memory-growth measurement on the map.

## 10. Screenshots
`docs/screenshots/phase-3/` (home, list, list-filtered, list-empty, list-map, detail, detail-404; light and dark at 1440 and 375). Earlier phases under `docs/screenshots/phase-0|1|2|2.5`. 768 captures exist locally but are not committed.

## 11. Check first when you wake up
1. Seed accuracy (`docs/seed-sources.md`): prices are estimates, hours unverified; confirm "Shreemaya Celebrity" is the intended Shreemaya.
2. Open home and the map view in a real browser in light and dark (`npm run dev` in apps/api and `npm run dev -w @rrb/web`).
3. Add real cover photos and Zomato/Swiggy links via admin to see cards and outbound buttons with real data.
4. Admin: try the unsaved-changes dialog on the wizard and a pasted `maps.app.goo.gl` link.
5. Run `npm run indexes -w @rrb/api` once to confirm the `{address.area,isActive}` index exists on Atlas.

## 12. Recommendations before Phase 4
- Keep `ratingAvg` / `ratingCount` consistent when reviews are written or removed (aggregation or transactional update); sorting, `minRating` and Top rated depend on them.
- One review per user per restaurant (unique index), rate-limit creation, render review text as text only.
- Seed a few reviews and mark one restaurant featured in a dev DB to exercise Top rated / Featured.
- Commit the Playwright scripts to CI; they currently run by hand.
