import Link from "next/link";
import { adminGetPlatformSettings } from "@/app/actions/admin-brain";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { SettingsForms } from "./settings-forms";

export default async function AdminSettingsPage() {
  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Настройки платформы</h1>
        <p className="text-[var(--red)] text-sm">Настройте Supabase.</p>
      </div>
    );
  }

  let settings: Record<string, unknown> = {};
  try {
    settings = await adminGetPlatformSettings();
  } catch (e) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Настройки</h1>
        <p className="text-[var(--red)] text-sm">
          {e instanceof Error ? e.message : String(e)} — выполните миграции (
          <code>npm run db:push</code>).
        </p>
      </div>
    );
  }

  const rm = settings.rating_methodology as
    | { ru?: string; en?: string; weights?: unknown }
    | undefined;
  const ch = settings.catalog_headline as
    | { totalValueBnTHB?: number; quarterLabel?: string }
    | undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="serif text-2xl mb-1">Настройки платформы</h1>
        <p className="text-[var(--txt2)] text-sm mb-6">
          Тексты методологии (шкалы <code>rat</code>, <code>risk</code>,{" "}
          <code>rec</code>) и показатели страницы рынка. Тексты RU/EN
          используются на странице <Link href="/market">«Рынок»</Link>.
          Эти настройки не пересчитывают оценки проектов и не заменяют версионную методологию ClearView.
        </p>
      </div>

      <SettingsForms ratingMethodology={rm} catalogHeadline={ch} />

      <p className="text-sm pt-4">
        <Link href="/admin/projects" className="underline font-semibold">
          Редактировать карточки проектов →
        </Link>
      </p>
    </div>
  );
}

