-- P2 handoff ONLY when the earlier hybrid-v1 integration.sql was already migrated.
-- For a fresh starter database use integration.sql instead. Do not run both.
-- No old rate is converted: LKR/km and LKR/kg/km are different units.
ALTER TABLE trips ADD COLUMN rate_per_kg_km_minor bigint
  CHECK (rate_per_kg_km_minor BETWEEN 0 AND 9007199254740991);
ALTER TABLE trips DROP CONSTRAINT trips_pricing_version_check;
ALTER TABLE trips ADD CONSTRAINT trips_pricing_version_check
  CHECK (pricing_version IN ('detour-v0','hybrid-v1','weight-distance-v2'));
ALTER TABLE trips ADD CONSTRAINT weight_distance_trip_requires_rate
  CHECK (pricing_version <> 'weight-distance-v2' OR rate_per_kg_km_minor IS NOT NULL);

-- Retain historical quotes, but permit only an explicit supported version.
-- The old unnamed pricingVersion CHECK has a generated name; select exactly that CHECK.
DO $$
DECLARE old_check record;
BEGIN
  FOR old_check IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='logistics_quotes'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%pricingVersion%'
  LOOP
    EXECUTE format('ALTER TABLE logistics_quotes DROP CONSTRAINT %I', old_check.conname);
  END LOOP;
END $$;
ALTER TABLE logistics_quotes ADD CONSTRAINT logistics_quote_pricing_version
  CHECK (snapshot->>'pricingVersion' IN ('hybrid-v1','weight-distance-v2'));
-- Republish existing trips with a transporter-provided kg-km rate and new pricing_version.
-- Old quotes remain historical and getQuote rejects them with PRICING_VERSION_CHANGED.
