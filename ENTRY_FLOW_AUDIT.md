# Project entry audit, 2026-11-05

Baseline: pavel949/OFFPLAN main `89d1a27a6b595687940c7f32667fad50344e6477`.

## Verified defects addressed in this increment

- Bulk unit save did not retain returned database IDs or acknowledge dirty rows. Repeating Save all could insert the same new rows again. A successful earlier row in a partially failed batch is now acknowledged immediately, and concurrent save clicks are blocked.
- Invalid numeric unit input was silently replaced with null. Invalid numbers now produce a validation error before any write; floors and bedroom counts must be integers.
- Saving a non-price change displayed the current date as price freshness even when the database deliberately preserved the old date. The action now returns the persisted date; confirming prices also updates only acknowledged rows in the editor.
- Creating a developer/location while editing a project left the controlled selectors at `__new`. The server now returns canonical IDs and the form selects those records after success, avoiding another create on the next save.

## Isolated verification

`node --test scripts/entry-save-regression.test.mjs`: eight passing checks, no network or live database. Covers retained IDs, partial failure/retry, transport failure, missing ID, unauthenticated privilege boundary, invalid numeric rejection, price freshness, and repeat info save.

The server tests execute the actual action code with imported dependencies stubbed. They do not validate real Postgres policies, storage, React rendering or browser interactions. CI runs these checks on Node 24 in addition to the repository's existing test/lint/build/SQL jobs.

## Remaining boundaries and next increment

- The new-project wizard requires a positive price, unit count and completion year, defaults the first location and a future completion year, and uses editorial rating/risk placeholders. Unknown facts need an explicit product/data-schema treatment rather than forcing guesses.
- Wizard creation, optional publication, and linked developer/location creation are multiple writes, not one transaction. Failure after an earlier write can leave a draft or reference record behind. Idempotent creation and publication recovery remain to be designed and tested.
- The wizard writes developer/location names into payload; linked reference IDs are established later in the operator info form. Developer dossier grouping uses the public developer code, so linkage consistency needs a separate end-to-end fixture.
- Partner draft save preserves developer/editorial fields and checks user, organization and sales-role limits. Moderation snapshots remain separate from published payload; real RLS and pending-review races were not exercised here.
- Commercial model revisions are separate from physical units and publication. Saving a new revision does not publish it; dated evidence, current availability and explicit operator publication are required. Existing repository tests cover these rules but were not run locally in this partial checkout.
- Public projection hides expired legacy prices and uses eligible published THB offers. Unit/editor saves must not be treated as proof that an offer is publicly available.
- Full browser workflow, actual uploads, SQL policy checks, lint, type/build and full Vitest require CI or an authorized complete environment. No customer media, real data mutations, merge or deployment occurred during this audit.

This is a bounded repair increment, not certification that the full modal/project-entry journey is flawless.
