import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rawProjects from "@/data/seed/projects.json";

type Result = { data: { payload: unknown }[] | null; error: { message: string } | null };
let result: Result | Error;
const fromSpy = vi.fn();

vi.mock("./supabase/anon", () => ({
  hasSupabasePublicConfig: () => !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  createAnonClient: () => ({
    from: (table: string) => {
      fromSpy(table);
      const q = {
        select: () => q,
        order: async () => {
          if (result instanceof Error) throw result;
          return result;
        },
      };
      return q;
    },
  }),
}));
vi.mock("./supabase/service", () => ({
  hasSupabaseServiceConfig: () => false,
  createServiceRoleClient: () => {
    throw new Error("service role must not be used for public reads");
  },
}));

const seed = rawProjects as unknown as { id: number }[];
const dbRow = { ...seed[0], id: 9001, n: "From DB" };

async function load() {
  const mod = await import("./catalog");
  mod.__resetCatalogCacheForTests();
  return mod;
}

describe("catalog source selection", () => {
  beforeEach(() => {
    vi.resetModules();
    fromSpy.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("reads through the public view, never the base table", async () => {
    result = { data: [{ payload: dbRow }], error: null };
    const { getProjects } = await load();
    const rows = await getProjects();
    expect(rows.map((r) => r.id)).toEqual([9001]);
    expect(fromSpy).toHaveBeenCalledWith("public_catalog_projects");
    expect(fromSpy).not.toHaveBeenCalledWith("catalog_projects");
  });

  it("serves the seed when Supabase is not configured at all", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getProjects } = await load();
    expect((await getProjects()).length).toBe(seed.length);
  });

  it("production: DB error with no last-known-good fails loudly instead of serving seed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    result = { data: null, error: { message: "boom" } };
    const { getProjects, CatalogUnavailableError } = await load();
    await expect(getProjects()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it("production: DB error after a good read serves the last-known-good copy, not the seed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    result = { data: [{ payload: dbRow }], error: null };
    const { getProjects } = await load();
    await getProjects();
    result = new Error("network down");
    const rows = await getProjects();
    expect(rows.map((r) => r.id)).toEqual([9001]);
  });

  it("production: an empty published set is the truth, not a reason to resurrect the seed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    result = { data: [], error: null };
    const { getProjects } = await load();
    expect(await getProjects()).toEqual([]);
  });

  it("development: DB error falls back to the seed for convenience", async () => {
    vi.stubEnv("NODE_ENV", "development");
    result = { data: null, error: { message: "boom" } };
    const { getProjects } = await load();
    expect((await getProjects()).length).toBe(seed.length);
  });
});
