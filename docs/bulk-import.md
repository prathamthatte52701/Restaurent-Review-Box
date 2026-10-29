# Bulk import of restaurants

Two entry points, same service (`apps/api/src/services/restaurantImport.js`):

- `POST /api/v1/restaurants/bulk-import` (admin token). Body is either a JSON array of rows or
  `{ "rows": [...], "autoCreate": true, "dryRun": false }`. Max 20,000 rows per request (25 MB body).
- CLI: `npm run seed -- --file=./data/restaurants.sample.json [--dry-run] [--no-auto-create]`
  (file resolved against the invoking dir, cwd, then repo root).

## Row schema

| Field | Required | Notes |
|---|---|---|
| name | yes | 2-120 chars |
| slug | no | if given, matches/updates that restaurant; otherwise generated (`name`, `name-2`, ...) |
| description, ownerName, contactPhone, contactEmail | no | |
| address.line1 | yes | |
| address.line2, area, pincode | no | pincode = 6 digits |
| address.city | yes | `"Indore"` or `{ "name": "Indore", "state": "Madhya Pradesh" }` (matched by name + state, case-insensitive) |
| location | yes | `{ "lat": 22.72, "lng": 75.86 }` or `{ "coordinates": [lng, lat] }` |
| type | yes | `veg` / `non-veg` / `both` |
| category | yes | `restaurant` / `cafe` / `bakery` / `street-food` / `bar` / `cloud-kitchen` |
| priceForTwo | yes | number > 0; `costBracket` is derived (<300 budget, 300-799 mid, 800-1999 premium, >=2000 luxury) |
| establishedYear | no | |
| cuisines, amenities | no | arrays of NAMES; created if missing (unless autoCreate=false) |
| timings | no | exactly 7 `{day, openTime "HH:mm", closeTime "HH:mm", isClosed}`; close earlier than open = past midnight |
| externalLinks | no | zomatoUrl (zomato.com, zoma.to), swiggyUrl (swiggy.com, swiggy.onelink.me), mapsUrl (google.com/maps, maps.app.goo.gl, goo.gl/maps, maps.google.com, openstreetmap.org), website, instagram (instagram.com) |
| isFeatured, isActive, isVerified | no | only applied when present in the row |

Images are not imported (use the cover/gallery endpoints).

## Result

```json
{ "success": true, "message": "3 created, 0 updated, 2 skipped",
  "data": { "dryRun": false,
    "totals": { "total": 5, "created": 3, "updated": 0, "skipped": 2 },
    "results": [ { "index": 0, "name": "...", "status": "created|updated|skipped", "reason": "...", "id": "..." } ] } }
```

`index` is the 0-based position in the input. Partial success is normal: invalid rows are `skipped` with the
exact validation reasons (`priceForTwo: priceForTwo must be greater than 0; ...`).

## Behaviour

- **Idempotent**: a row matches an existing restaurant by explicit `slug`, else by same name within 50 m.
  Identical data -> `skipped` ("No changes"); different data -> `updated` (only keys present in the row are written).
  Same name further than 50 m away is a new restaurant with a distinct slug.
- Duplicate rows inside one import are skipped ("Duplicate of row N").
- **Chunking**: rows are processed in chunks of 500; each chunk does batched lookups and one unordered `bulkWrite`,
  chunks run sequentially, so 10,000 rows do not exhaust memory or hit timeouts.
- `dryRun` / `--dry-run` computes the same results but writes nothing (including cuisines/cities).
- `autoCreate:false` skips rows referencing unknown cuisines/amenities/cities.

A working example is `data/restaurants.sample.json`.
