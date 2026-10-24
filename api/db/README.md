# Database bootstrap

Set DATABASE_URL in api/.env, then run `npm run db:migrate` from api/. The runner applies 001_initial.sql and 002_demo_auth.sql once, in a transaction with a migration lock. It never runs on API startup and never resets records. The second migration inserts the three existing public demo accounts with salted password hashes and creates a table for hashed bearer sessions. Re-running the migration leaves existing accounts and sessions unchanged.

P2 owns schema changes. P3/P4 should send required additions before implementation. Subsequent schema changes require a new migration plus an explicit runner update; do not rewrite an already applied migration.

Neon works with the same PostgreSQL connection string. Create a Neon project, copy its connection string into the ignored api/.env as DATABASE_URL, and run npm run db:migrate. The initial migration creates listings, orders, trips, and plans once. Run npm run db:check to insert two synthetic records, reconnect, verify persistence, and remove only those records. After building the API, npm run api:restart-check also verifies the HTTP endpoints across a server process restart and removes its synthetic rows. /ready checks that all four tables exist. Do not put the connection string in web/ or a VITE_ variable.

Only the three demo users are seeded. There is no listing/order/trip/plan seed yet. contracts/fixtures/happy-path.json contains request inputs, not validated routes. P2/P3 should create an idempotent route seed only after testing a real corridor. A DATABASE_URL activates PostgreSQL for listing/order repositories and bearer authentication; P3 and P4 still own their trip/plan persistence.

pg returns bigint columns as strings. Repositories explicitly convert safe bounded values to numbers; do not enable a global unchecked bigint parser. Map snake_case columns to the camelCase contracts, dates to ISO UTC strings, and confirmed API input to seller_declared storage.
