# OFFPLAN shared design system

## Direction
A quiet property-research workspace: generous editorial imagery for discovery, compact legible facts for decisions. Warm neutral canvas, near-black ink, one restrained green action color. No decorative financial dashboards, fake verification, animated prices or scroll hijacking.

## Source of truth
- `app/system-tokens.css`: semantic colors, typography, spacing, radii, control size and motion.
- `components/ui/index.tsx`: Button, ActionLink, Surface, PageIntro, SectionHeading, FactList, StatusLabel, PriceBlock, MetricCard and Disclosure.
- `components/ui/system.css`: shared component styles and compatibility adapters. Existing IE/CV selectors remain during migration; do not introduce new page-specific colors or duplicate primitives.
- `/design-system`: noindex, database-independent living reference including missing-data and disabled states. Sample figures are explicitly demonstrations.

Current consumers: catalogue hero and property prices; project price/fact sidebar and evidence disclosures; assessment and analytics page introductions. Existing application forms and navigation inherit shared control, focus, surface and type tokens through adapters. Future pages compose these primitives rather than copy page markup. Domain logic remains outside UI primitives.

## Rules
Use semantic tokens, not literal colors in feature code. Use 4/8/12/16/24/32/48/64 spacing; 8px control and 16px surface radii. Minimum comfortable control height is 44px. Body copy uses Manrope; editorial display alone uses Cormorant. Numeric prices are tabular, with currency visible. Unknowns use words, never zero. Status color always accompanies a text label. Key facts use dl/dt/dd; comparisons use tables.

Images come only from existing published project media. Preserve visualization/material labels and project identity; do not invent photography or imply a render is completed construction. No additional stock imagery or asset license assumptions were introduced. The editorial hero is stable while filtering and disappears if no actual image exists.

Native scrolling is preserved. Small feedback transitions are 140ms and panel transitions 220ms. Optional view-timeline enhancement must never hide content when unsupported. Reduced-motion users receive no entrance/transform motion. No new animation dependency, video background or scroll listener was added. Keyboard focus is visible; native details retain keyboard and no-JavaScript support. Collapsed source lists retain their date/scope disclaimer. Uncertainty and transaction limitations remain visible outside disclosures.

## Reference evidence
These are documented design practices, not claims of popularity or copied screens:
- Skyscanner Backpack: shared foundations, platform-specific composition: https://www.skyscanner.design/latest/getting-started/backpack-in-code/libraries-6HhtEQiC
- GOV.UK summary lists: semantic key facts: https://design-system.service.gov.uk/components/summary-list/
- Airbnb listing guidance: photo-led discovery and organized media: https://www.airbnb.com/resources/hosting-homes/a/how-to-set-up-an-effective-listing-page-12
- Linear's interface refresh: quieter consistent shell: https://linear.app/now/behind-the-latest-design-refresh
- Stripe patterns: repeated states and filter structure: https://docs.stripe.com/stripe-apps/patterns
- Wise pricing: explicit pricing disclosure: https://wise.com/gb/pricing/
- WCAG reduced motion: https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- WCAG target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (AA minimum is 24px with exceptions; our 44px is a comfort target).
Mobbin references were unavailable behind a paid plan; no Mobbin screen audit is claimed.

## Acceptance
Run lint, TypeScript, unit tests and production build. Browser review must cover desktop and narrow responsive widths, keyboard navigation, disclosure controls, missing images/prices, long translated facts, catalogue filters/map, assessment and inquiry cancellation without submission. Record limitations honestly. Real mobile/device and field performance validation remain distinct from responsive browser zoom.

Performance goals, not measured results: LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75. Keep media aspect ratios reserved, load offscreen photos lazily, avoid heavy motion libraries. Existing remote images are unoptimized because source compatibility is not guaranteed; measure actual image weight before claiming these goals are met.
