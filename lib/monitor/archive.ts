import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveScope, preparePriceList, type ArchivedPriceList, type PriceListFile } from "./intake";
import { comparePriceSnapshots } from "./compare";

const BUCKET = "project-docs";
const fields = "id,title,notes,storage_path,created_at";
type ArchiveRow = { id: string; title: string; notes: string; storage_path: string; created_at: string };
const pathPrefix = (projectId: string) => `${projectId}/price-monitor/`;
const readArchive = (row: ArchiveRow): ArchivedPriceList => JSON.parse(row.notes.slice(row.notes.indexOf("\n") + 1));

export async function registerPriceList(db: SupabaseClient, file: PriceListFile) {
  const bytes = Buffer.from(file.bytes);
  const entry = preparePriceList({ ...file, bytes });
  const { projectId } = entry.archive.snapshot.source;
  const { data: project, error: projectError } = await db.from("catalog_projects")
    .select("id").eq("id", projectId).maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("Проект не найден.");

  const { data: existing, error: lookupError } = await db.from("project_documents")
    .select("id").eq("id", entry.id).eq("project_id", projectId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { id: entry.id, duplicate: true };

  const { error: uploadError } = await db.storage.from(BUCKET).upload(entry.storagePath, bytes, {
    contentType: entry.mime, upsert: false,
  });
  // Concurrent upload or a retry after Storage succeeded but the DB write failed.
  if (uploadError && uploadError.status !== 409 && uploadError.statusCode !== "409" && uploadError.statusCode !== "Duplicate") throw uploadError;

  const { data, error } = await db.from("project_documents").upsert({
    id: entry.id,
    project_id: projectId,
    kind: "other",
    title: entry.title,
    storage_path: entry.storagePath,
    mime: entry.mime,
    file_size: bytes.length,
    notes: entry.notes,
  }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
  // Retain the immutable object on failure so a retry can finish registration safely.
  if (error) throw error;
  return { id: entry.id, duplicate: !data };
}

export const PRICE_LIST_PAGE_SIZE = 30;

export async function listPriceLists(db: SupabaseClient, projectId: string, offset = 0) {
  const { data, error } = await db.from("project_documents").select("id,title,created_at")
    .eq("project_id", projectId).like("storage_path", `${pathPrefix(projectId)}%`)
    .order("created_at", { ascending: false }).order("id").range(offset, offset + PRICE_LIST_PAGE_SIZE);
  if (error) throw error;
  return { entries: data.slice(0, PRICE_LIST_PAGE_SIZE), hasMore: data.length > PRICE_LIST_PAGE_SIZE };
}

export async function loadPriceListReview(db: SupabaseClient, projectId: string, id: string) {
  const { data: row, error } = await db.from("project_documents").select(fields)
    .eq("project_id", projectId).eq("id", id).like("storage_path", `${pathPrefix(projectId)}%`).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const archive = readArchive(row);
  const { source } = archive.snapshot;
  const query = () => db.from("project_documents").select(fields)
    .eq("project_id", projectId).like("storage_path", `${archiveScope(projectId, source.scope)}%`);
  const [latest, sameDate, older, original] = await Promise.all([
    query().order("notes", { ascending: false }).limit(1),
    query().like("notes", `${source.publishedAt}%`).neq("id", id).limit(1),
    query().lt("notes", source.publishedAt).order("notes", { ascending: false }).limit(2),
    db.storage.from(BUCKET).createSignedUrl(row.storage_path, 300, { download: row.title }),
  ]);
  if (latest.error) throw latest.error;
  if (sameDate.error) throw sameDate.error;
  if (older.error) throw older.error;

  const previous = older.data[0] ? readArchive(older.data[0]).snapshot : null;
  const ambiguousDate = sameDate.data.length > 0
    || (previous !== null && !!older.data[1]
      && readArchive(older.data[1]).snapshot.source.publishedAt === previous.source.publishedAt);
  const historical = latest.data.some((candidate) =>
    readArchive(candidate).snapshot.source.publishedAt > source.publishedAt);
  const comparison = ambiguousDate ? null : comparePriceSnapshots(
    previous ?? { source, units: [] }, archive.snapshot,
  );
  return { row, archive, previous: previous?.source ?? null, historical, ambiguousDate, comparison, original: original.data?.signedUrl };
}
