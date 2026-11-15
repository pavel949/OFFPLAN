# Media entry repair

Admin and developer uploads validate the whole metadata batch before Storage writes. Admin metadata now includes image classification, preferred cover, ordering and exact-unit/type association. Server actions revalidate unit membership at registration; metadata is visible during Studio moderation. New metadata still follows the existing immediate-admin versus pending-developer publication behavior.

Both clients prevent same-tick duplicate submission and stop replay after any upload/registration error. They retain attempted Storage paths and report confirmed upload counts, possible partial registration and public accessibility. Admin registration reports confirmed publication counts on partial failure. This is a fail-closed recovery safeguard, not transactional uploads or automatic reconciliation. The operator must reconcile those paths and existing evidence before retrying; reloading the page loses client-local recovery information. No uploaded file is deleted or access policy changed.

The existing photo bucket remains public immediately, including pending, rejected, archived and orphaned objects. Moderation/removal controls gallery visibility, not raw-URL access. Private documents must use the existing private document workflow.

Verification: six Node isolated control-flow checks pass (scripts/media-upload-regression.test.mjs). These execute real server action code with mocked dependencies and assert client safeguards; they do not prove React rendering, Supabase RLS or Storage transport behavior. Added Vitest schema regression tests in lib/photo-upload.test.ts, but Vitest cannot run in the partial checkout because dependencies are absent. Full TypeScript, lint, build, browser and authenticated integration checks remain required before merging. The global 400-image catalogue cover cutoff remains unchanged.

## Follow-up: recovery and catalogue coverage

Upload journals now persist allocated paths, captions and metadata before the first Storage write. No file bytes, credentials or signed upload tokens are stored. Journals are scoped to project and admin/partner mode in the current browser; they survive reload. Storage events and a pre-write check prevent ordinary cross-tab overwrites, but this is not a transactional cross-device lock. Browser storage unavailability stops the upload before its first write.

A read-only recovery action rechecks admin authority or authenticated project-owner permission before using the existing server client to list exact Storage names and matching evidence. It reports file found/not found/unknown and matching evidence statuses. Listing errors remain unknown, not absent. Operators can open known public objects and inspect the complete saved manifest. A reconciled journal may be closed only when every file is found and has an evidence record; closing it clears the queued original files, so it never replays the batch.

There is no automatic orphan registration, re-upload, deletion, privacy change, or cross-device recovery. A file found without evidence, missing files, or an unknown result needs operator reconciliation. Exactly-once registration under concurrent requests still requires a database-backed idempotency/transaction design; Storage and database commit remain separate. Browser storage can be cleared by the user and is not a durable server job queue. Those limitations are explicit in the recovery UI.

Catalogue media now uses stable date/ID ordering and paginated reads before preferred-cover selection, eliminating the global newest-400 cutoff. Page errors do not produce a silently partial cover set. Offset pagination does not provide a snapshot across simultaneous publication changes; large catalogues still share the existing timeout behavior.

Follow-up validation: six new Node regression checks pass for >400 images, pagination failures, recovery identity, permission gating, uncertain Storage responses, and persistence-before-upload. Together with the earlier upload control-flow suite: 12 checks passed. Full application CI, rendering, browser storage behavior and authenticated Storage integration still require verification in the complete repository.
