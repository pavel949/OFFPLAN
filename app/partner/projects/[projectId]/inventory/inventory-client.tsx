"use client";

import { useActionState } from "react";
import {
  confirmProjectData,
  importProjectUnits,
  upsertProjectUnit,
} from "@/app/actions/partner-marketplace";
import { UnitImportPanel } from "@/components/portal/UnitImportPanel";
import type { Freshness } from "@/lib/inventory/freshness";

type Unit = {
  id: string;
  label: string;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price_thb: number | null;
  currency: string;
  status: string;
  source: string;
  fresh: Freshness;
  ageDays: number | null;
};

const initial = { ok: false as boolean, error: undefined as string | undefined };

const STATUS_RU: Record<string, string> = {
  available: "Свободен",
  reserved: "Бронь",
  sold: "Продан",
};

const SOURCE_RU: Record<string, string> = {
  developer: "застройщик",
  import: "импорт",
  operator: "оператор платформы",
  api: "API",
};

function Badge({ u }: { u: Unit }) {
  if (u.status === "sold") return <span className="text-xs text-[var(--muted)]">—</span>;
  const map = {
    fresh: { t: "актуально", c: "var(--grn)" },
    stale: { t: "подтвердите", c: "var(--amb)" },
    expired: { t: "цена скрыта", c: "var(--red)" },
  }[u.fresh];
  return (
    <span className="text-xs" style={{ color: map.c }}>
      {map.t}
      {u.ageDays != null ? ` · ${u.ageDays} дн.` : ""}
    </span>
  );
}

export function InventoryClient({
  projectId,
  units,
}: {
  projectId: string;
  units: Unit[];
}) {
  const [unitState, unitAction] = useActionState(upsertProjectUnit, initial);
  const [confirmState, confirmAction] = useActionState(confirmProjectData, initial);

  return (
    <div className="space-y-8">
      <form action={confirmAction} className="rounded-lg border border-[var(--bdr)] p-4">
        <input type="hidden" name="project_id" value={projectId} />
        <p className="text-sm text-[var(--muted)] mb-2">
          Подтвердите, что цены и наличие актуальны на сегодня — это обновит дату на всех активных
          лотах и на карточке проекта.
        </p>
        <button type="submit" className="admin-btn py-2 px-3">
          Подтвердить актуальность сейчас
        </button>
        {confirmState.ok ? <p className="text-sm text-[var(--grn)] mt-2">Сохранено</p> : null}
        {confirmState.error ? (
          <p className="text-sm text-[var(--red)] mt-2">{confirmState.error}</p>
        ) : null}
      </form>

      <UnitImportPanel projectId={projectId} action={importProjectUnits} />

      <div className="overflow-x-auto">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Лоты ({units.length})</h2>
        {units.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Лотов пока нет. Загрузите прайс-лист выше или добавьте лот вручную.
          </p>
        ) : null}
        {units.map((u) => (
          <form
            key={u.id}
            action={unitAction}
            className="flex flex-wrap gap-2 items-end p-2 border-b border-[var(--bdr)]"
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="unit_id" value={u.id} />
            <label className="text-xs">
              Лот
              <input name="label" defaultValue={u.label} className="block border rounded px-1 w-24" required />
            </label>
            <label className="text-xs">
              Спальни
              <input name="bedrooms" defaultValue={u.bedrooms ?? ""} className="block border rounded px-1 w-16" />
            </label>
            <label className="text-xs">
              Площадь, м²
              <input name="sqm" defaultValue={u.sqm ?? ""} className="block border rounded px-1 w-20" />
            </label>
            <label className="text-xs">
              Цена ({u.currency})
              <input name="price_thb" defaultValue={u.price_thb ?? ""} className="block border rounded px-1 w-28" />
            </label>
            <label className="text-xs">
              Статус
              <select name="status" defaultValue={u.status} className="block border rounded px-1">
                {Object.entries(STATUS_RU).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="text-xs underline">
              Сохранить
            </button>
            <span className="ml-auto text-right">
              <Badge u={u} />
              <br />
              <span className="text-[10px] text-[var(--muted)]">источник: {SOURCE_RU[u.source] ?? u.source}</span>
            </span>
          </form>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Добавить лот вручную</h2>
        <form action={unitAction} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="project_id" value={projectId} />
          <label className="text-xs">
            Лот *
            <input name="label" className="block border rounded px-1 w-24" required />
          </label>
          <label className="text-xs">
            Спальни
            <input name="bedrooms" className="block border rounded px-1 w-16" />
          </label>
          <label className="text-xs">
            Площадь, м²
            <input name="sqm" className="block border rounded px-1 w-20" />
          </label>
          <label className="text-xs">
            Цена
            <input name="price_thb" className="block border rounded px-1 w-28" />
          </label>
          <select name="status" className="border rounded text-xs">
            {Object.entries(STATUS_RU).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit" className="admin-btn py-1 px-2 text-xs">
            Добавить
          </button>
        </form>
        {unitState.ok ? <p className="text-sm text-[var(--grn)] mt-2">Сохранено</p> : null}
        {unitState.error ? <p className="text-sm text-[var(--red)] mt-2">{unitState.error}</p> : null}
      </div>
    </div>
  );
}
