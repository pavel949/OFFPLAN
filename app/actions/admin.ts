"use server";

import fs from "fs";
import path from "path";
import { catalogProjectsSchema } from "@/lib/schema";

export async function importProjectsJson(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const secret = String(formData.get("secret") ?? "");
  const payload = String(formData.get("payload") ?? "");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    const data = catalogProjectsSchema.parse(parsed);
    const out = path.join(process.cwd(), "data", "seed", "projects.json");
    fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
