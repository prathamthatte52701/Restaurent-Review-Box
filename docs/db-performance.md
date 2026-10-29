# DB performance (discovery queries)

Measured with `npm run explain -w @rrb/api [rows]`: seeds a throwaway **in-memory** MongoDB (never Atlas) with 5,000 synthetic restaurants (~95% active) and prints `explain('executionStats')` for the real service queries (the listing `$facet` pipeline is explained on its first stage, which is where indexes apply).

Indexes (all declared in `models/Restaurant.js` / `Master.js`): `location` 2dsphere; text(name, description, address.area); `{address.city,isActive}`; `{cuisines,isActive}`; `{isFeatured,isActive}`; `{address.area,isActive}` (new, suggest); `name`; `amenities`; `costBracket`; `ratingAvg`; `priceForTwo`; `createdAt`. They are created on connect (`Model.init()` in `connectDB`, so Atlas gets them on the next API start). To force/verify: `npm run indexes -w @rrb/api` (syncIndexes; also drops indexes no longer in a schema).

rows: 5000
| query | winning plan | keys examined | docs examined | returned | verdict |
|---|---|---|---|---|---|
| list: no filter (relevance) | COLLSCAN | 0 | 5000 | 4746 | COLLSCAN |
| list: city | FETCH > IXSCAN(address.city_1_isActive_1) | 2347 | 2347 | 2347 | indexed |
| list: city+cuisines+cost | FETCH > IXSCAN(address.city_1_isActive_1) | 2347 | 2347 | 2347 | indexed |
| list: search "pizza" | FETCH > OR > TEXT_MATCH(name_text_description_text_address.area_text) > TEXT_OR > IXSCAN(name_text_description_text_address.area_text) > IXSCAN(name_1) | 5823 | 1646 | 792 | indexed |
| list: search prefix "spi" | FETCH > OR > TEXT_MATCH(name_text_description_text_address.area_text) > TEXT_OR > IXSCAN(name_text_description_text_address.area_text) > IXSCAN(name_1) | 5000 | 868 | 828 | indexed |
| list: featured | FETCH > IXSCAN(isFeatured_1_isActive_1) | 243 | 243 | 243 | indexed |
| list: openNow | FETCH > IXSCAN(address.city_1_isActive_1) | 2347 | 2347 | 0 | indexed |
| nearby | FETCH > GEO_NEAR_2DSPHERE(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) | 2221 | 3623 | 1456 | indexed |
| nearby + cuisine | FETCH > GEO_NEAR_2DSPHERE(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) > FETCH > IXSCAN(location_2dsphere) | 2221 | 3623 | 459 | indexed |
| suggest | PROJECTION_DEFAULT > IXSCAN(address.area_1_isActive_1) | 4754 | 0 | 0 | indexed |
| suggest (find) | LIMIT > FETCH > IXSCAN(name_1) | 3313 | 5 | 5 | indexed |
| suggest word | PROJECTION_DEFAULT > IXSCAN(address.area_1_isActive_1) | 4754 | 0 | 0 | indexed |
| suggest word (find) | LIMIT > FETCH > IXSCAN(name_1) | 1630 | 5 | 5 | indexed |
| detail similar (find) | LIMIT > FETCH > IXSCAN(cuisines_1_isActive_1) | 10 | 10 | 5 | indexed |

## Reading the table
- **COLLSCAN on "list: no filter"** is inherent, not a missing index: the query is `isActive:true`, which matches ~95% of documents, and the facet counts must see every matching document anyway. I tried `{isActive,ratingAvg}`; the planner then used it for the suggest queries too and got worse (fetched every document), so it was removed. Any filter that narrows the set (city, featured, cuisines, search) switches the first stage to an IXSCAN. At the expected scale (hundreds to low thousands per city) this is milliseconds; revisit with a materialised facet cache if a city exceeds ~50k restaurants.
- **Facet branches / sort / pagination run inside `$facet`**, so after the first `$match` they work on the already-narrowed set in memory (`allowDiskUse` on). The cuisine/amenity/cost/category filters are therefore applied after the index-assisted base `$match` (search, city, type, minRating, featured, openNow).
- **openNow** is a `$expr` `$match` (not indexable); it always rides on top of an indexed base (city/active). `returned 0` above only means no synthetic restaurant was open at the moment of the run.
- **Search** = `$or[$text, name prefix]`: TEXT_OR on the text index plus IXSCAN on `name_1` (case-insensitive prefix regex scans the name index keys, no document fetch until matched). Nearby search uses name/area regex because `$text` cannot be combined with `$geoNear`.
- **Nearby**: `GEO_NEAR_2DSPHERE` on `location_2dsphere` (the repeated IXSCAN/FETCH are the geo cell scans).
- **Suggest**: restaurants by `name_1` (IXSCAN, limit 5, plus a text-index fallback for whole words inside a name), cuisines by the master `name` index, areas by `address.area_1_isActive_1` as an index-only scan (PROJECTION, 0 docs examined). A case-insensitive anchored regex cannot use tight index bounds, so the index is scanned linearly in keys, never the collection. Upgrade path if the index grows to millions: store a lower-cased name/area field and use a range query.
