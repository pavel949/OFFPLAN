/**
 * ClearView risk registry, transcribed from "ClearView Risk Methodology Atlas v2.1 FINAL" (Appendix A).
 * Source of truth for the first implementation; the platform stores it as versioned data (see docs/CLEARVIEW_INTEGRATION.md).
 *
 * `auto` is OUR proposal, not part of the Atlas: how far evidence collection for the item can be automated.
 *   data   - computed from structured data or a registry/GIS lookup (no human in the loop except sign-off)
 *   ai     - a model extracts it from a document the developer uploads; an analyst confirms
 *   manual - needs a third-party letter, a registry visit or a site visit
 */
export type DomainCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9";
export type Gate = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8" | "G9" | "G10";
export type Auto = "data" | "ai" | "manual";

export interface RiskItem {
  code: string;
  domain: DomainCode;
  title: string;
  P: number;
  S: number;
  O: number;
  /** Hard-fail gate this item feeds. */
  gate?: Gate;
  /** Domain cap this item feeds, if any. */
  cap?: { domain: DomainCode; max: number };
  weight: number;
  branded?: boolean;
  /** Applies only when the project has this feature (rental thesis). */
  needs?: "str" | "ltr" | "rental";
  auto: Auto;
}

export const DOMAINS: { code: DomainCode; name: string; ru: string; base: number }[] = [
  { code: "D1", name: "Developer Integrity & Track Record", ru: "Репутация и опыт застройщика", base: 0.17 },
  { code: "D2", name: "Project Financial Health & Funding", ru: "Финансирование проекта", base: 0.22 },
  { code: "D3", name: "Legal, Title & Ownership Security", ru: "Право, титул и собственность", base: 0.2 },
  { code: "D4", name: "Construction & Execution", ru: "Строительство и сроки", base: 0.12 },
  { code: "D5", name: "Buyer Protection & Contract", ru: "Защита покупателя и договор", base: 0.1 },
  { code: "D6", name: "Rental Market Viability", ru: "Рынок аренды", base: 0.07 },
  { code: "D7", name: "Pricing Competitiveness", ru: "Цена относительно рынка", base: 0.04 },
  { code: "D8", name: "Environmental & Infrastructure", ru: "Среда и инфраструктура", base: 0.04 },
  { code: "D9", name: "Post-Completion & Operations", ru: "Эксплуатация после сдачи", base: 0.04 },
];

const i = (
  code: string, domain: DomainCode, P: number, S: number, O: number, weight: number, auto: Auto, title: string,
  extra: Partial<RiskItem> = {},
): RiskItem => ({ code, domain, title, P, S, O, weight, auto, ...extra });

