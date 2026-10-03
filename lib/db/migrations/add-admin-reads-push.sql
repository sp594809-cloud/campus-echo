-- Additive migration: admin flag, cross-device chat reads, web push subscriptions.
-- Safe to run on existing Campus Echo databases. Review before applying.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS radar_chat_reads (
  user_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES radar_chats(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS radar_chat_reads_user_idx ON radar_chat_reads (user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Promote a specific user to admin (replace USER_ID after first sign-up):
-- UPDATE profiles SET is_admin = true WHERE user_id = 'USER_ID';
