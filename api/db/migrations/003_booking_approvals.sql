-- Booking decisions live in review.booking, preserving existing saved review metadata.
ALTER TABLE plans DROP CONSTRAINT plans_status_check;
ALTER TABLE plans ADD CONSTRAINT plans_status_check CHECK (status IN ('proposed','farmer_accepted_pending_confirmations','rejected','confirmed','declined','expired','unavailable','superseded'));
ALTER TABLE listings DROP CONSTRAINT listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('open','withdrawn','booked'));
ALTER TABLE orders DROP CONSTRAINT orders_remaining_kg_check;
ALTER TABLE orders ADD CONSTRAINT orders_remaining_kg_check CHECK (remaining_kg >= 0);
ALTER TABLE trips DROP CONSTRAINT trips_available_kg_check;
ALTER TABLE trips ADD CONSTRAINT trips_available_kg_check CHECK (available_kg >= 0);
-- Historical acceptance timestamps were not recorded; leave them unknown.
UPDATE plans SET review=jsonb_set(review,'{booking}',jsonb_build_object('buyer','pending','driver','pending','approvalExpiresAt',expires_at)) WHERE status='farmer_accepted_pending_confirmations' AND NOT review ? 'booking';
-- Resolve expired historical acceptances and duplicate active acceptances before indexing.
UPDATE plans SET status='expired' WHERE status IN ('proposed','farmer_accepted_pending_confirmations') AND expires_at <= now();
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY listing_id ORDER BY created_at DESC,id DESC) AS n FROM plans WHERE status='farmer_accepted_pending_confirmations')
UPDATE plans SET status='superseded' FROM ranked WHERE plans.id=ranked.id AND ranked.n>1;
CREATE UNIQUE INDEX plans_one_active_listing ON plans(listing_id) WHERE status IN ('farmer_accepted_pending_confirmations','confirmed');
CREATE INDEX plans_history_idx ON plans(listing_id,created_at DESC,id DESC);
CREATE INDEX plans_order_status_idx ON plans(order_id,status);
CREATE INDEX plans_trip_status_idx ON plans(trip_id,status);
