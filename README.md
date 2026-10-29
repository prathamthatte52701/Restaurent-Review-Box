# Restaurant Review Box

MERN restaurant **review & discovery** platform (starting with Indore, India). Users search and filter restaurants, read/write reviews, then jump out to Zomato / Swiggy / Google Maps. No food ordering.

## Layout
- `apps/api` Express 5 + Mongoose backend
- `apps/web` public site (Vite React)
- `apps/admin` admin panel (Vite React)
- `packages/ui` shared design system (consumed as source)

## Prerequisites
Node 20+, npm 10+. MongoDB is optional in dev: if none is reachable, an in-memory one starts automatically.

## Setup
```
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

## Run
```
npm run dev:api     # http://localhost:5000
npm run dev:web     # http://localhost:5173
npm run dev:admin   # http://localhost:5174
npm run dev         # all three
npm run seed -- --file=./data/restaurants.sample.json --dry-run
```
See `PROGRESS.md` for build notes and `docs/bulk-import.md` for the import schema.
