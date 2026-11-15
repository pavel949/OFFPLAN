import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { marketFilters } from "./market-evidence";
import { applyFilters, defaultFilterState } from "./filters";
import { filtersFromSearchParams, filtersToSearchParams } from "./url-filters";
import type { CatalogProject } from "./types";

describe("public market evidence boundaries", () => {
  it("keeps market context readable and hero decoration independent of fonts", () => {
    const css = readFileSync("components/ui/system.css", "utf8");
    expect(css).toContain(".hero .hero-sub { color: var(--ui-on-dark-muted); font-size: 12px;");
    const hero = readFileSync("components/ui/DiscoveryHero.tsx", "utf8");
    expect(hero).not.toContain("↗");
    expect(hero).toContain('aria-hidden="true" focusable="false"');
  });
  it.each(["rating", "risk", "yield"])("neutralizes legacy %s URL ordering and hidden recommendations", sort => {
    const filters = marketFilters(filtersFromSearchParams(new URLSearchParams(`sort=${sort}&risk=1&rec=BUY&q=Bay&zone=bangtao`)));
    expect(filters.fSort).toBe("name");
    expect(filters.fRisk).toBe("");
    expect(filters.fRec).toBe("");
    expect(filters.q).toBe("Bay");
    expect(filters.fZone).toBe("bangtao");
    const out = filtersToSearchParams(filters);
    expect(out.risk).toBeUndefined();
    expect(out.rec).toBeUndefined();
  });
  it("defaults to alphabetical rather than unsubstantiated score ordering", () => {
    const rows = [{ id: 1, n: "Zulu", rat: 9.9, risk: 1 }, { id: 2, n: "Alpha", rat: 1, risk: 3 }] as CatalogProject[];
    const filters = marketFilters(defaultFilterState());
    expect(applyFilters(rows, filters).map(p => p.n)).toEqual(["Alpha", "Zulu"]);
    expect(filtersFromSearchParams(new URLSearchParams({ sort: "name" })).fSort).toBe("name");
  });
  it("preserves factual sorting and filtering", () => {
    const filters = { ...defaultFilterState(), fSort: "price_asc" as const, fDev: "example", fSales: "available" };
    expect(marketFilters(filters)).toEqual(filters);
  });
  it("cards never render legacy scores, risk tiers or recommendation flags", () => {
    const card = readFileSync("components/catalogue/ProjectCard.tsx", "utf8");
    for (const s of ["p.rat", "p.risk", "p.rec", "SHOW_PROJECT_REC", "RISK_CLS", "RISK_EMOJI"]) expect(card).not.toContain(s);
    expect(card).toContain("Рейтинг проекта не опубликован");
  });
  it("does not expose blanket verification claims or unsafe legacy tab HTML", () => {
    const shell = readFileSync("components/catalogue/CatalogueShell.tsx", "utf8");
    for (const s of ["Verified Data Only", "Только верифицированные данные", "Verified projects", "dangerouslySetInnerHTML", "SHOW_PROJECT_REC", 'value="rating"', 'value="risk"', "filters.fRisk", "methodologyRu"]) expect(shell).not.toContain(s);
    const page = readFileSync("app/market/page.tsx", "utf8");
    expect(page).not.toContain("loadTabHtml");
    expect(page).not.toContain("getPublicRatingMethodology");
    expect(shell).toContain("Прогноз доходности сейчас не доступен");
    expect(shell).toContain("Налоги, состав работ");
  });
});
