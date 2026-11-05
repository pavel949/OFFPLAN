# ClearView public model: first implementation slice

This change is based on main `1e5a251` and does not change authentication, payment configuration, database schema, scoring parameters, or production data.

## Delivered

- `/methodology`: own-team evaluator identity, approved AV Group rating-partner designation with bounded responsibility, qualitative calculation flow matching `lib/clearview/engine.ts`, distinct incomplete/rejected/rated states, and limits of completeness and version fingerprints.
- `/services`: three commercial directions (sales commission, developer-commissioned review with optional ongoing monitoring, buyer-commissioned audit). Developer price is 49,000 THB; tax, exact scope, timing and third-party costs remain subject to agreement. No price is invented for buyer audit or monitoring.
- Links from footer, methodology and project assessment; sitemap inclusion.
- Removed unused invented service prices and unsupported independent legal-entity claims from ClearView public copy. No partner logo or project-level partner sign-off is asserted.
- Tests cover status semantics against the actual engine and service/partner boundaries.

## Important distinctions

Public questionnaire results remain a checklist, not a rating. Registry L0–L2 review remains a separate workflow with its existing authorization and review rules. This change does not weaken those rules, alter required sign-offs or turn a payment into publication permission. Documents are not automatically shared publicly.

## Remaining implementation, not claimed operational

1. A dedicated service inquiry/case workflow with consent, requested scope and explicit buyer/developer commissioning party. Current links lead to existing catalog, partner workspace or self-check; they do not create service orders.
2. Human-assigned reviewers and scoped engagement acceptance, including confirmed tax treatment, deliverables, deadlines and fees. The partner designation is not a reviewer assignment.
3. Structured evidence per risk item, applicability, source date, verification date, reviewer and missing/expired/disputed states. Never infer missing documents from temporary retrieval failures.
4. Full assessment orchestration pinned to a version/hash and trusted evidence, separate from the public questionnaire and marketing payload.
5. Report drafting, review, explicit document/public-summary publication permission, issue date, expiry, withdrawal and correction lifecycle.
6. Developer monitoring tasks and change detection, with contract frequency and human review before changed conclusions. No recurring billing or automatic monitoring was added.
7. Buyer-specific scope and deliverable permissions; private buyer report does not become a public project rating automatically.

Payment, production migrations, publication, deployment and recurring third-party communications remain separate actions. This slice does not accept money, sign engagements or publish project ratings.
