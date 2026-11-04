import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configured: true, result: { data: null as unknown, error: null as unknown }, fileRead: vi.fn(), fileGet: vi.fn(), fileUpdate: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({
  hasSupabaseServiceConfig: () => mocks.configured,
  createServiceRoleClient: () => ({ from: () => {
    const q = { select: () => q, eq: () => q, update: () => q,
      order: async () => mocks.result, maybeSingle: async () => mocks.result };
    return q;
  } }),
}));
vi.mock("./store", () => ({ appendLead: vi.fn(), getLead: mocks.fileGet, leadStats: vi.fn(), listLeads: mocks.fileRead, updateLead: mocks.fileUpdate }));
import { getLeadUnified, listLeadsUnified, updateLeadUnified } from "./unified";

describe("production lead store", () => {
  beforeEach(() => { vi.stubEnv("NODE_ENV", "production"); mocks.configured = true; mocks.result = { data: null, error: null }; vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllEnvs());
  it("returns a real empty result without reading local files", async () => {
    mocks.result.data = [];
    expect(await listLeadsUnified()).toEqual([]);
    expect(mocks.fileRead).not.toHaveBeenCalled();
  });
  it("surfaces a database outage instead of an empty list", async () => {
    mocks.result.error = { message: "database down" };
    await expect(listLeadsUnified()).rejects.toThrow("Не удалось");
    expect(mocks.fileRead).not.toHaveBeenCalled();
  });
  it("distinguishes a missing lead from a failed query", async () => {
    expect(await getLeadUnified("id")).toBeUndefined();
    mocks.result.error = { message: "database down" };
    await expect(getLeadUnified("id")).rejects.toThrow();
    expect(mocks.fileGet).not.toHaveBeenCalled();
  });
  it("surfaces write failures", async () => {
    mocks.result.error = { message: "database down" };
    await expect(updateLeadUnified("id", { status: "contacted" })).rejects.toThrow();
  });
  it("never reads or writes ephemeral files when production configuration is missing", async () => {
    mocks.configured = false;
    await expect(listLeadsUnified()).rejects.toThrow();
    await expect(getLeadUnified("id")).rejects.toThrow();
    await expect(updateLeadUnified("id", { notes: "note" })).rejects.toThrow();
    expect(mocks.fileUpdate).not.toHaveBeenCalled();
  });
});
