-- P2 owns this schema. SQL uses snake_case; repositories map to API camelCase.
-- No auth/user tables: these UUID identities are synthetic demo actors.
CREATE TABLE listings (
  id uuid PRIMARY KEY,
  demo_farmer_id uuid NOT NULL,
  crop text NOT NULL CHECK (crop IN ('tomato', 'potato', 'carrot')),
  quantity_kg integer NOT NULL CHECK (quantity_kg > 0),
  pickup_lat double precision NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng double precision NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  ready_at timestamptz NOT NULL,
  min_net_minor bigint NOT NULL CHECK (min_net_minor BETWEEN 0 AND 9007199254740991),
  seller_declared boolean NOT NULL DEFAULT true CHECK (seller_declared),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  demo_buyer_id uuid NOT NULL,
  crop text NOT NULL CHECK (crop IN ('tomato', 'potato', 'carrot')),
  remaining_kg integer NOT NULL CHECK (remaining_kg > 0),
  price_per_kg_minor bigint NOT NULL CHECK (price_per_kg_minor BETWEEN 1 AND 9007199254740991),
  delivery_lat double precision NOT NULL CHECK (delivery_lat BETWEEN -90 AND 90),
  delivery_lng double precision NOT NULL CHECK (delivery_lng BETWEEN -180 AND 180),
  deadline_at timestamptz NOT NULL,
  allows_partial boolean NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  demo_transporter_id uuid NOT NULL,
  start_lat double precision NOT NULL CHECK (start_lat BETWEEN -90 AND 90),
  start_lng double precision NOT NULL CHECK (start_lng BETWEEN -180 AND 180),
  end_lat double precision NOT NULL CHECK (end_lat BETWEEN -90 AND 90),
  end_lng double precision NOT NULL CHECK (end_lng BETWEEN -180 AND 180),
  departure_at timestamptz NOT NULL,
  available_kg integer NOT NULL CHECK (available_kg > 0),
  route_geojson jsonb NOT NULL CHECK (route_geojson->>'type' = 'LineString'),
  route_distance_m double precision NOT NULL CHECK (route_distance_m > 0),
  route_duration_s double precision NOT NULL CHECK (route_duration_s > 0),
  route_provider text NOT NULL,
  route_profile text NOT NULL,
  corridor_m integer NOT NULL CHECK (corridor_m > 0),
  max_extra_distance_m integer NOT NULL CHECK (max_extra_distance_m >= 0),
  max_extra_time_s integer NOT NULL CHECK (max_extra_time_s >= 0),
  base_minor bigint NOT NULL CHECK (base_minor BETWEEN 0 AND 9007199254740991),
  per_km_minor bigint NOT NULL CHECK (per_km_minor BETWEEN 0 AND 9007199254740991),
  handling_minor bigint NOT NULL CHECK (handling_minor BETWEEN 0 AND 9007199254740991),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE plans (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  trip_id uuid NOT NULL REFERENCES trips(id),
  quantity_kg integer NOT NULL CHECK (quantity_kg > 0),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'farmer_accepted_pending_confirmations', 'rejected')),
  quote_snapshot jsonb NOT NULL,
  review jsonb NOT NULL,
  trace jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_crop_status_idx ON orders(crop, status);
CREATE INDEX trips_departure_status_idx ON trips(departure_at, status);
CREATE INDEX plans_listing_idx ON plans(listing_id);
