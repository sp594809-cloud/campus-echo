CREATE TABLE IF NOT EXISTS public.echo_sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echo_sessions_expiry_idx ON public.echo_sessions(expires_at);
ALTER TABLE public.echo_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.echo_sessions FROM anon, authenticated;
