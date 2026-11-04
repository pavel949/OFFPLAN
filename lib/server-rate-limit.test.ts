import { afterEach, beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./supabase/service", () => ({ hasSupabaseServiceConfig: () => true, createServiceRoleClient: () => ({ rpc }) }));
import { serverRateLimit } from "./server-rate-limit";
beforeEach(() => { vi.stubEnv("NODE_ENV", "production"); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
it("uses the shared result and sends only a digest of the identifier", async () => {
  rpc.mockReturnValue({ abortSignal: async () => ({ data: { ok: false, retry_after_ms: 600 }, error: null }) });
  expect(await serverRateLimit("lead:email:private@example.com", 3, 60000)).toEqual({ ok: false, retryAfterMs: 600 });
  expect(rpc.mock.calls[0][1].p_key).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("private@example.com");
});
it("fails closed when the database limiter is unavailable", async () => {
  rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { message: "offline" } }) });
  expect(await serverRateLimit("admin:ip", 5, 60000)).toMatchObject({ ok: false, unavailable: true });
});
