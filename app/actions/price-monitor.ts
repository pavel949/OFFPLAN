"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { registerPriceList } from "@/lib/monitor/archive";
import { MAX_PRICE_LIST_BYTES } from "@/lib/monitor/intake";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function adminRegisterPriceList(projectId: string, _: { error?: string }, form: FormData) {
  if (!(await getAdminSessionOk())) return { error: "Нужен вход в панель IE." };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_PRICE_LIST_BYTES) {
    return { error: "Выберите CSV или TSV размером до 256 КБ." };
  }
  const coverage = form.get("coverage");
  if (coverage !== "full" && coverage !== "partial" && coverage !== "unknown") {
    return { error: "Укажите охват прайс-листа." };
  }
  const date = String(form.get("published_at") ?? "");
  try {
    const result = await registerPriceList(createServiceRoleClient(), {
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      metadata: {
        projectId,
        origin: { kind: "manual" },
        url: String(form.get("url") ?? ""),
        publishedAt: `${date}+07:00`,
        version: String(form.get("version") ?? ""),
        scope: String(form.get("scope") ?? ""),
        coverage,
      },
    });
    revalidatePath(`/admin/projects/${projectId}/inventory/price-lists`);
    return result;
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    console.error("[price-monitor] registration failed", error);
    return { error: "Не удалось зарегистрировать прайс. Повторная загрузка безопасна." };
  }
}
