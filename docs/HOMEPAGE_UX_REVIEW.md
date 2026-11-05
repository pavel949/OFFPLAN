# Homepage UX review

## Observed on production after PR42
The first page loaded 148 projects but rendered 24 cards before decision support. The 520px discovery hero pushed filters below the initial desktop viewport; mobile stacked the copy and image before search. A legal-help strip, large protection banner, official-status card and footer repeated related institutional content. Developer directory, country expansion, news and guides competed after a long catalogue. A full hero also preceded direct map/search URLs. These are hierarchy findings, not engagement metrics.

## Implemented sequence
1. Compact project-media introduction, concrete Russian-language task copy, CTA to search rather than past the filters. Existing labeled developer media only.
2. Search, filters and catalogue. Six initial cards, explicit expansion; active-filter results start at24. All projects remain available. Initial direct search/map links skip the promotional hero; an in-session filter change retains layout stability.
3. Three decision-support cards: compare location/developer, inspect sources/questions, clarify a specific offer. Distinguish self-check from rating and inquiry from reservation.
4. Up to three actual project updates when available, with dates including year and developer-source caveat.
5. Three practical buying guides.
6. One compact help block, then existing footer.

Removed homepage-only duplication, not service availability: dedicated developers, locations, countries and protection pages remain linked through navigation/decision support. No pricing, score, source, map or backend logic changed. No new images or dependencies introduced.

## Acceptance and limitations
Lint, TypeScript, unit/contract tests and production build are required. Existing live before screenshots16–26 document desktop/narrow layout. New candidate requires preview or post-authorized-release visual acceptance, especially six-card progression, search anchor, direct map/query context, browser back, and narrow reading order. A database-less preview cannot establish real catalogue visual acceptance. Responsive browser zoom is not physical-device testing; field performance and engagement are not measured.
