import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  runImport: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-server-auth", () => ({ getAdminSessionOk: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({
  hasSupabaseServiceConfig: () => true,
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "source-1", project_id: "project-1", url: "https://drive.google.com/file/d/file-1/view", sync_enabled: true },
          }),
        }),
      }),
      update: mocks.update,
    }),
  }),
}));
vi.mock("@/lib/drive/client", () => ({
  DriveError: class extends Error {},
  hasDriveConfig: () => true,
  getFileMeta: async () => ({ id: "file-1", name: "inventory.csv" }),
  fetchFileText: async () => "label,price\nA1,1000000",
  listFolder: async () => [],
  serviceAccount: () => null,
}));
vi.mock("@/lib/drive/pick", () => ({
  isExcel: () => false,
  isImportable: () => true,
  rankFiles: (files: unknown[]) => files,
}));
vi.mock("@/lib/drive/manifest", () => ({ materialManifest: () => [] }));
vi.mock("@/lib/drive/url", () => ({ parseDriveUrl: () => ({ kind: "file", id: "file-1" }) }));
vi.mock("@/lib/inventory/run", () => ({ runUnitImport: mocks.runImport }));
vi.mock("@/lib/marketplace/audit", () => ({ insertCatalogAuditLog: vi.fn(async () => undefined) }));

import { adminDriveImport } from "./drive-sync";

function form(mode: string) {
  const data = new FormData();
  data.set("source_id", "source-1");
  data.set("file_id", "file-1");
  data.set("mode", mode);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
});

describe("Drive import source verification", () => {
  it.each([
    { inserted: 1, updated: 2 },
    { inserted: 0, updated: 0 },
  ])("records ingestion without confirming source freshness: %j", async (applied) => {
    mocks.runImport.mockResolvedValue({ ok: true, mode: "apply", applied });
    const result = await adminDriveImport({ ok: false }, form("apply"));
    expect(result.ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const patch = mocks.update.mock.calls[0][0];
    expect(patch.last_synced_at).toEqual(expect.any(String));
    expect(patch.last_sync_note).toBe(`inventory.csv: +${applied.inserted} / ~${applied.updated}`);
    // An imported old file must not renew or clear a human's prior confirmation.
    expect(Object.keys(patch).sort()).toEqual(["last_sync_note", "last_synced_at"]);
  });

  it.each([
    { ok: true, mode: "preview" },
    { ok: false, error: "Import rejected" },
  ])("does not stamp a preview or rejected import: %j", async (result) => {
    mocks.runImport.mockResolvedValue(result);
    await adminDriveImport({ ok: false }, form(result.ok ? "preview" : "apply"));
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
