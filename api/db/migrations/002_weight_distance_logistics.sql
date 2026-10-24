-- P2 handoff: copy into the next api/db migration. This module never executes DDL at runtime.
-- Existing trips remain explicitly legacy and must be republished with a transporter-provided kg-km rate.
ALTER TABLE trips ADD COLUMN rate_per_kg_km_minor bigint
  CHECK (rate_per_kg_km_minor BETWEEN 0 AND 9007199254740991);
ALTER TABLE trips ADD COLUMN pricing_version text NOT NULL DEFAULT 'detour-v0'
  CHECK (pricing_version IN ('detour-v0','weight-distance-v2'));
ALTER TABLE trips ADD CONSTRAINT weight_distance_trip_requires_rate
  CHECK (pricing_version <> 'weight-distance-v2' OR rate_per_kg_km_minor IS NOT NULL);

CREATE TABLE logistics_quotes (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  trip_id uuid NOT NULL REFERENCES trips(id),
  snapshot jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > generated_at),
  CHECK (snapshot->>'quoteId' = id::text),
  CHECK (snapshot->>'listingId' = listing_id::text),
  CHECK (snapshot->>'orderId' = order_id::text),
  CHECK (snapshot->>'tripId' = trip_id::text),
  CHECK (snapshot->>'pricingVersion' = 'weight-distance-v2')
);
CREATE INDEX logistics_quotes_expiry_idx ON logistics_quotes(expires_at);
