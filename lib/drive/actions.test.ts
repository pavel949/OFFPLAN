import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), configured: vi.fn(), list: vi.fn(), read: vi.fn(), run: vi.fn(),
  source: vi.fn(), profile: vi.fn(), user: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-server-auth", () => ({ getAdminSessionOk: mocks.admin }));
vi.mock("@/lib/drive/client", () => ({
  DriveError: class extends Error {}, hasDriveConfig: mocks.configured,
  serviceAccount: () => ({ client_email: "test@example.invalid" }),
  listFolder: mocks.list, getFileMeta: vi.fn(), fetchFileText: mocks.read,
}));
function db() {
  return { from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: table === "profiles" ? mocks.profile : mocks.source };
    return query;
  }, auth: { getUser: mocks.user } };
}
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: () => db(), hasSupabaseServiceConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => db() }));
vi.mock("@/lib/inventory/run", () => ({ runUnitImport: mocks.run }));
vi.mock("@/lib/marketplace/audit", () => ({ insertCatalogAuditLog: vi.fn() }));
import { adminDriveList, partnerDriveList, adminDriveImport } from "@/app/actions/drive-sync";

describe("Drive action source boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.admin.mockResolvedValue(true);
    mocks.user.mockResolvedValue({ data: { user: { id: "user" } } });
    mocks.profile.mockResolvedValue({ data: { role: "partner", org_id: "own-org", partner_role: "owner" } });
    mocks.source.mockResolvedValue({ data: { id: "source", project_id: "project", url: "https://drive.google.com/drive/folders/abcdefghij", sync_enabled: true } });
    mocks.list.mockResolvedValue([{ id: "inside", name: "units.csv", mimeType: "text/csv", modifiedTime: "" }]);
  });
  it("never discovers files for an unauthenticated admin", async () => {
    mocks.admin.mockResolvedValue(false);
    expect((await adminDriveList("source")).ok).toBe(false);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("never discovers a partner source absent under RLS or disabled by staff", async () => {
    for (const data of [null, { sync_enabled: false }]) {
      mocks.source.mockResolvedValue({ data });
      expect((await partnerDriveList("source")).ok).toBe(false);
      expect(mocks.list).not.toHaveBeenCalled();
    }
  });
  it("rejects partner sales users before source discovery", async () => {
    mocks.profile.mockResolvedValue({ data: { role: "partner", org_id: "own-org", partner_role: "sales" } });
    expect((await partnerDriveList("source")).ok).toBe(false);
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("rechecks linked-source membership before fetching or applying a file", async () => {
    const form = new FormData();
    form.set("source_id", "source"); form.set("file_id", "outside"); form.set("mode", "apply");
    expect((await adminDriveImport({ ok: false }, form)).ok).toBe(false);
    expect(mocks.list).toHaveBeenCalledWith("abcdefghij");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
