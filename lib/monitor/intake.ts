import { createHash } from "node:crypto";
import { z } from "zod";
import { DEFAULT_CURRENCY, parseInventoryText } from "../inventory/parse";
import { comparePriceSnapshots, type PriceSnapshot } from "./compare";

export const MAX_PRICE_LIST_BYTES = 256 * 1024;
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

const metadataSchema = z.object({
  projectId: z.uuid().transform((id) => id.toLowerCase()),
  url: z.url({ protocol: /^https$/, normalize: true }).max(1000).refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }),
  publishedAt: z.iso.datetime({ offset: true }),
  version: z.string().trim().min(1).max(100),
  scope: z.string().normalize().trim().min(1).max(100)
    .transform((value) => value.normalize("NFKC").replace(/\s+/g, " ").toUpperCase()),
  coverage: z.enum(["full", "partial", "unknown"]),
  origin: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("manual") }),
    z.object({
      kind: z.literal("telegram"),
      channelId: z.string().trim().min(1).max(100),
      messageId: z.string().trim().min(1).max(100),
      attachmentId: z.string().trim().min(1).max(200),
    }),
  ]),
});

export type PriceListFile = {
  metadata: z.input<typeof metadataSchema>;
  filename: string;
  bytes: Uint8Array;
};

/** A trusted worker resolves the canonical project/scope before yielding an attachment. */
export interface PriceListCollector {
  collect(signal?: AbortSignal): AsyncIterable<PriceListFile>;
}

export type ArchivedPriceList = {
  snapshot: PriceSnapshot;
  sha256: string;
  origin: PriceListFile["metadata"]["origin"];
};

export function archiveScope(projectId: string, scope: string) {
  return `${projectId}/price-monitor/${sha256(scope)}/`;
}

export function preparePriceList(file: PriceListFile) {
  const parsed = metadataSchema.safeParse(file.metadata);
  if (!parsed.success) throw new Error("Проверьте проект, HTTPS-ссылку, дату, версию и охват источника.");
  const { origin, ...metadata } = parsed.data;
  const publishedAt = new Date(metadata.publishedAt).toISOString();
  if (Date.parse(publishedAt) > Date.now()) throw new Error("Дата публикации ещё не наступила.");
  const format = file.filename.match(/\.(csv|tsv)$/i)?.[1].toLowerCase();
  if (!format || !file.bytes.length || file.bytes.length > MAX_PRICE_LIST_BYTES) {
    throw new Error("Загрузите CSV или TSV размером до 256 КБ.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch {
    throw new Error("Сохраните таблицу в UTF-8.");
  }
  if (text.includes("\0")) throw new Error("Файл должен быть текстовой таблицей.");
  const result = parseInventoryText(text, DEFAULT_CURRENCY, "monitor");
  if (result.errors.length || !result.rows.length) {
    throw new Error(result.errors.slice(0, 5).map((error) => `Строка ${error.line}: ${error.message}`).join(" · ") || "В таблице нет лотов.");
  }
  const snapshot: PriceSnapshot = {
    source: { ...metadata, publishedAt },
    units: result.rows.map(({ building, label, price, currency, status }) => ({
      building, unit: label, price, currency, status,
    })),
  };
  // Reuse the comparator's canonical identity and duplicate validation.
  comparePriceSnapshots({ source: snapshot.source, units: [] }, snapshot);
  const digest = sha256(file.bytes);
  const scope = archiveScope(metadata.projectId, metadata.scope);
  const storagePath = `${scope}${digest}`;
  const delivery = origin.kind === "telegram"
    ? [origin.kind, origin.channelId, origin.messageId, origin.attachmentId]
    : [origin.kind, metadata.url, publishedAt, metadata.version];
  const key = sha256(JSON.stringify([storagePath, delivery])).slice(0, 32);
  const id = `${key.slice(0, 8)}-${key.slice(8, 12)}-8${key.slice(13, 16)}-a${key.slice(17, 20)}-${key.slice(20)}`;
  const archive: ArchivedPriceList = { snapshot, sha256: digest, origin };
  return {
    id, archive, storagePath,
    title: file.filename.slice(0, 200),
    mime: format === "csv" ? "text/csv" : "text/tab-separated-values",
    notes: `${publishedAt}\n${JSON.stringify(archive)}`,
  };
}
