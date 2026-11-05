# Project showcase and media

The public project page puts a short overview and explicit evidence limitation before the gallery and units. Detailed facts, milestones and the full review follow unit selection. Long descriptions remain available below. Existing shared design primitives are retained.

## Media data

Published `project_evidence` photo records can now carry `media_kind` (`photo`, `render`, `masterplan`, `unit_plan`, `type_plan`), `cover`, `sort_order` (integer 0–9999), `unit_id` and `type_label`. This extends existing JSON details; no database migration or seeded assets are needed.

- Historical images without an explicit type remain unclassified, not presumed photographs.
- Cover candidates precede other images; order, observation date and ID break ties deterministically. Plans are never selected as hero backgrounds.
- Unit plans require an actual project-unit ID; type plans require a type name. Server actions check linked unit membership in the project using the authenticated client.
- Exact-unit displays use UUID equality, published status and an allowed image type. A type plan or masterplan does not establish a physical unit's layout. There is no inferred mapping from names.
- Existing gallery metadata edits are new pending records with the same fact key. Existing review logic archives the previous version on approval; partners cannot directly change published records.
- Switching a cover entails unchecking the old image and selecting the new one, then approval. Until both revisions are approved, deterministic ordering handles multiple flags; this is not an atomic gallery-wide revision.
- Uploads still use the public image bucket. The UI explicitly warns about public URLs and publication rights. Private due-diligence documents must not use this uploader.

No actual project image, floorplan, type assignment or unit assignment was invented or imported. Existing published media appear immediately; new mappings require submitted material and moderation. No live-data write, migration, deployment or PR44 change was performed by this feature.

## Verification

TypeScript, ESLint, all unit tests and production build pass. Tests cover published-only media, HTTPS, deterministic ordering, unknown historic classification, exact-unit matching and metadata validation. Browser QA remains required on an accessible preview: the CUA browser could not reach the workspace localhost even with the production server running. Do not describe responsive screenshots, authenticated upload/moderation round trips or real-device checks as passed.

Suggested browser coverage: desktop/narrow RU/EN project order; gallery/open-close keyboard focus; render/plan labels; unknown and missing media; exact-unit-only matching; partner upload/metadata edits and rejection/approval history; long captions and type names.
