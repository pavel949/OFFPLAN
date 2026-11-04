import { z } from "zod";

/**
 * Project sources: links to the developer's own materials (brochure, renders, price list, availability
 * feed, master plan, Telegram channel, shared drive). Developers give agents links, not files, so the
 * platform stores links with a visibility level and a "confirmed current" date.
 */

export const SOURCE_KINDS = [
  "brochure",
  "renders",
  "price_list",
  "availability",
  "masterplan",
  "floorplans",
  "legal_docs",
  "data_room",
  "telegram",
  "video",
  "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_VISIBILITY = ["public", "partners", "internal"] as const;
export type SourceVisibility = (typeof SOURCE_VISIBILITY)[number];

export const SOURCE_CADENCE = ["none", "on_change", "daily", "weekly", "monthly"] as const;
export type SourceCadence = (typeof SOURCE_CADENCE)[number];

export const SOURCE_KIND_LABEL_RU: Record<SourceKind, string> = {
  brochure: "Брошюра",
  renders: "Рендеры и фото",
  price_list: "Прайс-лист",
  availability: "Наличие лотов",
  masterplan: "Мастер-план",
  floorplans: "Планировки",
  legal_docs: "Юридические документы",
  data_room: "Папка застройщика (всё вместе)",
  telegram: "Telegram-канал / группа",
  video: "Видео",
  other: "Другое",
};
export const SOURCE_KIND_LABEL_EN: Record<SourceKind, string> = {
  brochure: "Brochure",
  renders: "Renders & photos",
  price_list: "Price list",
  availability: "Availability",
  masterplan: "Master plan",
  floorplans: "Floor plans",
  legal_docs: "Legal documents",
  data_room: "Developer folder (everything)",
  telegram: "Telegram channel / group",
  video: "Video",
  other: "Other",
};

export const VISIBILITY_LABEL_RU: Record<SourceVisibility, string> = {
  public: "Видна всем на странице проекта",
  partners: "Только партнёры и команда IE",
  internal: "Только команда IE",
};

export const CADENCE_LABEL_RU: Record<SourceCadence, string> = {
  none: "Не обновляется",
  on_change: "При изменениях",
  daily: "Ежедневно",
  weekly: "Раз в неделю",
  monthly: "Раз в месяц",
};

/** Days after which a confirmed source is considered stale for each cadence (null = never stale). */
const STALE_AFTER_DAYS: Record<SourceCadence, number | null> = {
  none: null,
  on_change: 30,
  daily: 3,
  weekly: 10,
  monthly: 40,
};

export function sourceFreshness(
  cadence: SourceCadence,
  confirmedAt: string | null,
  now: Date = new Date(),
): "fresh" | "stale" | "unconfirmed" {
  if (!confirmedAt) return "unconfirmed";
  const limit = STALE_AFTER_DAYS[cadence];
  if (limit == null) return "fresh";
  const ageDays = (now.getTime() - new Date(confirmedAt).getTime()) / 86_400_000;
  return ageDays > limit ? "stale" : "fresh";
}

/** Only absolute https links; no credentials in the URL, no whitespace. */
export function normalizeSourceUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s) || s.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  return u.toString();
}

/** Human label of the hosting service, to show next to a link ("Google Drive", "Telegram"…). */
export function sourceHost(url: string): string {
  let h = "";
  try {
    h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
  if (h === "drive.google.com" || h === "docs.google.com") return "Google Drive";
  if (h === "t.me" || h === "telegram.me") return "Telegram";
  if (h.endsWith("dropbox.com")) return "Dropbox";
  if (h.endsWith("onedrive.live.com") || h.endsWith("sharepoint.com") || h === "1drv.ms") return "OneDrive";
  if (h.endsWith("notion.so") || h.endsWith("notion.site")) return "Notion";
  if (h.endsWith("yadi.sk") || h.startsWith("disk.yandex")) return "Яндекс Диск";
  if (h === "youtu.be" || h.endsWith("youtube.com")) return "YouTube";
  if (h.endsWith("vimeo.com")) return "Vimeo";
  return h;
}

export const sourceInputSchema = z.object({
  project_id: z.uuid(),
  kind: z.enum(SOURCE_KINDS),
  title: z.string().trim().min(1, "Укажите название").max(200),
  url: z
    .string()
    .transform((s, ctx) => {
      const n = normalizeSourceUrl(s);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Нужна ссылка вида https://…" });
        return z.NEVER;
      }
      return n;
    }),
  visibility: z.enum(SOURCE_VISIBILITY).default("partners"),
  cadence: z.enum(SOURCE_CADENCE).default("none"),
  note: z.string().trim().max(1000).default(""),
});
export type SourceInput = z.infer<typeof sourceInputSchema>;

export type ProjectSourceRow = {
  id: string;
  project_id: string;
  kind: SourceKind;
  title: string;
  url: string;
  visibility: SourceVisibility;
  cadence: SourceCadence;
  note: string;
  confirmed_at: string | null;
  created_at: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_note: string;
};

export type PublicSource = Pick<
  ProjectSourceRow,
  "id" | "project_id" | "kind" | "title" | "url" | "cadence" | "confirmed_at"
>;
