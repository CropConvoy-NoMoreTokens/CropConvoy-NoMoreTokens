-- Demo identities are fixed for the prototype. Password and bearer-token hashes
-- are populated by the migration runner; neither plaintext value is stored here.
CREATE TABLE demo_users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username = lower(username)),
  role text NOT NULL CHECK (role IN ('farmer', 'buyer', 'transporter')),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE demo_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_sessions_user_idx ON demo_sessions(user_id);
CREATE INDEX demo_sessions_expiry_idx ON demo_sessions(expires_at);
