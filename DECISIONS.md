
## 2.5.5 Real Indore seed data
- Replaced placeholder samples with `data/restaurants.indore.json` (5 real outlets, see `docs/seed-sources.md`). Kept `data/restaurants.sample.json` because `apps/api/tests/bulk.test.js` runs the seed CLI against it; it contains fabricated placeholder URLs and must not be used for real data.
- `priceForTwo` is required (> 0) by the validator, but no outlet-specific figure could be verified for any of the 5. Used the best indirect figure per restaurant (600/600/400/600/450) and flagged every one in NEEDS VERIFICATION in `docs/seed-sources.md`. These are estimates, not facts; costBracket is derived from them.
- Timings are optional in the schema, but a Yappe (Jan 2024) schedule existed for each, so they were included and flagged as unverified rather than omitted.
- Zomato/Swiggy/Google Maps links left empty (nothing resolved to a page actually read).
- "Shreemaya" is ambiguous in Indore; chose Shreemaya Celebrity (Vijay Nagar).
- Bapu Ki Kutia coordinates are landmark-level (the Prestige college it faces).
- Removed unverified placeholders from Atlas via a throwaway script using the Restaurant model (+ image removal, 0 files): only Vijay Chaat House, Sarafa Bazaar Night Market and Madhuram Sweets were present there (Johny Hot Dog and Joshi Dahi Bada House were not).

## Phase 3 frontend
- **Pagination, not load-more** on the listing: numbered pages keep the URL restorable (`?page=2`), back/forward exact, and the footer reachable. Map view loads one batch of up to 50 (API cap) instead.
- **Filter values in the URL are slugs** (`cuisines=pizza`), comma-joined (encoded `%2C`); unknown slugs give an empty result from the API, never a 500.
- **Search typing uses history `replace`, filter clicks `push`**: the back button steps through filters, not keystrokes.
- **Near me stores rounded coordinates in the URL** (`near=lat,lng`, 4 decimals, about 11 m) so the view is shareable; `near=me` triggers the permission prompt and is replaced by coordinates. In near mode sort is nearest-first and facets come from a parallel `limit=1` listing call (nearby returns no facets).
- **Top rated** uses `minRating=0.1`; **Featured** shows only `isFeatured`. With the current seed both show designed empty states rather than fake content.
- **Directions** falls back to the public `google.com/maps/dir/?api=1&destination=lat,lng` URL, built from stored coordinates, when no `mapsUrl` is set. It is the only outbound button for the current seed.
- **markercluster** over a hand-written clusterer: maintained, and its cost sits in the lazy map chunk. It requires `maxZoom` on the MapContainer.
- Header search shows from `md`; below that it lives in the menu sheet.
- Dark mode dims OSM tiles with a CSS filter instead of switching tile providers.
