import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySalesModel, salesModelBase } from "./sales-model";
const mocks = vi.hoisted(() => ({ session: vi.fn(), service: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.session }));
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: mocks.service }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
import { partnerGetSalesModel, partnerSaveSalesModel, partnerCreateSalesUnit } from "@/app/actions/partner-sales";
import { partnerSalesView } from "./partner-sales";
const pid = "00000000-0000-4000-8000-000000000001", uid = "00000000-0000-4000-8000-000000000002";
function session(role = "owner", org = "ours", projectOrg = "ours") {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-id" } } }) }, from: (table: string) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === "profiles" ? { role: "partner", partner_role: role, org_id: org } : { id: pid, org_id: projectOrg, jurisdiction_code: "TH" } }) }; return q;
  } };
}
function database() {
  const model = emptySalesModel();
  model.units = [salesModelBase.shape.units.element.parse({ id: uid, kind: "apartment", source: "PRIVATE source", sourceDate: "2026-11-05" })];
  const tables: Record<string, Record<string, unknown>[]> = { project_sales_models: [{ revision: 1, model }], project_sales_publications: [{ revision: 1, expires_at: "2026-11-30" }], project_units: [{ id: uid, label: "A101", status: "unknown", bedrooms: 1 }] };
  const writes: string[] = [];
  return { tables, writes, from: (table: string) => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, range: async () => ({ data: tables[table] ?? [] }), maybeSingle: async () => ({ data: tables[table]?.at(-1) ?? null }), insert: async (row: Record<string, unknown>) => { writes.push(table); tables[table].push(row); return { error: null }; } }; return q;
  } };
}
describe("partner sales server actions", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects signed-out access before privileged access", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(partnerGetSalesModel(pid)).rejects.toThrow();
    expect((await partnerSaveSalesModel(pid, 0, emptySalesModel())).ok).toBe(false);
    expect((await partnerCreateSalesUnit(pid, "A101")).ok).toBe(false);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each(["sales", "", "admin"])("rejects non-owner role %s before privileged access", async role => {
    mocks.session.mockResolvedValue(session(role));
    await expect(partnerGetSalesModel(pid)).rejects.toThrow();
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("rejects another organization before privileged access", async () => {
    mocks.session.mockResolvedValue(session("owner", "ours", "theirs"));
    expect((await partnerSaveSalesModel(pid, 0, emptySalesModel())).ok).toBe(false);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("returns redacted editor data and rejects stale revisions", async () => {
    const db = database(); mocks.session.mockResolvedValue(session()); mocks.service.mockReturnValue(db);
    const data = await partnerGetSalesModel(pid);
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect((await partnerSaveSalesModel(pid, 0, data.model)).ok).toBe(false);
    expect(db.writes).toEqual([]);
  });
  it("saves to the same revision model without altering public publication", async () => {
    const db = database(); mocks.session.mockResolvedValue(session()); mocks.service.mockReturnValue(db);
    const data = await partnerGetSalesModel(pid);
    const result = await partnerSaveSalesModel(pid, 1, data.model);
    expect(result).toEqual({ ok: true, revision: 2 });
    expect(db.writes).toEqual(["project_sales_models"]);
    expect(db.tables.project_sales_publications[0].revision).toBe(1);
    expect(db.tables.project_sales_models[1].actor).toBe("partner:owner-id");
    expect(JSON.stringify(db.tables.project_sales_models[1].model)).toContain("PRIVATE source");
  });
  it("rejects foreign physical identities", async () => {
    const db = database(); mocks.session.mockResolvedValue(session()); mocks.service.mockReturnValue(db);
    const view = partnerSalesView(emptySalesModel());
    view.units = [salesModelBase.shape.units.element.parse({ id: pid, kind: "apartment" })];
    expect((await partnerSaveSalesModel(pid, 1, view)).ok).toBe(false);
    expect(db.writes).toEqual([]);
  });
  it("rechecks authorization before writing", async () => {
    const db = database(); mocks.session.mockResolvedValueOnce(session()).mockResolvedValueOnce(session("owner", "ours", "theirs")); mocks.service.mockReturnValue(db);
    expect((await partnerSaveSalesModel(pid, 1, emptySalesModel())).ok).toBe(false);
    expect(db.writes).toEqual([]);
  });
});