export const ITEMS: RiskItem[] = [
  i("1.1", "D1", 4, 4, 3, 1.2, "data", "Zero completed projects: no verifiable delivery track record"),
  i("1.2", "D1", 3, 4, 2, 1.0, "data", "Registered capital below THB 10M (paid-up)"),
  i("1.3", "D1", 3, 3, 4, 1.0, "manual", "No audited financial statements available from developer"),
  i("1.4", "D1", 3, 4, 4, 1.0, "data", "Ultimate parent is an unverifiable offshore entity"),
  i("1.5", "D1", 3, 5, 3, 1.2, "manual", "Named contractor has known project failure history"),
  i("1.6", "D1", 2, 3, 3, 0.8, "manual", "No named construction lender"),

  i("2.1", "D2", 4, 4, 2, 1.3, "ai", "No escrow AND payments front-loaded >40% before structural frame completion"),
  i("2.2", "D2", 3, 4, 3, 1.2, "manual", "Construction loan: lender named only, no term sheet or drawdown confirmation"),
  i("2.3", "D2", 2, 3, 3, 0.8, "manual", "Construction loan: term sheet signed but not yet drawn"),
  i("2.4", "D2", 3, 4, 3, 1.0, "ai", "Guaranteed return: issuer is the developer SPV or developer entity itself"),
  i("2.5", "D2", 3, 3, 3, 0.8, "ai", "No developer delay penalty clause in SPA"),

  i("3.1", "D3", 4, 5, 2, 1.5, "manual", "Non-transferable title (Sor Kor 1) for foreign freehold", { gate: "G2" }),
  i("3.2", "D3", 4, 5, 3, 1.5, "manual", "Unresolved encumbrance / mortgage on land title", { gate: "G7" }),
  i("3.3", "D3", 4, 5, 2, 1.5, "manual", "Foreign freehold quota 49% or more exhausted", { gate: "G6" }),
  i("3.4", "D3", 4, 5, 4, 1.5, "manual", "Land owner differs from seller: undisclosed structure, no verified override", { gate: "G8" }),
  i("3.5", "D3", 3, 5, 2, 1.5, "data", "Protected zone or coastal restriction overlap on project land", { gate: "G3" }),
  i("3.6", "D3", 3, 4, 4, 1.0, "manual", "Nominee / hidden Thai ownership structure", { gate: "G1" }),
  i("3.7", "D3", 2, 4, 2, 1.0, "manual", "NorSor3 or lower title grade (not Chanote)", { cap: { domain: "D3", max: 60 } }),
  i("3.8", "D3", 3, 3, 2, 0.8, "manual", "Foreign quota above 40% sold: approaching exhaustion"),

  i("4.1", "D4", 3, 5, 2, 1.5, "manual", "Construction halted: zero verified activity for 90+ consecutive days", { cap: { domain: "D4", max: 20 } }),
  i("4.2", "D4", 3, 5, 2, 1.5, "data", "EIA required but absent, revoked or in breach (NEQA B.E. 2535)", { gate: "G4" }),
  i("4.3", "D4", 3, 5, 2, 1.5, "manual", "Building permit absent at under-construction stage", { gate: "G5" }),
  i("4.4", "D4", 3, 4, 3, 1.0, "manual", "Building permit mismatch: approved unit count differs from sold"),
  i("4.5", "D4", 3, 4, 2, 1.2, "data", "Delay over 6 months against SPA-stated completion date"),
  i("4.6", "D4", 3, 3, 3, 1.0, "manual", "Contractor substitution mid-build without disclosure"),
  i("4.7", "D4", 3, 3, 4, 0.8, "manual", "No independent construction progress report (engineer or satellite)"),
  i("4.8", "D4", 2, 3, 3, 0.8, "manual", "Pre-launch with no construction evidence or escrow", { gate: "G9" }),

  i("5.1", "D5", 3, 4, 2, 1.2, "ai", "Deposit held by developer with no bank guarantee or escrow"),
  i("5.2", "D5", 2, 4, 3, 1.0, "ai", "Force majeure clause allows delivery extension beyond 12 months"),
  i("5.3", "D5", 3, 4, 3, 1.0, "ai", "Buyer cancellation rights absent for developer delay beyond 6 months"),
  i("5.4", "D5", 3, 4, 3, 0.8, "ai", "SPA not in Thai with certified translation for foreign buyer"),
  i("5.5", "D5", 2, 3, 2, 0.7, "ai", "Specification annex missing or non-binding in SPA"),

  i("6.1", "D6", 3, 3, 3, 1.0, "data", "Exit liquidity score below 3: illiquid micro-market"),
  i("6.2", "D6", 2, 3, 2, 0.8, "data", "Supply pipeline above 500 competing units within 5 km"),
  i("6.3", "D6", 2, 3, 3, 0.8, "data", "Distance to beach above 5 km for an explicit beachfront rental thesis"),
  i("6.4", "D6", 3, 4, 3, 1.2, "manual", "STR rental pool thesis without verified hotel license", { needs: "str", gate: "G10" }),
  i("6.5", "D6", 3, 4, 4, 1.0, "ai", "LTR pool managed by developer SPV without independent financial backing", { needs: "ltr" }),
  i("6.6", "D6", 3, 4, 5, 1.0, "data", "Nominal LTR with structural STR patterns (platform listings, rotations under 30 days)", { needs: "ltr" }),

  i("7.1", "D7", 2, 3, 3, 1.0, "data", "Price per sqm more than 20% above verified Land Dept zone comparables"),
  i("7.2", "D7", 2, 3, 4, 0.8, "ai", "Hidden costs not disclosed in headline price"),
  i("7.3", "D7", 2, 3, 4, 0.8, "data", "No verified comparable transactions: developer pricing entirely unanchored"),

  i("8.1", "D8", 2, 4, 2, 1.0, "data", "High flood risk zone (DDPM zone 3 or 4)"),
  i("8.2", "D8", 2, 3, 2, 0.8, "manual", "Water supply: tanker or private well only, no PWA main grid"),
  i("8.3", "D8", 2, 4, 4, 0.8, "manual", "No geotechnical survey for coastal or lagoon-adjacent site"),

  i("9.1", "D9", 3, 3, 4, 1.0, "data", "Rental pool management company unverifiable: no DBD registration or track record", { needs: "rental" }),
  i("9.2", "D9", 2, 3, 3, 0.8, "manual", "Juristic person not established at time of transfer (Condo Act B.E. 2522)"),
  i("9.3", "D9", 2, 4, 4, 1.0, "ai", "Rental pool exit: owner cannot exit without financial penalty", { needs: "rental" }),
  i("9.4", "D9", 3, 4, 4, 1.0, "ai", "Management fees: owner net yield under 4% after all operator deductions", { needs: "rental" }),
  i("9.5", "D9", 2, 3, 4, 0.8, "ai", "Revenue reporting: owner has no audit rights on rental pool statements", { needs: "rental" }),
  i("9.6", "D9", 3, 3, 4, 0.8, "ai", "FF&E reserve under 3% of revenue or under developer sole control", { needs: "rental" }),
  i("9.7", "D9", 2, 3, 3, 0.8, "manual", "Juristic person governance: weak committee, non-compliant with Condo Act"),
  i("9.8", "D9", 1, 5, 1, 1.2, "data", "Brand operator unverifiable: local brand claiming premium without international standard", { branded: true }),
  i("9.9", "D9", 2, 5, 3, 1.2, "ai", "HMA term under 10 years or renewal conditions unfavourable to unit owners", { branded: true }),
  i("9.10", "D9", 3, 5, 4, 1.5, "ai", "Brand exit clause absent: no successor operator mechanism in HMA", { branded: true }),
  i("9.11", "D9", 2, 4, 5, 1.0, "ai", "Forced FF&E upgrade obligation: brand mandates renovations funded by owners", { branded: true }),
  i("9.12", "D9", 2, 3, 3, 0.8, "ai", "Owner usage rights: peak-season blackout or under 30 guaranteed days per year", { branded: true }),
];

export const GATE_TEXT: Record<Gate, string> = {
  G1: "Nominee / hidden Thai ownership structure",
  G2: "Non-transferable title (Sor Kor 1) for foreign freehold",
  G3: "Protected land or coastal encroachment exposure",
  G4: "EIA required but absent, revoked or in breach",
  G5: "Building permit absent at under-construction stage",
  G6: "Foreign freehold quota 49% or more sold",
  G7: "Unresolved encumbrance blocking clean title transfer",
  G8: "Seller lacks legal control over project land",
  G9: "Phantom project: under-construction status, zero site evidence",
  G10: "STR rental pool thesis without verified hotel license (LTR carve-out)",
};
