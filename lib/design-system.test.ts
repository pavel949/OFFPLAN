import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
describe("shared design-system contracts", () => {
  it("loads the canonical system after compatibility styles", () => {
    const css = read("app/globals.css");
    expect(css.indexOf("system-tokens.css")).toBeGreaterThan(css.indexOf("ie.css"));
    expect(css.indexOf("components/ui/system.css")).toBeGreaterThan(css.indexOf("system-tokens.css"));
  });
  it("keeps shared accessibility and semantic primitives", () => {
    const ui = read("components/ui/index.tsx");
    expect(ui).toContain('type="button"');
    expect(ui).toContain("<dl");
    expect(ui).toContain("<dt>");
    expect(ui).toContain("<dd>");
    expect(ui).toContain("<details");
    expect(ui).toContain("<summary>");
    const css = read("components/ui/system.css");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(":focus-visible");
  });
  it("uses real catalogue media without fabricated fallback", () => {
    const home = read("components/ie/HomeExperience.tsx");
    expect(home).toContain("projects.find(p => feed.covers[p.id])");
    expect(home).toContain("feed.covers[featured.id].url");
    expect(read("components/ui/DiscoveryHero.tsx")).toContain("Визуализация застройщика");
  });
  it("keeps the component reference out of search and labels sample data", () => {
    const page = read("app/design-system/page.tsx");
    expect(page).toContain("index: false");
    expect(page).toContain("Демонстрационные состояния");
  });
});

describe("semantic color compatibility", () => {
  const tokens = read("app/system-tokens.css");
  const color = (name: string) => {
    const hex = tokens.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
    if (!hex) throw new Error(`Missing literal token ${name}`);
    return hex;
  };
  const luminance = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  it.each([
    ["ui-on-action", "ui-action"], ["ui-on-action", "ui-action-hover"],
    ["ui-accent-on-dark", "ui-ink"], ["ui-focus-on-dark", "ui-dark"], ["ui-on-dark-muted", "ui-dark"],
    ["ui-ink", "ui-surface"], ["ui-error", "ui-surface"],
  ])("keeps %s on %s above normal-text AA contrast", (fg, bg) => {
    const a = luminance(color(fg)), b = luminance(color(bg));
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
  });
  it("preserves admin line/danger variants and dark-header accent roles", () => {
    const admin = read("app/admin/admin.css"), css = read("components/ui/system.css");
    expect(admin).toContain(".adm-btn:not(.adm-btn--line):not(.adm-btn--danger)");
    expect(admin).toContain("color: var(--ui-on-action) !important");
    expect(admin).toContain(".pt-bar { --gold: var(--ui-accent-on-dark); }");
    expect(css).toContain(":is(.ie-phero, .ie-foot, .ie-banner");
    expect(css).toContain(".hdr, .hero, .svc-hero, .dev-head, .ftr { --gold: var(--ui-accent-on-dark); }");
    expect(css).toContain(".filter-btn, .svc-cta.gold, .dev-ico { background: var(--ui-action); color: var(--ui-on-action); }");
    expect(read("components/partner/DraftInfoForm.tsx")).not.toContain('background: "var(--gold)"');
    expect(read("components/catalogue/ProjectCard.tsx")).toContain('color: "var(--ui-on-action)"');
    expect(read("components/catalogue/CalculatorPanel.tsx")).toContain('color: "var(--ui-on-action)"');
  });
});
