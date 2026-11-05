# Telegram developer price monitor — OFFPLAN

## Goal
Automatically ingest authorized Telegram channel attachments and developer Drive files, extract price lists, compare dated unit inventory snapshots, and offer **reviewed** updates in the existing OFFPLAN admin inventory workflow.

This work belongs to `pavel949/OFFPLAN`, **not** myuno or myUNO-final.

## Initial channels
- @themodevabangtao
- @thetitleheritagebangtao
- @thetitleserenityny
- @coralinakamala
- @vivanakamala
- @theolivenaiyang
- @kirarabangtao

Project-channel binding MUST use canonical `catalog_projects.id`, never the channel display name alone.

## Pipeline and trust boundaries

1. **Acquire:** authorized Telegram client (user-approved MTProto session) or official developer delivery feed. Never embed login codes, API hash or session strings in the repo. Run on a persistent background worker, not Vercel's request process. Respect Telegram access restrictions and developer licensing.
2. **Archive:** store the original immutable attachment in private object storage. Record source URL, channel ID, message ID, upload time, **source publication time**, source version if present, SHA-256, mime type, file size and collection outcome. Deduplicate by channel/message/attachment and hash; do not overwrite previous versions. Check file limits and reject unsafe content.
3. **Extract:** prefer CSV/XLSX cell-level parsing; PDF text/table extraction as available, image/scanned PDF is `needs_review`. Record page/worksheet coordinates and confidence for each extracted fact. A master plan is a **different document type**, not an availability source by default. Do not interpret an arbitrary Telegram image as a price list.
4. **Resolve project:** match canonical project ID; quarantine ambiguous developer/project/building mapping. Identity is (project ID, building ID/code, unit number), not unit number alone. Distinguish physical unit from leasehold/freehold offers.
5. **Validate:** ensure unambiguous unit keys, unique units, source date, price/currency/status, completeness and scope; status `Hold` must not be silently converted to `Reserved` because legacy importer only supports unknown/available/reserved/sold.
6. **Diff:** `lib/monitor/compare.ts` performs a read-only comparison of **normalized** snapshots; captures source version and URLs. Partial files never prove missing lots. Even in two full snapshots, an absent unit is `absent_unconfirmed`, NOT `sold`.
7. **Review:** present source document alongside proposed changes in admin; require authorized operator to approve before applying via existing `runUnitImport` or sales-model versioning. Never write directly to published price/availability, nor update `price_updated_at` just because a file was downloaded.
8. **Publish:** existing sales-model publishing remains a separate explicit action. Preserve immutable snapshots, change log, operator identity and rollback plan.
9. **Report:** daily status of new documents, source failures, price/status changes, added/absent units and pending reviews; no new documents is not a full assertion that inventory is unchanged.

## Integration checkpoints
- Existing inventory importer: `lib/inventory/parse.ts`, `apply.ts`, `run.ts`.
- Existing unit history: `unit_price_history`.
- Existing approved sales publication: `project_sales_models`, public offer constraints.
- Google Sheets master catalog is optionally a **downstream export**; OFFPLAN is the destination application for this feature.
- Start with 7 channels, then extend by configuration rather than hard-coded case logic.

## NOT implemented in this initial change
Telegram login/download, object storage tables/buckets, XLSX/PDF extraction, background scheduler, admin review UI, migrations, Google Sheets sync and production configuration. No live files have been downloaded and no production unit has been changed. These are subsequent implementation steps needing authenticated Telegram access and deployment settings.

## Release gates
- Parser fixtures from actual permitted price lists for Heritage V4 and Serenity V5, plus one partial sales announcement.
- Validate building and project keys, duplicates, stale versions, source scopes and PDFs with missing tables.
- Test idempotent ingestion and retries, status transitions, RLS/private storage, failed attachments, and no public updates prior to review.
- Deploy collector separately with secrets in protected runtime; verify end-to-end read-only ingestion before permitting write actions.
