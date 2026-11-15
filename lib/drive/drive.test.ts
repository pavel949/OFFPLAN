import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError, __resetDriveTokenCache, fetchFileText, listFolder, signJwt } from "./client";
import { isImportable, rankFiles, type DriveFile } from "./pick";
import { parseDriveUrl } from "./url";

describe("parseDriveUrl", () => {
  it("recognises folders, files and sheets", () => {
    expect(parseDriveUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn?usp=sharing")).toEqual({ kind: "folder", id: "1AbCdEfGhIjKlMn" });
    expect(parseDriveUrl("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMn")).toEqual({ kind: "folder", id: "1AbCdEfGhIjKlMn" });
    expect(parseDriveUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view")).toEqual({ kind: "file", id: "1AbCdEfGhIjKlMn" });
    expect(parseDriveUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMn/edit#gid=0")).toEqual({ kind: "sheet", id: "1AbCdEfGhIjKlMn" });
    expect(parseDriveUrl("https://drive.google.com/open?id=1AbCdEfGhIjKlMn")).toEqual({ kind: "file", id: "1AbCdEfGhIjKlMn" });
  });
  it("rejects other hosts, schemes and junk", () => {
    expect(parseDriveUrl("https://evil.example/drive/folders/1AbCdEfGhIjKlMn")).toBeNull();
    expect(parseDriveUrl("http://drive.google.com/drive/folders/1AbCdEfGhIjKlMn")).toBeNull();
    expect(parseDriveUrl("https://drive.google.com/drive/my-drive")).toBeNull();
    expect(parseDriveUrl("not a url")).toBeNull();
  });
});

const f = (o: Partial<DriveFile>): DriveFile => ({ id: "x", name: "a", mimeType: "application/pdf", modifiedTime: "2026-01-01T00:00:00Z", ...o });

describe("rankFiles", () => {
  it("puts importable price lists first and newest first", () => {
    const r = rankFiles([
      f({ id: "pdf", name: "Brochure.pdf" }),
      f({ id: "old", name: "Price list.csv", mimeType: "text/csv", modifiedTime: "2026-02-01T00:00:00Z" }),
      f({ id: "new", name: "Прайс.csv", mimeType: "text/csv", modifiedTime: "2026-03-01T00:00:00Z" }),
      f({ id: "dir", name: "Renders", mimeType: "application/vnd.google-apps.folder" }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["new", "old", "pdf"]);
  });
  it("treats Google Sheets and csv extensions as importable", () => {
    expect(isImportable(f({ mimeType: "application/vnd.google-apps.spreadsheet" }))).toBe(true);
    expect(isImportable(f({ name: "units.CSV" }))).toBe(true);
    expect(isImportable(f({ name: "units.pdf" }))).toBe(false);
  });
});

describe("drive client (mocked network)", () => {
  beforeEach(() => {
    __resetDriveTokenCache();
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "sa@proj.iam.gserviceaccount.com", private_key: privateKey });
  });
  it("signs a three-part RS256 JWT", () => {
    const jwt = signJwt(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!), 1_700_000_000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString()).scope).toContain("drive.readonly");
    expect(s.length).toBeGreaterThan(100);
  });
  it("lists a folder and maps 404 to a no-access error", async () => {
    const ok = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      return new Response(JSON.stringify({ files: [{ id: "1", name: "Price.csv", mimeType: "text/csv", modifiedTime: "2026-03-01T00:00:00Z" }] }));
    });
    expect(await listFolder("1AbCdEfGhIjKlMn", ok as unknown as typeof fetch)).toHaveLength(1);
    __resetDriveTokenCache();
    const denied = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "t" })) : new Response("{}", { status: 404 }),
    );
    await expect(listFolder("1AbCdEfGhIjKlMn", denied as unknown as typeof fetch)).rejects.toMatchObject({ code: "no_access" });
  });
  it("paginates and reads nested folders, preserving paths without following shortcuts", async () => {
    const calls: URL[] = [];
    const net = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      if (u.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "t" });
      calls.push(u);
      if (u.searchParams.get("q")?.startsWith("'child'"))
        return Response.json({ files: [f({ id: "pdf", name: "Brochure.pdf" }), f({ id: "root", mimeType: "application/vnd.google-apps.folder" })] });
      if (u.searchParams.get("pageToken") === "page2")
        return Response.json({ files: [f({ id: "link", mimeType: "application/vnd.google-apps.shortcut" })] });
      return Response.json({ files: [f({ id: "child", name: "Documents", mimeType: "application/vnd.google-apps.folder" })], nextPageToken: "page2" });
    });
    const files = await listFolder("root", net as typeof fetch);
    expect(files.map(x => x.id)).toEqual(["link", "pdf"]);
    expect(files[1].path).toBe("Documents/Brochure.pdf");
    expect(calls).toHaveLength(3);
    expect(calls[0].searchParams.get("fields")).toContain("nextPageToken");
  });
  it("fails closed on incomplete results, repeated pages and inaccessible descendants", async () => {
    for (const mode of ["incomplete", "repeat", "denied"]) {
      __resetDriveTokenCache();
      const net = vi.fn(async (url: string | URL | Request) => {
        const u = new URL(String(url));
        if (u.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "t" });
        if (mode === "incomplete") return Response.json({ incompleteSearch: true, files: [f({ id: "partial" })] });
        if (mode === "repeat") return Response.json({ files: [], nextPageToken: "same" });
        if (u.searchParams.get("q")?.startsWith("'child'")) return new Response("{}", { status: 403 });
        return Response.json({ files: [f({ id: "child", mimeType: "application/vnd.google-apps.folder" })] });
      });
      await expect(listFolder("root", net as typeof fetch)).rejects.toMatchObject({ code: mode === "denied" ? "no_access" : "failed" });
    }
  });
  it("refuses excessive depth and oversized inventories rather than silently truncating", async () => {
    for (const mode of ["depth", "size"]) {
      __resetDriveTokenCache();
      let depth = 0;
      const net = vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes("oauth2")) return Response.json({ access_token: "t" });
        return Response.json({ files: mode === "size" ? Array.from({ length: 1001 }, (_, i) => f({ id: String(i) }))
          : [f({ id: `child${++depth}`, mimeType: "application/vnd.google-apps.folder" })] });
      });
      await expect(listFolder("root", net as typeof fetch)).rejects.toMatchObject({ code: "too_large" });
    }
  });
  it("caps requests even when each page is empty and has a fresh token", async () => {
    let requests = 0;
    const net = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("oauth2")) return Response.json({ access_token: "t" });
      return Response.json({ files: [], nextPageToken: `page${++requests}` });
    });
    await expect(listFolder("root", net as typeof fetch)).rejects.toMatchObject({ code: "too_large" });
    expect(requests).toBe(50);
  });
  it("exports sheets as csv and refuses oversized files", async () => {
    const calls: string[] = [];
    const net = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      return new Response("Лот,Цена\nA1,100", { headers: { "content-length": "20" } });
    });
    const text = await fetchFileText({ id: "S1", name: "x", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "" }, net as unknown as typeof fetch);
    expect(text).toContain("A1");
    expect(calls.some((c) => c.includes("/export?mimeType=text%2Fcsv"))).toBe(true);
    __resetDriveTokenCache();
    const big = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "t" })) : new Response("x", { headers: { "content-length": "5000000" } }),
    );
    await expect(fetchFileText({ id: "S2", name: "x.csv", mimeType: "text/csv", modifiedTime: "" }, big as unknown as typeof fetch)).rejects.toBeInstanceOf(DriveError);
  });
});
