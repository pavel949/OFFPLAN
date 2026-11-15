import { describe, expect, it } from "vitest";
import { buildPayloadFromWizard, parseWizardForm, wizardSchema } from "./project-wizard";

const base = {
  n: "Sea View Residences",
  dev: "Sunrise Property Co., Ltd.",
  zone: "Layan",
  seg: "condo",
  type: "condo",
  priceFromM: "7.5",
  unitsTotal: "120",
  minBR: "1",
  stK: "offplan",
  compY: "2028",
  compQ: "Q4 2028",
  beach: "500",
  own: "fh",
  mgmt: "pro",
  focus: "STR",
  desc: "Низкоэтажный кондо-комплекс у пляжа с бассейном и управляющей компанией.",
  src: "https://sunrise.example/project",
};
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("project wizard", () => {
  it("builds a schema-valid payload with neutral editorial fields", () => {
    const r = parseWizardForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.rat).toBeNull();
    expect(r.payload.risk).toBeNull();
    expect(r.payload.rec).toBe("WATCH");
    expect(r.payload.recText).toBe("");
    expect(r.payload.pT).toBe("฿7.5M+");
    expect(r.payload.dt).toBe("Sunrise");
    expect(r.payload.stT).toBeTruthy();
  });
  it("ignores editorial fields smuggled into the form", () => {
    const r = parseWizardForm(form({ ...base, rat: "9.9", risk: "1", rec: "BUY", recText: "buy now", id: "7" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.rat).toBeNull();
    expect(r.payload.risk).toBeNull();
    expect(r.payload.rec).toBe("WATCH");
    expect(r.payload.id).toBe(1);
  });
  it("rejects bad taxonomy, non-https source and short description", () => {
    expect(parseWizardForm(form({ ...base, zone: "" })).ok).toBe(false);
    expect(parseWizardForm(form({ ...base, zone: "__other", zoneOther: "Da Nang" })).ok).toBe(true);
    expect(parseWizardForm(form({ ...base, src: "http://x.y" })).ok).toBe(false);
    expect(parseWizardForm(form({ ...base, desc: "коротко" })).ok).toBe(false);
  });
  it("formats whole-number prices without decimals", () => {
    const i = wizardSchema.parse({ ...base, priceFromM: "12" });
    expect(buildPayloadFromWizard(i).pT).toBe("฿12M+");
  });
  it("preserves unknown numbers and an explicitly unconfirmed location", () => {
    const r = parseWizardForm(form({ ...base, zone: "__unknown", priceFromM: "", unitsTotal: "", minBR: "", compY: "", compQ: "" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({ zone: "Location unconfirmed", pN: 0, pT: "POA", units: "", minBR: null, compY: null, compQ: "", rat: null, risk: null });
  });
  it("keeps real zero-bedroom studios separate from unknown bedrooms", () => {
    const r = parseWizardForm(form({ ...base, minBR: "0" }));
    expect(r.ok && r.payload.minBR).toBe(0);
  });
  it("does not round a precise price label or invent a completion quarter", () => {
    const r = parseWizardForm(form({ ...base, priceFromM: "7.55", compY: "", compQ: "" }));
    expect(r.ok && r.payload.pT).toBe("฿7.55M+");
    expect(r.ok && r.payload.compQ).toBe("");
  });
  it("still rejects invalid supplied numbers", () => {
    for (const value of ["-1", "NaN", "Infinity", "0"])
      expect(parseWizardForm(form({ ...base, priceFromM: value })).ok).toBe(false);
    expect(parseWizardForm(form({ ...base, unitsTotal: "1.5" })).ok).toBe(false);
    expect(parseWizardForm(form({ ...base, compY: "1800" })).ok).toBe(false);
  });
});

