# Partner lead operations and showcase metrics

Apply `20261105120000_partner_lead_performance.sql` before deploying the UI. No production data was modified during implementation. Confirm backup and migration approval according to the release process.

- Partners see only leads of their organisation's projects through existing RLS. Project filtering does not bypass this boundary.
- Claim is atomic and cannot overwrite another assignee. A responsible person updates status and explicitly records a first response. That person or the company owner can release responsibility. Another member can then claim it.
- First response is the server timestamp of an explicit operator attestation, not inferred from status, email, webhook or a click on a contact link. Repeated attestation preserves the first timestamp. Older responses are unknown, not backfilled.
- The read-only aggregate RPC resolves the caller's organisation server-side and returns counts only, never event payloads, visitors or contacts. No direct raw analytics read or new lead update privileges are granted.
- Metrics cover a rolling 30-day period. View and inquiry-form opening events are non-unique and best effort. The two general inquiry buttons on a project page now emit the existing `project.cta_click` event. This does not cover catalogue requests, unit-offer form openings, or all possible expressions of interest. Collection starts on deployment; no synthetic/backfilled events are created.
- Lead counts come from durable leads, not potentially lost analytics events. Response metrics use the cohort of leads created during the period, with median response registration delay only among those with an explicit response timestamp. No visitor conversion or delivery claims are inferred.
- Email/provider acceptance and webhook delivery outcomes are not persisted by the current notification path. The cabinet explicitly labels delivery unconfirmed. The database lead remains the source of truth; notification failures do not remove it.

Validation: unit tests cover action validation and unknown/zero response durations. SQL regression checks cover organisation scoping, buyer/anonymous rejection, own-lead claims, explicit responses versus statuses, repeated responses and metric aggregation. `supabase/tests/run.sh` runs them before legacy tests broaden grants. Only execute this runner against an isolated disposable database: it drops/recreates its target.
