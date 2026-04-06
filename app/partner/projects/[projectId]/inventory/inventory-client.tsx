"use client";

import { useActionState } from "react";
import {
  confirmProjectData,
  upsertProjectUnit,
} from "@/app/actions/partner-marketplace";

type Unit = {
  id: string;
  label: string;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price_thb: number | null;
  status: string;
  updated_at?: string | null;
};

const initial = { ok: false as boolean, error: undefined as string | undefined };

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
          Подтвердите, что инвентарь и цены актуальны (дата на карточке проекта).
        </p>
        <button type="submit" className="admin-btn py-2 px-3">
          Подтвердить данные сейчас
        </button>
        {confirmState.ok ? (
          <p className="text-sm text-[var(--grn)] mt-2">Сохранено</p>
        ) : null}
        {confirmState.error ? (
          <p className="text-sm text-[var(--red)] mt-2">{confirmState.error}</p>
        ) : null}
      </form>

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Лот</th>
              <th>BR</th>
              <th>sqm</th>
              <th>฿ THB</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td colSpan={6} className="p-0">
                  <form action={unitAction} className="flex flex-wrap gap-2 items-end p-2 border-b border-[var(--bdr)]">
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="unit_id" value={u.id} />
                    <label className="text-xs">
                      Label
                      <input name="label" defaultValue={u.label} className="block border rounded px-1" required />
                    </label>
                    <label className="text-xs">
                      BR
                      <input
                        name="bedrooms"
                        defaultValue={u.bedrooms ?? ""}
                        className="block border rounded px-1 w-14"
                      />
                    </label>
                    <label className="text-xs">
                      sqm
                      <input name="sqm" defaultValue={u.sqm ?? ""} className="block border rounded px-1 w-16" />
                    </label>
                    <label className="text-xs">
                      Price
                      <input
                        name="price_thb"
                        defaultValue={u.price_thb ?? ""}
                        className="block border rounded px-1 w-24"
                      />
                    </label>
                    <label className="text-xs">
                      Status
                      <select name="status" defaultValue={u.status} className="block border rounded px-1">
                        <option value="available">available</option>
                        <option value="reserved">reserved</option>
                        <option value="sold">sold</option>
                      </select>
                    </label>
                    <button type="submit" className="text-xs underline">
                      Сохранить
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase mb-2">Добавить юнит</h2>
        <form action={unitAction} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="project_id" value={projectId} />
          <label className="text-xs">
            Label *
            <input name="label" className="block border rounded px-1" required />
          </label>
          <label className="text-xs">
            BR
            <input name="bedrooms" className="block border rounded px-1 w-14" />
          </label>
          <label className="text-xs">
            sqm
            <input name="sqm" className="block border rounded px-1 w-16" />
          </label>
          <label className="text-xs">
            Price THB
            <input name="price_thb" className="block border rounded px-1 w-24" />
          </label>
          <select name="status" className="border rounded text-xs">
            <option value="available">available</option>
            <option value="reserved">reserved</option>
            <option value="sold">sold</option>
          </select>
          <button type="submit" className="admin-btn py-1 px-2 text-xs">
            Добавить
          </button>
        </form>
        {unitState.ok ? (
          <p className="text-sm text-[var(--grn)] mt-2">Сохранено</p>
        ) : null}
        {unitState.error ? (
          <p className="text-sm text-[var(--red)] mt-2">{unitState.error}</p>
        ) : null}
      </div>
    </div>
  );
}