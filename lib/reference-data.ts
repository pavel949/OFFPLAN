// Pure builders for reference data (taxonomy, regions, developers).
// Imports use explicit .ts extensions so scripts/seed-reference.mjs can run them with
// `node --experimental-strip-types`.
import { TAXONOMY_LABELS, ZONES, ZONE_LABELS } from "./taxonomy.ts";

export interface TaxonomyRow {
  kind: string;
  key: string;
  label: Record<string, string>;
  sort_order: number;
}

export function buildTaxonomyRows(): TaxonomyRow[] {
  const rows: TaxonomyRow[] = [];
  for (const [kind, terms] of Object.entries(TAXONOMY_LABELS)) {
    Object.entries(terms).forEach(([key, t], i) => {
      const label: Record<string, string> = { ru: t.ru, en: t.en };
      if (t.ruShort) label.ruShort = t.ruShort;
      if (t.enShort) label.enShort = t.enShort;
      rows.push({ kind, key, label, sort_order: (i + 1) * 10 });
    });
  }
  return rows;
}

export function zoneSlug(zone: string): string {
  return zone.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface RegionRow {
  jurisdiction_code: string;
  slug: string;
  level: "region" | "district";
  parent_slug: string | null;
  name: { ru: string; en: string };
  sort_order: number;
}

/** Thailand: one region (Phuket) with all districts as children. */
export function buildRegionRows(): RegionRow[] {
  const rows: RegionRow[] = [
    {
      jurisdiction_code: "TH",
      slug: "phuket",
      level: "region",
      parent_slug: null,
      name: { ru: "Пхукет", en: "Phuket" },
      sort_order: 0,
    },
  ];
  ZONES.forEach((z, i) => {
    rows.push({
      jurisdiction_code: "TH",
      slug: zoneSlug(z),
      level: "district",
      parent_slug: "phuket",
      name: ZONE_LABELS[z],
      sort_order: (i + 1) * 10,
    });
  });
  return rows;
}

export interface DeveloperRow {
  code: string;
  name_en: string;
  name_ru: string;
  jurisdiction_code: string;
}

/** One developer per short code `dt`; the display name is the most frequent `dev` string. */
export function buildDeveloperRows(
  projects: { dt: string; dev: string }[],
  jurisdiction = "TH",
): DeveloperRow[] {
  const names = new Map<string, Map<string, number>>();
  for (const p of projects) {
    if (!p.dt) continue;
    const m = names.get(p.dt) ?? new Map<string, number>();
    m.set(p.dev, (m.get(p.dev) ?? 0) + 1);
    names.set(p.dt, m);
  }
  return [...names.entries()]
    .map(([code, m]) => {
      const name = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { code, name_en: name, name_ru: name, jurisdiction_code: jurisdiction };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}
