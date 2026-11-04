import { z } from "zod";
import { slugify } from "./slug";

export const inviteSchema = z.object({
  name_ru: z.string().trim().min(2, "Укажите название компании").max(200),
  name_en: z.string().trim().max(200).default(""),
  email: z.string().trim().toLowerCase().pipe(z.email("Некорректный e-mail")),
  full_name: z.string().trim().max(200).default(""),
  website: z
    .string()
    .trim()
    .max(500)
    .refine((s) => s === "" || /^https:\/\/\S+$/.test(s), "Сайт: ссылка вида https://…")
    .default(""),
});
export type InviteInput = z.infer<typeof inviteSchema>;

/** Org slug: latin transliteration is not attempted; unique suffix keeps it collision-free. */
export function orgSlug(nameRuOrEn: string, suffix: string): string {
  return `${slugify(nameRuOrEn)}-${suffix}`.slice(0, 90);
}
