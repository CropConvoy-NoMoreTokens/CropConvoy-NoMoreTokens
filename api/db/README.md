# Database bootstrap

Set DATABASE_URL in api/.env, then run `npm run db:migrate` from api/. The runner applies 001_initial.sql once, in a transaction with a migration lock. It never runs on API startup and never resets records.

P2 owns schema changes. P3/P4 should send required additions before implementation. Subsequent schema changes require a new migration plus an explicit runner update; do not rewrite an already applied migration.

There is no database seed yet. contracts/fixtures/happy-path.json contains request inputs, not validated routes. P2/P3 should create an idempotent seed only after testing a real corridor. A DATABASE_URL alone does not switch the current repositories from memory to PostgreSQL.

pg returns bigint columns as strings. Repositories must explicitly convert safe bounded values to numbers; do not enable a global unchecked bigint parser. Map snake_case columns to the camelCase contracts, dates to ISO UTC strings, and confirmed API input to seller_declared storage.
