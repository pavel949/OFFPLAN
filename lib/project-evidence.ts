import { z } from "zod";
const httpsUrl = z
  .url()
  .refine((s) => s.startsWith("https://"), "Нужна ссылка HTTPS");
export const evidenceSchema = z
  .object({
    project_id: z.uuid(),
    kind: z.enum(["photo", "amenity", "operating_cost", "sales"]),
    fact_key: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(300),
    source_url: httpsUrl,
    observed_at: z.iso.date(),
    details: z.record(z.string(), z.unknown()),
  })
  .superRefine((v, c) => {
    const shape =
      v.kind === "photo"
        ? z.object({
            url: httpsUrl,
            caption: z.string().min(1).max(300),
            render: z.boolean().optional(),
            media_kind: z.enum(["photo", "render", "masterplan", "unit_plan", "type_plan"]).optional(),
            cover: z.boolean().optional(),
            sort_order: z.number().int().min(0).max(9999).optional(),
            unit_id: z.uuid().optional(),
            type_label: z.string().trim().min(1).max(120).optional(),
          })
        : v.kind === "operating_cost"
          ? z.object({
              amount: z.number().finite().nonnegative(),
              currency: z.string().regex(/^[A-Z]{3}$/),
              basis: z.enum(["unit", "sqm"]),
              period: z.enum(["month", "year", "once"]),
            })
          : v.kind === "sales"
            ? z.object({
                stage: z.enum([
                  "prelaunch",
                  "launch",
                  "selling",
                  "last_units",
                  "sold_out",
                ]),
                starts_at: z.iso.date().optional(),
                total_units: z.number().int().positive().optional(),
              })
            : z.object({ description: z.string().max(2000) });
    const r = shape.safeParse(v.details);
    if (!r.success)
      c.addIssue({
        code: "custom",
        message: r.error.issues[0]?.message ?? "Некорректные данные",
        path: ["details"],
      });
    if (v.kind === "photo" && v.details.media_kind === "unit_plan" && !v.details.unit_id)
      c.addIssue({ code: "custom", message: "Выберите лот для его планировки", path: ["details", "unit_id"] });
    if (v.kind === "photo" && v.details.media_kind === "type_plan" && !v.details.type_label)
      c.addIssue({ code: "custom", message: "Укажите название типа планировки", path: ["details", "type_label"] });
    if (v.observed_at > new Date().toISOString().slice(0, 10))
      c.addIssue({
        code: "custom",
        message: "Дата источника не может быть в будущем",
        path: ["observed_at"],
      });
  });
export type ProjectEvidence = {
  id: string;
  project_id: string;
  kind: "photo" | "amenity" | "operating_cost" | "sales";
  fact_key: string;
  title: string;
  source_url: string;
  observed_at: string;
  details: Record<string, unknown>;
  status: string;
  reviewed_at: string | null;
};
export type InventorySummary = {
  recorded: number;
  available: number;
  reserved: number;
  sold: number;
  updated_at: string | null;
};
export function operatingCostTotals(
  facts: ProjectEvidence[],
  sqm: number | null,
) {
  const totals = new Map<
    string,
    { annual: number; once: number; needsArea: boolean }
  >();
  for (const f of facts) {
    if (f.kind !== "operating_cost" || f.status !== "published") continue;
    const d = f.details;
    const amount = d.amount;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      typeof d.currency !== "string"
    )
      continue;
    const t = totals.get(d.currency) ?? {
      annual: 0,
      once: 0,
      needsArea: false,
    };
    if (d.basis === "sqm" && (sqm == null || !Number.isFinite(sqm) || sqm <= 0))
      t.needsArea = true;
    else {
      const value = amount * (d.basis === "sqm" ? sqm! : 1);
      if (d.period === "once") t.once += value;
      else t.annual += value * (d.period === "month" ? 12 : 1);
    }
    totals.set(d.currency, t);
  }
  return [...totals].map(([currency, v]) => ({ currency, ...v }));
}

/** Public URL of a file in the `project-photos` bucket (path = "<project_id>/<file>"). */
export function projectPhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/project-photos/${path}`;
}

export const PHOTO_PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;
