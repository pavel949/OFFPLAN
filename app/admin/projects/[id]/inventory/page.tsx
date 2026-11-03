import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminGetProjectPayload,
  adminImportProjectUnits,
  adminListProjectUnits,
} from "@/app/actions/admin-brain";
import { UnitImportPanel } from "@/components/portal/UnitImportPanel";
import { daysSince, formatPrice, freshnessOf, summarizeFreshness } from "@/lib/inventory/freshness";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

const STATUS_RU: Record<string, string> = { available: "Свободен", reserved: "Бронь", sold: "Продан" };
const SOURCE_RU: Record<string, string> = {
  developer: "застройщик",
  import: "импорт застройщика",
  operator: "оператор платформы",
  api: "API",
};
const FRESH_RU = { fresh: "актуально", stale: "подтвердите", expired: "цена скрыта" } as const;
const FRESH_COLOR = { fresh: "var(--grn)", stale: "var(--amb)", expired: "var(--red)" } as const;

export default async function AdminProjectInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasSupabaseServiceConfig()) {
    return <p className="text-[var(--red)] text-sm">Настройте Supabase (service role).</p>;
  }
  let slug = "";
  let units: Awaited<ReturnType<typeof adminListProjectUnits>> = [];
  try {
    slug = (await adminGetProjectPayload(id)).slug;
    units = await adminListProjectUnits(id);
  } catch {
    notFound();
  }
  const now = Date.now();
  const sum = summarizeFreshness(units, now);

  return (
    <div className="max-w-4xl">
      <p className="mb-4">
        <Link href={`/admin/projects/${id}`} className="text-sm text-[var(--txt2)] underline">
          ← {slug}
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Прайс-лист и инвентарь</h1>
      <p className="text-sm text-[var(--txt2)] mb-6">
        Вы вносите данные от имени застройщика: лоты получат пометку «оператор платформы».
        Активных лотов: <b>{sum.active}</b> · актуальны: {sum.fresh} · требуют подтверждения:{" "}
        {sum.stale} · цены скрыты: {sum.expired}
      </p>

      <div className="mb-8">
        <UnitImportPanel projectId={id} action={adminImportProjectUnits} operator />
      </div>

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Лот</th>
              <th>Спальни</th>
              <th>Этаж</th>
              <th>м²</th>
              <th>Цена</th>
              <th>Статус</th>
              <th>Свежесть</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const f = freshnessOf(u.price_updated_at, now);
              return (
                <tr key={u.id}>
                  <td>{u.label}</td>
                  <td>{u.bedrooms ?? "—"}</td>
                  <td>{u.floor ?? "—"}</td>
                  <td>{u.sqm ?? "—"}</td>
                  <td>{formatPrice(u.price_thb, u.currency, "ru")}</td>
                  <td>{STATUS_RU[u.status] ?? u.status}</td>
                  <td style={{ color: u.status === "sold" ? undefined : FRESH_COLOR[f] }}>
                    {u.status === "sold" ? "—" : `${FRESH_RU[f]} · ${daysSince(u.price_updated_at, now) ?? "?"} дн.`}
                  </td>
                  <td>{SOURCE_RU[u.source] ?? u.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {units.length === 0 ? <p className="text-sm text-[var(--txt2)] mt-2">Лотов пока нет.</p> : null}
      </div>
    </div>
  );
}
