import { zoneLabel } from "../taxonomy";
import type { CatalogProject } from "../types";
import { localizeValue } from "./format";
import type { Locale } from "./locales";

const VALUE_FIELDS = ["pT", "pU", "sqmP", "unitSzM2", "units"] as const;

/**
 * Returns a display copy of a project for the given language: editorial text from the
 * translation (if present) and locale-correct numbers. Taxonomy KEYS (zone, seg, …) are left
 * untouched because filters and URLs depend on them; render them through `taxLabel`/`zoneLabel`.
 */
export function localizeProject(p: CatalogProject, lang: Locale): CatalogProject {
  const out: CatalogProject = { ...p };
  for (const f of VALUE_FIELDS) out[f] = localizeValue(p[f], lang) as never;
  if (lang === "ru" && p.i18n?.ru) {
    const t = p.i18n.ru;
    out.desc = t.desc || p.desc;
    out.stT = t.stT || p.stT;
    out.compQ = t.compQ || p.compQ;
    out.tags = t.tags?.length ? t.tags : p.tags;
  }
  return out;
}

/** Text used for free-text search; includes both language variants so ru/en queries both work. */
export function searchHaystack(p: CatalogProject): string {
  return [
    p.n,
    p.dev,
    p.zone,
    zoneLabel(p.zone, "ru"),
    ...(p.tags ?? []),
    ...(p.i18n?.ru?.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
}
