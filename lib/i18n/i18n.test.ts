import { describe, expect, it } from "vitest";
import rawProjects from "@/data/seed/projects.json";
import ruTexts from "@/data/i18n/projects.ru.json";
import { SEGMENTS, TAXONOMY_LABELS, ZONES, ZONE_LABELS, taxLabel } from "../taxonomy";
import type { CatalogProject } from "../types";
import { localizeValue } from "./format";
import { localizeProject } from "./localize-project";

const projects = rawProjects as unknown as CatalogProject[];
const cyr = /[А-Яа-яЁё]/;

describe("localizeValue", () => {
  it("formats money, areas and sentinels for Russian", () => {
    expect(localizeValue("฿17.3M", "ru")).toBe("฿17,3 млн");
    expect(localizeValue("฿315M+", "ru")).toBe("฿315 млн+");
    expect(localizeValue("$500K", "ru")).toBe("$500 тыс.");
    expect(localizeValue("฿5M–฿9M", "ru")).toBe("฿5 млн–฿9 млн");
    expect(localizeValue("48–220 sqm", "ru")).toBe("48–220 м²");
    expect(localizeValue("220,000–350,000", "ru")).toBe("220 000–350 000");
    expect(localizeValue("POA", "ru")).toBe("по запросу");
    expect(localizeValue("н/д", "en")).toBe("n/a");
  });
  it("leaves English values untouched", () => {
    expect(localizeValue("฿17.3M", "en")).toBe("฿17.3M");
  });
});

describe("Russian content coverage", () => {
  it("has a translation for every project, with Cyrillic text", () => {
    for (const p of projects) {
      const t = (ruTexts as Record<string, { desc: string; stT: string; compQ: string; tags: string[] }>)[String(p.id)];
      expect(t, `project ${p.id}`).toBeTruthy();
      expect(cyr.test(t.desc), `desc ${p.id}`).toBe(true);
      expect(cyr.test(t.stT), `stT ${p.id}`).toBe(true);
      expect(t.tags.length, `tags ${p.id}`).toBeGreaterThan(0);
    }
  });
  it("keeps numbers consistent between source and translation for prices per sqm", () => {
    for (const p of projects) {
      const t = (ruTexts as Record<string, { desc: string }>)[String(p.id)];
      for (const m of p.desc.matchAll(/฿(\d[\d.,]*)\s?(?:K|M|B)?/g)) {
        const digits = m[1].replace(/[.,]/g, "");
        expect(t.desc.replace(/[\s .,]/g, "").includes(digits), `price ${m[0]} in ${p.id}`).toBe(true);
      }
    }
  });
  it("localizeProject swaps text and does not change taxonomy keys", () => {
    const p = { ...projects[0], i18n: { ru: (ruTexts as never)["1"] } } as CatalogProject;
    const l = localizeProject(p, "ru");
    expect(cyr.test(l.desc)).toBe(true);
    expect(l.zone).toBe(p.zone);
    expect(localizeProject(p, "en").desc).toBe(p.desc);
  });
});

describe("taxonomy labels", () => {
  it("cover every key used in the data, in both languages", () => {
    const used: Record<string, Set<string>> = { seg: new Set(), type: new Set(), stK: new Set(), beach: new Set(), own: new Set(), mgmt: new Set(), focus: new Set(), risk: new Set(), rec: new Set() };
    for (const p of projects) {
      used.seg.add(p.seg); used.type.add(p.type); used.stK.add(p.stK); used.beach.add(p.beach);
      used.own.add(p.own); used.mgmt.add(p.mgmt); used.focus.add(p.focus); used.risk.add(String(p.risk)); used.rec.add(p.rec);
    }
    for (const [kind, keys] of Object.entries(used)) {
      for (const k of keys) {
        const t = TAXONOMY_LABELS[kind as keyof typeof TAXONOMY_LABELS][k];
        expect(t, `${kind}:${k}`).toBeTruthy();
        expect(cyr.test(t.ru), `${kind}:${k} ru`).toBe(true);
        expect(t.en.length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(TAXONOMY_LABELS.seg).sort()).toEqual([...SEGMENTS].sort());
  });
  it("has Russian names for every zone", () => {
    for (const z of ZONES) expect(cyr.test(ZONE_LABELS[z].ru), z).toBe(true);
    expect(taxLabel("beach", "bf", "ru")).toBe("Первая линия");
  });
});

import { buildDeveloperRows, buildRegionRows, buildTaxonomyRows, zoneSlug } from "../reference-data";

describe("reference data builders", () => {
  it("builds taxonomy terms for every kind with ru+en labels", () => {
    const rows = buildTaxonomyRows();
    expect(rows.length).toBeGreaterThan(30);
    for (const r of rows) {
      expect(r.label.ru && r.label.en, `${r.kind}:${r.key}`).toBeTruthy();
    }
    expect(new Set(rows.map((r) => `${r.kind}:${r.key}`)).size).toBe(rows.length);
  });
  it("builds Phuket region with all districts and unique slugs", () => {
    const rows = buildRegionRows();
    expect(rows.filter((r) => r.level === "region")).toHaveLength(1);
    expect(rows.filter((r) => r.level === "district")).toHaveLength(ZONES.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
    expect(zoneSlug("Cape Panwa")).toBe("cape-panwa");
  });
  it("derives one developer per code and covers all projects", () => {
    const devs = buildDeveloperRows(projects);
    const codes = new Set(devs.map((d) => d.code));
    expect(codes.size).toBe(devs.length);
    for (const p of projects) expect(codes.has(p.dt), `dt ${p.dt}`).toBe(true);
  });
});
