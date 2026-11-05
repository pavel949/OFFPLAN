import { createSign } from "node:crypto";
import { GOOGLE_FOLDER, GOOGLE_SHEET, type DriveFile } from "./pick";

/**
 * Read-only Google Drive access through ONE platform service account. A developer shares a folder with
 * the service account's e-mail (Viewer); we never ask for the developer's Google credentials.
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON = the key file contents (server only).
 */
type Account = { client_email: string; private_key: string };

export class DriveError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "no_access" | "unsupported" | "too_large" | "failed",
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export function serviceAccount(env: NodeJS.ProcessEnv = process.env): Account | null {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<Account>;
    if (typeof j.client_email === "string" && typeof j.private_key === "string")
      return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    /* fall through */
  }
  return null;
}

export function hasDriveConfig(): boolean {
  return serviceAccount() !== null;
}

const b64u = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

export function signJwt(acc: Account, now = Math.floor(Date.now() / 1000)): string {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(
    JSON.stringify({
      iss: acc.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(acc.private_key);
  return `${head}.${body}.${b64u(sig)}`;
}

type F = typeof fetch;
let cached: { token: string; exp: number } | null = null;

async function accessToken(fetchImpl: F): Promise<string> {
  const acc = serviceAccount();
  if (!acc) throw new DriveError("Google Drive не настроен на сервере (GOOGLE_SERVICE_ACCOUNT_JSON).", "not_configured");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(acc),
    }),
  });
  if (!res.ok) throw new DriveError("Не удалось авторизоваться в Google Drive.", "failed");
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new DriveError("Google не выдал токен доступа.", "failed");
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

function mapStatus(status: number): DriveError {
  if (status === 403 || status === 404)
    return new DriveError(
      "Нет доступа к папке или файлу: откройте доступ «Читатель» для сервисного аккаунта IE.",
      "no_access",
    );
  return new DriveError(`Ошибка Google Drive (${status}).`, "failed");
}

const API = "https://www.googleapis.com/drive/v3";
export const MAX_FILE_BYTES = 2_000_000;

/** Bound synchronous requests: fail rather than silently return an incomplete inventory. */
export const MAX_FOLDER_ENTRIES = 1000;
export const MAX_FOLDER_REQUESTS = 50;
export const MAX_FOLDER_DEPTH = 8;

export async function listFolder(folderId: string, fetchImpl: F = fetch): Promise<DriveFile[]> {
  const token = await accessToken(fetchImpl);
  if (!/^[A-Za-z0-9_-]+$/.test(folderId))
    throw new DriveError("Некорректный ID папки.", "unsupported");
  const queue = [{ id: folderId, path: "", depth: 0 }];
  const seenFolders = new Set([folderId]);
  const seenFiles = new Set<string>();
  const files: DriveFile[] = [];
  let requests = 0;
  let entries = 0;
  const limit = () => new DriveError(
    "Папка превышает лимит просмотра (1000 записей, 50 запросов или 8 уровней). Укажите ссылку на меньшую подпапку. Неполный список не импортирован.",
    "too_large",
  );
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const folder = queue[cursor];
    let pageToken: string | undefined;
    const seenPages = new Set<string>();
    do {
      if (++requests > MAX_FOLDER_REQUESTS) throw limit();
      const params = new URLSearchParams({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,size)",
        orderBy: "modifiedTime desc",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetchImpl(`${API}/files?${params}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw mapStatus(res.status);
      const j = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string; incompleteSearch?: boolean };
      if (j.incompleteSearch) throw new DriveError("Google вернул неполный список файлов. Повторите просмотр позже.", "failed");
      for (const file of j.files ?? []) {
        if (++entries > MAX_FOLDER_ENTRIES) throw limit();
        const path = folder.path ? `${folder.path}/${file.name}` : file.name;
        if (file.mimeType === GOOGLE_FOLDER) {
          if (seenFolders.has(file.id)) continue;
          if (folder.depth >= MAX_FOLDER_DEPTH) throw limit();
          // Only actual descendants are followed. Shortcuts never widen the source's scope.
          if (!/^[A-Za-z0-9_-]+$/.test(file.id)) throw new DriveError("Некорректный ID вложенной папки.", "failed");
          seenFolders.add(file.id);
          queue.push({ id: file.id, path, depth: folder.depth + 1 });
        } else if (!seenFiles.has(file.id)) {
          seenFiles.add(file.id);
          files.push({ ...file, path });
        }
      }
      pageToken = j.nextPageToken;
      if (pageToken) {
        if (seenPages.has(pageToken)) throw new DriveError("Google повторил страницу списка файлов.", "failed");
        seenPages.add(pageToken);
      }
    } while (pageToken);
  }
  return files;
}

export async function getFileMeta(fileId: string, fetchImpl: F = fetch): Promise<DriveFile> {
  const token = await accessToken(fetchImpl);
  const res = await fetchImpl(
    `${API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,size&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw mapStatus(res.status);
  return (await res.json()) as DriveFile;
}

/** Text of a Google Sheet (first sheet, CSV export) or of a CSV/TSV file. */
export async function fetchFileText(file: DriveFile, fetchImpl: F = fetch): Promise<string> {
  const token = await accessToken(fetchImpl);
  const base = `${API}/files/${encodeURIComponent(file.id)}`;
  const url =
    file.mimeType === GOOGLE_SHEET
      ? `${base}/export?mimeType=${encodeURIComponent("text/csv")}`
      : `${base}?alt=media&supportsAllDrives=true`;
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw mapStatus(res.status);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_FILE_BYTES) throw new DriveError("Файл слишком большой (более 2 МБ).", "too_large");
  const text = await res.text();
  if (text.length > MAX_FILE_BYTES) throw new DriveError("Файл слишком большой (более 2 МБ).", "too_large");
  return text;
}

export function __resetDriveTokenCache() {
  cached = null;
}
