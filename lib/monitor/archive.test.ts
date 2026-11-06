import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listPriceLists, loadPriceListReview, registerPriceList } from "./archive";
import { priceFile, projectId } from "./fixture";

type Archive = { id: string; project_id: string; notes: string; storage_path: string };
function fakeSupabase() {
  const files = new Map<string, Uint8Array>();
  const documents = new Map<string, Archive>();
  const writes: string[] = [];
  let failRegistration = false;
  const db = createClient("https://supabase.example.invalid", "test-only", {
    auth: { persistSession: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      const { pathname: path, searchParams: query } = url;
      const method = options?.method ?? "GET";
      if (path.startsWith("/storage/v1/object/sign/project-docs/") && method === "POST") {
        return Response.json({ signedURL: "/object/sign/original?token=mock" });
      }
      if (method !== "GET") writes.push(`${method} ${path}`);
      if (path.startsWith("/storage/v1/object/project-docs/") && method === "POST") {
        expect(new Headers(options?.headers).get("x-upsert")).toBe("false");
        if (files.has(path)) return Response.json({ code: "Duplicate", message: "Already exists" }, { status: 409 });
        files.set(path, new Uint8Array(options?.body as Uint8Array));
        return Response.json({ Key: path });
      }
      if (path === "/rest/v1/catalog_projects" && method === "GET") {
        return Response.json(query.get("id") === `eq.${projectId}` ? [{ id: projectId }] : []);
      }
      if (path !== "/rest/v1/project_documents") throw new Error(`Unexpected request ${method} ${path}`);
      if (method === "POST") {
        if (failRegistration) {
          failRegistration = false;
          return Response.json({ message: "Temporary registration failure" }, { status: 500 });
        }
        expect(new Headers(options?.headers).get("prefer")).toContain("resolution=ignore-duplicates");
        expect(query.get("on_conflict")).toBe("id");
        const row = JSON.parse(String(options?.body)) as Archive;
        if (documents.has(row.id)) return Response.json([]);
        documents.set(row.id, row);
        return Response.json([{ id: row.id }]);
      }
      expect(method).toBe("GET");
      const prefix = (field: string) => query.get(field)?.slice(5, -1);
      const scope = prefix("storage_path");
      const rows = [...documents.values()]
        .filter((row) => query.get("project_id") === `eq.${row.project_id}`)
        .filter((row) => !scope || row.storage_path.startsWith(scope))
        .filter((row) => query.get("id") !== `neq.${row.id}` && (!query.get("id")?.startsWith("eq.") || query.get("id") === `eq.${row.id}`))
        .filter((row) => !query.get("notes") || (query.get("notes")?.startsWith("lt.")
          ? row.notes < query.get("notes")!.slice(3)
          : row.notes.startsWith(prefix("notes")!)))
        .sort((a, b) => a.notes < b.notes ? 1 : -1);
      return Response.json(rows.slice(0, Number(query.get("limit") ?? rows.length)));
    } },
  });
  return { db, files, documents, writes, failNextRegistration: () => { failRegistration = true; } };
}

describe("private price-list registration and review", () => {
  it("is idempotent under concurrency and cannot write working or published prices", async () => {
    const { db, files, documents, writes } = fakeSupabase();
    const file = priceFile();
    const results = await Promise.all([registerPriceList(db, file), registerPriceList(db, file)]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect(results[0].id).toBe(results[1].id);
    expect(files.size).toBe(1);
    expect([...files.values()][0]).toEqual(file.bytes);
    expect(documents.size).toBe(1);
    const writeCount = writes.length;
    const review = await loadPriceListReview(db, projectId, results[0].id);
    expect(review?.comparison?.changes).toMatchObject([{ kind: "new", next: { status: "hold" } }]);
    expect(await listPriceLists(db, projectId)).toMatchObject({ entries: [{ id: results[0].id }], hasMore: false });
    expect(writes).toHaveLength(writeCount);
    expect(writes.every((write) => /^POST (\/storage\/v1\/object\/project-docs\/|\/rest\/v1\/project_documents$)/.test(write))).toBe(true);
  });

  it("completes an interrupted registration without overwriting the original", async () => {
    const store = fakeSupabase();
    store.failNextRegistration();
    await expect(registerPriceList(store.db, priceFile())).rejects.toMatchObject({ message: "Temporary registration failure" });
    expect(store.files.size).toBe(1);
    expect(store.documents.size).toBe(0);
    expect(await registerPriceList(store.db, priceFile())).toMatchObject({ duplicate: false });
    expect(await registerPriceList(store.db, priceFile())).toMatchObject({ duplicate: true });
    expect(store.files.size).toBe(1);
    expect(store.documents.size).toBe(1);
  });

  it("orders by publication time within scope, handles partial status changes and blocks ambiguous dates", async () => {
    const { db, files } = fakeSupabase();
    const later = priceFile("G,G409,8500000,Reserved,THB", {
      publishedAt: "2025-10-26T10:00:00+07:00", version: "V5", coverage: "partial",
    });
    const current = await registerPriceList(db, later);
    const previous = await registerPriceList(db, priceFile("G,G409,8500000,Hold,THB\nG,G410,9000000,available,THB"));
    await registerPriceList(db, priceFile(undefined, { scope: "Другой корпус", publishedAt: later.metadata.publishedAt }));
    expect(await loadPriceListReview(db, projectId, current.id)).toMatchObject({
      previous: { version: "V4" },
      historical: false,
      comparison: { changes: [{ kind: "status", previous: "hold", next: "reserved" }], absencesCompared: false },
    });
    expect(await loadPriceListReview(db, projectId, previous.id)).toMatchObject({ historical: true });
    const reissued = await registerPriceList(db, { ...later, metadata: { ...later.metadata, version: "V5b" } });
    expect(reissued).toMatchObject({ duplicate: false });
    expect(files.size).toBe(3);
    expect(await loadPriceListReview(db, projectId, current.id)).toMatchObject({ ambiguousDate: true, comparison: null });
  });

  it("does not archive a file against a missing project", async () => {
    const { db, writes } = fakeSupabase();
    await expect(registerPriceList(db, priceFile(undefined, { projectId: "73fe1eaf-9f70-4236-93cb-65d83690fd40" }))).rejects.toThrow("Проект не найден");
    expect(writes).toEqual([]);
  });
});
