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
    expect(r.payload.rat).toBe(0);
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
    expect(r.payload.rat).toBe(0);
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
});
