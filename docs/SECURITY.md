# Security & compliance notes

## Database (RLS) — enforced by `supabase/tests/run.sh` in CI
- Roles live in `profiles` and can only be changed by an admin or by trusted server code (service role). Trigger `profiles_guard`.
- Partners may only write `draft_payload` and `data_confirmed_at` on `catalog_projects`; publishing = moderation. Trigger `catalog_projects_guard`.
- Helpers `is_staff()`, `is_admin()`, `has_pending_submission()` are `SECURITY DEFINER` to avoid RLS recursion.
- Leads are inserted only by server code (captcha + rate limit + consent), never directly with the anon key.
- Public pages read through the **anon** client, so RLS is the real boundary for anonymous traffic.

Run locally: `PGHOST=… PGUSER=postgres supabase/tests/run.sh` (scratch database, plain Postgres).

## Required production configuration
| Variable | Purpose |
|---|---|
| `ADMIN_SECRET` (≥16 chars) | admin panel login (rate-limited) |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | captcha on lead form (verification fails closed when the secret is set) |
| `RESEND_API_KEY`, `NOTIFY_FROM`, `LEAD_NOTIFY_EMAIL` | new-lead email to the sales team |
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, sitemap, OpenGraph |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_EMAIL` | data controller shown on /privacy |
| `NEXT_PUBLIC_SHOW_PROJECT_REC` | keep **unset/false** until counsel approves publishing BUY/WATCH/AVOID; when off the labels and notes are stripped server-side |

## Webhook signature (partners verify)
`X-OFFPLAN-Signature: sha256=HMAC_SHA256(secret, "<X-OFFPLAN-Timestamp>.<raw body>")`; reject timestamps older than 5 minutes. Only public `https` endpoints are called; 3 attempts with backoff.

## Known limits (not solved by code alone)
- Rate limiting is per instance; add Vercel Firewall rules for `/admin`, lead form and `/api/analytics/*`.
- Admin is still a single shared secret (no per-user identity ⇒ audit `actor_id` is null for admin actions). Move to Supabase Auth + MFA.
- `/privacy` is a template and must be reviewed by counsel before launch.
