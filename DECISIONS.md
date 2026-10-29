
## 2.5.5 Real Indore seed data
- Replaced placeholder samples with `data/restaurants.indore.json` (5 real outlets, see `docs/seed-sources.md`). Kept `data/restaurants.sample.json` because `apps/api/tests/bulk.test.js` runs the seed CLI against it; it contains fabricated placeholder URLs and must not be used for real data.
- `priceForTwo` is required (> 0) by the validator, but no outlet-specific figure could be verified for any of the 5. Used the best indirect figure per restaurant (600/600/400/600/450) and flagged every one in NEEDS VERIFICATION in `docs/seed-sources.md`. These are estimates, not facts; costBracket is derived from them.
- Timings are optional in the schema, but a Yappe (Jan 2024) schedule existed for each, so they were included and flagged as unverified rather than omitted.
- Zomato/Swiggy/Google Maps links left empty (nothing resolved to a page actually read).
- "Shreemaya" is ambiguous in Indore; chose Shreemaya Celebrity (Vijay Nagar).
- Bapu Ki Kutia coordinates are landmark-level (the Prestige college it faces).
- Removed unverified placeholders from Atlas via a throwaway script using the Restaurant model (+ image removal, 0 files): only Vijay Chaat House, Sarafa Bazaar Night Market and Madhuram Sweets were present there (Johny Hot Dog and Joshi Dahi Bada House were not).
