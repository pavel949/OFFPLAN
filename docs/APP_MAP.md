# OFFPLAN (phuket-offplan) — route map and functionality

Dev server: **`http://localhost:3030`** (`npm run dev` in this folder or `npm run dev` from repo root).

## Route map (App Router)

```mermaid
flowchart TB
  subgraph public [Public]
    home["/ — Catalogue"]
    proj["/project/[slug] — Project detail"]
    acct["/account — Favorites list"]
  end
  subgraph partner [Partner Supabase auth]
    plogin["/partner/login"]
    phome["/partner"]
    pproj["/partner/projects"]
    pedit["/partner/projects/[projectId] — Draft JSON"]
    pinv["/partner/projects/[projectId]/inventory"]
    pupd["/partner/projects/[projectId]/updates"]
    pcamp["/partner/projects/[projectId]/campaigns"]
    pcorr["/partner/corrections"]
  end
  subgraph admin [Admin cookie session]
    ahome["/admin"]
    acat["/admin/catalog"]
    aproj["/admin/projects"]
    aprojid["/admin/projects/[id]"]
    aleads["/admin/leads"]
    aleadid["/admin/leads/[id]"]
    amod["/admin/moderation"]
    amodid["/admin/moderation/[id]"]
    aset["/admin/settings"]
    aingest["/admin/ingest/whatsapp"]
    acorr["/admin/corrections"]
    adeals["/admin/deals"]
  end
  home --> proj
```

## What each area does

| Area | Purpose |
|------|--------|
| **/** | Main catalogue (`CatalogueShell`): filters, shortlist, tabs (analytics/risk/devs/services/calc from `content/html-tabs/`), lead modal, optional favorites sync to DB when logged in. |
| **/project/[slug]** | Single project: lead form, optional REC labels (`NEXT_PUBLIC_SHOW_PROJECT_REC`), units/campaigns/updates from Supabase, email subscribe MVP, product analytics `project.view`. |
| **/account** | Logged-in user email + list of favorite `project_id` (UUIDs). |
| **/partner/** | Developer org: edit project JSON draft, submit moderation, inventory (units), news/construction updates, launch/sale campaigns, correction requests. Roles: `partner_role` owner vs sales (sales: no JSON/campaign edit). |
| **/admin/** | IE back office: catalog import/settings, projects, leads (unified store + optional AI summary), moderation queue, WhatsApp ingest, corrections, deals, platform settings. Auth via `ADMIN_SECRET` cookie. |

## API routes (`app/api`)

| Path | Role |
|------|------|
| `POST /api/analytics/public` | Same-origin product events (`project.view`, etc.) → `analytics_events`. |
| `POST /api/analytics/event` | Server ingest with `ANALYTICS_INGEST_SECRET`. |
| `POST /api/webhooks/stripe` | Stripe signature verify; optional `billing_customers` upsert from Checkout metadata. |
| `POST /api/ai/lead-summary` | Lead summary (admin tooling). |

## Server actions (`app/actions`)

| Module | Main actions |
|--------|----------------|
| `leads.ts` | Public lead submit; admin list/get/update leads. |
| `favorites.ts` | Toggle favorite by legacy project id (logged-in). |
| `project-subscribe.ts` | Subscribe/unsubscribe to project updates (email channel MVP). |
| `partner-marketplace.ts` | Confirm inventory date, CRUD units, project updates, campaigns; audit log side effects. |
| `partner.ts` / `moderation.ts` | Partner draft save, moderation submit; sales blocked from JSON + moderation submit. |
| `admin.ts`, `admin-auth.ts`, `admin-brain.ts` | Admin catalog, settings, AI brain helpers. |

## Data layer (Supabase)

- **orgs**, **profiles** (roles: admin, editor, partner, buyer; `org_id`, `partner_role`).
- **catalog_projects** (payload JSON, moderation, geo, `data_confirmed_at`).
- **project_units**, **sales_campaigns**, **project_updates**, **project_subscriptions**, **favorites**, **leads**, **deals**, **moderation_submissions**, **correction_requests**, **analytics_events**, **org_webhook_endpoints**, **billing_customers**, **catalog_audit_log** (see migrations in `supabase/migrations/`).

## Middleware

All non-static routes run **`updateSession`** (Supabase SSR cookies; session refresh on response only — Next.js 15 safe pattern).

## Cursor / VS Code: preview inside the editor

The embedded preview often lags behind a normal browser for Next.js (HMR, localhost). To open the app **inside Cursor**:

1. Start the dev server (`npm run dev`).
2. **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **“Simple Browser: Show”** (VS Code built-in).
4. Enter: **`http://localhost:3030`**

If Simple Browser stays blank, use the external browser for debugging; keep Simple Browser for quick checks. Cursor’s separate **Browser** / MCP tools (if enabled) also accept the same URL.
