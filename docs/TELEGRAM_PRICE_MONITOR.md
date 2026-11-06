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

## Admin review

Open **Admin → Project → Inventory → Developer price-list review**. Upload an exported UTF-8 CSV or TSV with `building,unit,price,status,currency` (the last two columns are optional). The shared inventory parser accepts its usual aliases and number formats. This review path additionally requires a building on every row and recognizes `Hold` separately from `Reserved`. Use one row per physical unit and confirm the project and scope before registering the file. Files are limited to 256 KiB and 500 rows. XLSX/PDF must first be exported or transcribed into this format.

Enter the source link, developer's version, Phuket publication time and a consistent scope for comparable lists. Select full coverage only for a complete list within that scope. The queue shows the source and original alongside a comparison with the immediately preceding publication in the same project and scope. An older upload is marked historical. Matching publication times block the diff when they make the order ambiguous. An absent unit is flagged only between full snapshots with the same scope, and always requires verification.

The monitor reuses the existing private `project-docs` bucket, `project_documents` table and admin session. Original bytes are stored by project, scope and SHA-256. An exact repeated submission reuses its registration. A separately dated or versioned manual reissue can have its own registration while sharing identical bytes. Retry the same submission after a temporary error to finish registration without replacing an existing original. The metadata and normalized snapshot are stored in the document record. Signed download links expire after five minutes. No schema changes are needed.

This workflow shares the existing import parser and ends at review. It makes no writes to `project_units`, `unit_price_history` or `project_sales_models`. The ordinary inventory import and explicit sales-model publication remain separate workflows. Map projects, buildings and lot identifiers explicitly before adding any handoff to the write path. In particular, the inventory writer has no `Hold` status.

## Future collector

`PriceListCollector` in `lib/monitor/intake.ts` provides a server-side async iterable of files, including the canonical project ID, stable scope, source metadata and Telegram channel/message/attachment IDs. A trusted worker can pass each yielded file to `registerPriceList`. Bind channels to project IDs in trusted configuration before invoking intake. Direct Telegram access, scheduling, XLSX/PDF extraction and any write or publication from the review screen are outside this stage. No Telegram session or live attachment retrieval is configured.

## Release gates
- Parser fixtures from actual permitted price lists for Heritage V4 and Serenity V5, plus one partial sales announcement.
- Validate building and project keys, duplicates, stale versions, source scopes and PDFs with missing tables.
- Test idempotent ingestion and retries, status transitions, RLS/private storage, failed attachments, and no public updates prior to review.
- Deploy collector separately with secrets in protected runtime; verify end-to-end read-only ingestion before permitting write actions.
