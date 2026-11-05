# Google Drive ingestion: implemented boundary and next steps

## Current implementation

The authenticated admin/partner materials panel resolves an existing `project_sources` row. A partner must own the project under RLS and may not be a sales user. The source must have `sync_enabled` enabled by staff. A platform service account needs read access to the source. This change does not create credentials, grant access, change production configuration, or publish anything.

- Folder discovery follows pagination and actual nested folders. It preserves each file's relative path, ID, MIME type, modification timestamp and optional size.
- Discovery fails instead of presenting a partial inventory when Google reports incomplete results, a child is inaccessible, a page repeats, or limits are exceeded: 1,000 entries, 50 requests, eight nested folder levels. Folder cycles and repeated file IDs are deduplicated. Shortcuts are listed but never followed, so discovery does not escape the selected source tree.
- Inventory import remains Google Sheets (first tab exported as CSV) and CSV/TSV. It uses the existing preview/apply flow. Application re-resolves folder membership before reading the selected file.
- The panel provides a metadata-only JSON review manifest and identifies document, image, video, spreadsheet, shortcut and other MIME classes. Every entry is `pending`, publication is false, and non-inventory content is explicitly `not_extracted`. Filename keywords are not evidence of project facts.
- The list and manifest are returned to the authenticated caller, not persisted to the buyer catalog. Downloading the JSON creates only a local review artifact. Source timestamps are not a claim of current prices or availability.

## Not implemented or verified

This is **not yet the requested complete “folder link → documents, media and verified project facts on the platform” workflow**. In particular:

- No durable import job, scheduled refresh, progress persistence, resumable traversal, or large-folder queue.
- No binary download/storage of renders, PDFs, videos, original Excel/Word/PowerPoint documents; no native Google Docs/Slides export.
- No PDF text/OCR, XLSX parsing, image inspection, plan extraction, thumbnail generation, or structured project-fact extraction.
- No page/cell evidence citations, per-field review/conflict resolution, source-content hash/version tracking, retraction of superseded facts, or publication-rights review workflow.
- Preview and Apply reread the selected file; they do not pin a content hash or database revision. A file or inventory edit between them may change the applied plan. The UI binds a preview to the selected file and prevents switching while importing, but this is not snapshot approval or a transaction.
- No automatic public media links or factual updates. Existing unit-table import is separate and still uses its existing apply behavior.
- No live service-account access or production integration was checked. Mocked API coverage is not proof that a particular developer's folder can be read.

## Feasible next implementation

1. **Private staging storage and job schema:** add source-scoped ingestion runs, file versions keyed by Drive ID + content hash, extraction status and explicit errors. Store originals in a private bucket, with org/project RLS and only expiring authenticated download links. Review migrations and test isolation before deployment.
2. **Bounded binary retrieval:** streaming size limits, timeout/cancellation, malware/content-type validation and supported native-document export. Preserve source folder, Drive file ID, source revision/hash and retrieval timestamp. Support Google resource keys if required; never follow an arbitrary download URL using privileged credentials.
3. **Deterministic text extraction:** PDF text (page anchors), XLSX/CSV (sheet/row/cell anchors), DOCX paragraphs. Scanned PDFs and drawings get `needs_ocr` instead of fabricated facts. Asset classification remains distinct from factual extraction.
4. **Evidence-backed candidate facts:** every value has raw source text, document version and page/cell reference. Missing values remain absent. Distinguish marketing claims, contractual terms and dated price snapshots. Conflicts create review tasks and never overwrite approved facts silently.
5. **Human review and publication:** approve facts and separately verify image/document publication rights. Reuse catalog/material moderation; stage originals privately until explicitly approved. Buyers see the approved version, its sources and freshness, with clear unknowns.
6. **End-to-end fixtures and a scoped real-folder test:** nested folders, >100 files, duplicate names, shared-drive sources, revoked access, moved/deleted files, spreadsheets with multiple tabs, scanned/text PDFs, malformed files, expired availability and repeat imports. A real developer folder and existing approved server access are prerequisites; new persistent credentials/access require separate approval.

Changes to ratings, scoring and unrelated product design are outside this work.
