CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  trial_ends_at       timestamptz,
  stripe_customer_id  text UNIQUE,
  subscription_status text
);

CREATE TABLE login_tokens (
  token_hash  text PRIMARY KEY,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX login_tokens_email_idx ON login_tokens (email, created_at);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- One row per Linear workspace an account has connected (one personal API key each).
CREATE TABLE workspaces (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label             text,
  api_key_encrypted text NOT NULL,
  key_hint          text NOT NULL,
  org_id            text NOT NULL,
  org_name          text NOT NULL,
  org_url_key       text NOT NULL,
  org_logo_url      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- Last-fetched board per account, so the board paints instantly on load.
CREATE TABLE issue_cache (
  user_id      uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload      jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL
);
