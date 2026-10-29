# Seed data sources - data/restaurants.indore.json

Researched 2026-10-30 with web search/fetch. Third-party directory data (Yappe, last-updated Jan 2024) - NOT confirmed by the outlets. No Zomato/Swiggy/Google Maps URLs are included: Swiggy returned 403 to curl and an empty page to WebFetch, Zomato pages never surfaced, so nothing could be resolved to a page actually read. Coordinates: OSM Nominatim (UA `RestaurantReviewBox/0.1 (dev)`), all inside lat 22.68-22.78 / lng 75.80-75.93. Old placeholder sample (`restaurants.sample.json`, fabricated URLs) is kept only because `apps/api/tests/bulk.test.js` uses it.

| # | Restaurant | Sources |
|---|---|---|
| 1 | Shreemaya Celebrity (Vijay Nagar) | Address/phone/hours/categories: https://yappe.in/madhya-pradesh/indore/shreemaya-celebrity/53683 . Coords: Nominatim node "Shreemaya Celebrity" (22.7398432, 75.8924874). Price: Swiggy listing snippet (~Rs 600 for two) seen only via search results, page itself not readable. |
| 2 | Bapu Ki Kutia - Vijay Nagar | Address, phone, website, Instagram, email, "pure vegetarian North Indian": official https://www.bapukikutia.in (fetched). Hours 11:00-23:00 + cuisines North Indian/Punjabi: https://yappe.in/madhya-pradesh/indore/bapu-ki-kutia/113134 . Coords: Nominatim "Prestige Institute of Management and Research" (landmark the address says it is opposite) - APPROXIMATE. |
| 3 | Domino's Pizza - Sayaji Circle, Vijay Nagar | Address/hours/categories: https://yappe.in/madhya-pradesh/indore/domino-s-pizza/1788478 . Coords: Nominatim node "Domino's, Sayaji Circle" (22.7524151, 75.8910855). Price: Swiggy snippet (Rs 400, via search). |
| 4 | Pizza Hut - Malhar Mega Mall, Vijay Nagar | Address/phone/hours: https://yappe.in/madhya-pradesh/indore/pizza-hut/348356 . Coords: Nominatim node "Pizza Hut, Malhar Mega Mall" (22.7447525, 75.8947744). Price: placeholder (see below). |
| 5 | McDonald's - Malhar Mega Mall, Vijay Nagar | Address/phone/hours (Wed opens 11:30): https://yappe.in/madhya-pradesh/indore/mcdonald-s/49614 . Coords: Nominatim "McDonald's, Service Road" at Malhar Mega Mall (22.7453457, 75.8943168). Price: https://www.eazydiner.com/indore/mcdonald-s-indore-662123 (Rs 450 - a DIFFERENT Indore outlet, Treasure Island). |

## NEEDS VERIFICATION

| Restaurant | Field | State | Why |
|---|---|---|---|
| ALL 5 | priceForTwo | **Placeholder-grade** (600 / 600 / 400 / 600 / 450 in order above) | Validator requires > 0. Bapu Ki Kutia: no Indore figure found (600 chosen from sibling Bhopal outlets Rs 600-800). Pizza Hut: Rs 600 is EazyDiner's generic chain figure from other cities. McDonald's: other outlet. Shreemaya/Domino's: Swiggy snippet only. See DECISIONS.md |
| ALL 5 | costBracket | derived from the above | "mid" for all |
| ALL 5 | Hours | Yappe Jan 2024 | Not confirmed by outlet; Pizza Hut/Domino's/McD hours differ between Yappe pages (e.g. Domino's other page says 10:00-23:00) |
| ALL 5 | zomatoUrl, swiggyUrl, mapsUrl | empty | Not resolvable to a page actually read |
| Shreemaya | contactPhone | +91 96300 66656 (Yappe) | A search summary of Trip.com showed +91 96300 66646 - conflict |
| Shreemaya | Which "Shreemaya" | Celebrity, Vijay Nagar chosen | Several unrelated "Shreemaya" businesses in Indore (Hotel Shreemaya RNT Marg, Shreemaya Residency AB Rd, Shreemaya Celebration Bijalpur); Celebrity was the only one with a restaurant listing, rating and OSM node. Confirm this is the intended one |
| Shreemaya | type=veg, cuisines, category | from Yappe categories (Vegetarian, Bakery, Chinese, South Indian, Fast food, Fine dining) | |
| Bapu Ki Kutia | Coordinates | landmark-level (~tens of metres off) | No OSM POI for the restaurant |
| Bapu Ki Kutia | Other outlets | not seeded | Sapna Sangeeta (Sneh Nagar) outlet exists; Onam Plaza "coming soon" |
| Domino's | contactPhone | empty | Only the national helpline 1800 208 123 was listed, not an outlet line |
| Domino's | Outlet choice | Two Yappe listings (Shagun Arcade, AB Rd vs Prime House, Sayaji Circle) | Sayaji Circle chosen because OSM has a matching node |
| Pizza Hut | Outlet status | open? | magicpin showed a conflicting "shutdown" for the Malhar store |
| Pizza Hut, McD, Domino's | type=both, amenities (Takeaway, Home Delivery) | from Yappe categories | |
| Bapu Ki Kutia | description | one line from official site | |
