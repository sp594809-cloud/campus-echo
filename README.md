# Campus Echo

A text-only campus social app: a nearby anonymous feed, polls and post replies, public campus chat, consent-based private chat, and an opt-in 100-meter GPS Radar.

## Authentication

Campus Echo uses **email + password only** (Supabase Auth). There is no Google/OAuth or phone login in the app. Enable Email provider in the Supabase dashboard; disable other providers if you want a strict match.

## Where to find chatting

Sign in, then select **Chat** in the bottom navigation. **Campus chat** is the shared conversation for people within the campus geofence. **Private chats & Pings** opens incoming requests and accepted private conversations. You can use an accepted private chat with Radar visibility off. **Feed** contains notes, questions, confessions, polls, votes and replies. No user photo or media uploads are supported.

## Configure the existing services

The export includes source code and schema, but does not include the Replit database contents or account secrets. Use the Campus Echo Supabase PostgreSQL database and Supabase Auth.

1. Install Node.js 24 and pnpm 11 or newer. Run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` from the Supabase Session pooler. The four public Supabase settings are supplied in `.env.example`. Keep `.env` private.
3. Run `pnpm db:push` against a local/development database. Inspect the proposed changes before applying them to an existing production database. New/updated tables include `discussions`, `discussion_reports`, `radar_chat_reads`, `push_subscriptions`, and `profiles.is_admin`. On existing databases run `lib/db/migrations/add-admin-reads-push.sql`. Authorization remains in the Express backend (email + password via Supabase).
4. Ensure the database has a campus hub. To add/update one, run `pnpm seed:campus "Your campus" "Your city" "India" LATITUDE LONGITUDE`, using the real campus-center coordinates. Existing campus hubs can remain. This does not seed fake users or fake messages.
5. Configure Supabase Auth Site URL and permitted redirects for the local and deployment domains. The current access policy is any signed-in user within 2 km of a hub; academic-email verification is a profile status rather than an access gate.

## Development

Run `pnpm dev:api` and `pnpm dev:web` in separate terminals. API defaults to port 5000 and web defaults to 5173. The web dev server proxies `/api` and `/ws` to the API. Override `API_PROXY_TARGET` if the backend is on another port. `.env` is loaded for the API and the web build; frontend variables must begin with `VITE_`. Do not put secrets in frontend variables.

## Production

Run `pnpm build`, then `pnpm start`. The API serves the built web app, API and WebSockets on the same port. Configure HTTPS and forward WebSocket upgrades to `/ws`; GPS requires a secure context on phones. `APP_ORIGIN` allows explicit comma-separated origins if using a separate frontend host. Rebuild the frontend after changing its Supabase URL or publishable key. When using Replit Secrets instead of `.env`, set the same environment values there.

The generated initial SQL migration is at `lib/db/drizzle/0000_campus_echo.sql` for a **new** database. Do not run the full initial migration over existing tables. For an existing database, use the additive scripts under `lib/db/migrations/` after reviewing them, or use Drizzle's reviewed schema update.

## Verification

`pnpm run typecheck` checks all packages. `pnpm build` builds the API and real app. `pnpm test` exercises the actual API route/service code against isolated PGlite (PostgreSQL compiled to WASM), and renders the navigation/chat components with React server rendering. Test authentication is replaced only in test bundles; production requires verified Supabase authentication and has no test login bypass.

**Still recommend before campus launch:** test Supabase email/password sign-in, GPS on two physical phones over HTTPS, and Web Push after setting VAPID keys. Apply migration `lib/db/migrations/add-admin-reads-push.sql` on existing databases.

## Operational limits

* Public chat and post replies expire after 24 hours; expired parent posts cascade their replies. Private Radar chats keep their existing retention behavior.
* Radar is opt-in. Coordinates are checked server-side; clients receive broad distance bands and direction, not other users' coordinates. GPS is approximate and does not identify a room or seat.
* Presence refreshes with a new location fix about every 30 seconds while visible. Stale presence expires within 90 seconds. Hide mode and backgrounding stop visibility; network failures can delay server removal until expiry.
* Private chats and Pings use authenticated WebSockets with polling fallback. Public chat/replies use campus event notifications plus five-second polling fallback. Public SSE relies on same-origin session cookies; bearer-only environments fall back to polling.
* Vibration is best-effort. In-app Ping alerts are provided. **Closed-app Web Push** is implemented when VAPID keys are set (see .env.example).
* Public chat/replies limit each user to ten new messages per minute; private messages retain their existing rate limit. Reporting uses one report per user per message and hides messages after five distinct reports. **Admin moderation** is at `/admin` for users with `profiles.is_admin = true`.
* **Cross-device read receipts** for private chats are stored server-side in `radar_chat_reads`.
* Event fan-out is in-process by default. Set `REDIS_URL` (and install `redis`) for multi-instance feed fan-out.

## Deploy on Render

Use the repository root and `render.yaml`. The Blueprint selects paid Starter compute; review the displayed Render price before deploying. Singapore is the Render server region; the Supabase database is in Mumbai. Build: `corepack enable && corepack prepare pnpm@11.25.0 --activate && pnpm install --frozen-lockfile && pnpm build`. Start: `pnpm start`.

Supabase project: `rztexnwjsmlofmlelovq`. Its 18 tables are already installed, with RLS enabled and browser roles denied access. No browser RLS policies are intentional: Supabase-authenticated requests use the server routes. Do not run `db:push` automatically at deployment.

Set `DATABASE_URL` using Supabase Connect → Session pooler, with your password URL-encoded and TLS certificate verification enabled (`sslmode=verify-full`). The Blueprint supplies the public Supabase URL and publishable key; Vite variables are required at build time. In Supabase Authentication → URL Configuration, set Site URL to the Render HTTPS app URL and allow the exact home and `/sign-in` redirect URLs. Enable email/password sign-in and email confirmation; configure SMTP for delivery to students. Never put these secrets in GitHub.

After deploy, add the real campus center using `pnpm seed:campus`, and verify sign-in, posts, and chat on two devices. The Sites demo remains a separate simulation until a real backend is deployed.

## Completions (2026-10)

- Email/password-only auth (no OAuth in app)
- Cross-device chat read receipts (`radar_chat_reads`)
- Admin moderation UI at `/admin`
- Web Push infrastructure (VAPID)
- Optional Redis multi-instance feed fan-out
