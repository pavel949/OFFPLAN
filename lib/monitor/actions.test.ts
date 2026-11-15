import { beforeEach, describe, expect, it, vi } from "vitest";
import { priceFile, projectId } from "./fixture";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  client: vi.fn(),
  register: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-server-auth", () => ({ getAdminSessionOk: mocks.admin }));
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: mocks.client }));
vi.mock("@/lib/monitor/archive", () => ({ registerPriceList: mocks.register }));

import { adminRegisterPriceList } from "@/app/actions/price-monitor";

function submission() {
  const { bytes, filename, metadata } = priceFile();
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], filename));
  form.set("coverage", metadata.coverage);
  form.set("url", metadata.url);
  form.set("version", metadata.version);
  form.set("scope", metadata.scope);
  form.set("published_at", "2025-10-25T10:00");
  return form;
}

describe("admin price-list upload", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects unauthorized access before creating the service client", async () => {
    mocks.admin.mockResolvedValue(false);
    expect(await adminRegisterPriceList(projectId, {}, submission())).toHaveProperty("error");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("treats a forged apply request only as an archive submission", async () => {
    mocks.admin.mockResolvedValue(true);
    mocks.client.mockReturnValue("test-db");
    mocks.register.mockResolvedValue({ id: "test-file", duplicate: false });
    const form = submission();
    form.set("mode", "apply");
    form.set("origin", "telegram");
    expect(await adminRegisterPriceList(projectId, {}, form)).toEqual({ id: "test-file", duplicate: false });
    expect(mocks.register).toHaveBeenCalledWith("test-db", {
      bytes: priceFile().bytes,
      filename: "price.csv",
      metadata: {
        projectId,
        origin: { kind: "manual" },
        publishedAt: "2025-10-25T10:00+07:00",
        url: "https://t.me/developer/123",
        version: "V4",
        scope: "Корпус G",
        coverage: "full",
      },
    });
  });
});
