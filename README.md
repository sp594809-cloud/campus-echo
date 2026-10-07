# Campus Echo — public anonymous chat

Enter an email and receive an automatically generated alias. There is no password, OTP, username selection or location prompt. All members share the public text chat. Reports, blocking and message rate limits are retained. Public messages retain their existing 24-hour expiry.

Instant entry creates a browser identity, not a verified email account. The email is validated but not saved, and cannot recover or impersonate an existing identity. The server issues a random 256-bit HttpOnly, SameSite cookie, stores only its SHA-256 hash, and expires it after 30 days. Leaving revokes the session. Existing Supabase sessions continue to work for existing members and moderators.

Before deploying elsewhere, apply `supabase/migrations/20261007162000_instant_echo_sessions.sql`. The sessions table is server-only with RLS and no client grants. Keep the existing DATABASE_URL on the server. No new signing secrets or Supabase auth settings are required.

Run `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`. Render uses the existing build and start commands.

# Campus Echo

Anonymous text conversations, a campus feed, polls, public chat, and private invite-only groups. Students see aliases rather than account names. GPS and nearby Radar endpoints are disabled; the browser is denied geolocation permission by the response policy.

## Privacy and moderation

An alias is anonymous to other members. This is not an untraceable or end-to-end encrypted messenger: the authenticated service keeps account and moderation records. Each group assigns its own alias. Ordinary group responses never expose account IDs, emails, or invite hashes. Blocking, reporting, owner member removal, and administrator moderation are available. Existing private conversations remain accessible under Chat.

## Groups

Create a group, copy its invite, and share it with people you choose. Invitations use random tokens stored as hashes; owners can rotate them. Members can read and send messages, leave, report, and block. Owners can remove members or delete a group. Removed members cannot rejoin with an invite. Messages allow 2,000 characters; sending is limited to 15 messages per minute across groups. History uses cursor pagination and polling. Group messages persist until deleted; public posts and chat retain their 24-hour expiry.

## Setup

Use Node.js 24 and pnpm 11. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, and supply the Supabase Session-pooler `DATABASE_URL` with TLS verification. Supabase email/password authentication must be enabled. Configure the deployment origin and permitted authentication redirects. Never commit secrets or place database credentials in Vite variables.

For a new database, review the initial migration under `lib/db/drizzle/` and the additive migrations. For an existing database, apply `lib/db/migrations/add-admin-reads-push.sql` and `supabase/migrations/20261004094512_anonymous_groups.sql`. These add the missing admin flag, private-chat reads, push subscriptions, and group tables. Group tables use RLS and deny direct browser-role access; Express routes verify authentication and membership. Do not run destructive schema synchronization automatically during deployment.

## Development and deployment

Run `pnpm dev:api` and `pnpm dev:web` separately. Vite proxies API and WebSocket requests to Express. Run `pnpm build` then `pnpm start` for production; Express serves the built frontend and API on the same port. Existing Render configuration is in `render.yaml`. The connected Supabase project is `rztexnwjsmlofmlelovq`. Optional push notifications require VAPID configuration and explicit user permission; Redis supports multi-instance event fan-out.

## Verification

`pnpm test` exercises production route and service code against isolated PGlite, renders navigation and chat UI, and checks authentication configuration and database timeout handling. It covers group membership, invitations, authorization, message history, reporting, blocking, rate limits, private chat and WebSocket access, and retired location endpoints. `pnpm build` includes TypeScript checks and production builds. Test authentication is confined to test bundles; the production API requires verified Supabase authentication.

Before a wide launch, also verify real email confirmation and a signed-in conversation on physical phones. Automated isolated tests do not establish live email delivery or device-specific rendering.
