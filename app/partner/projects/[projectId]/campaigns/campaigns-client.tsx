"use client";

import { useActionState } from "react";
import {
  deleteSalesCampaign,
  upsertSalesCampaign,
} from "@/app/actions/partner-marketplace";

type Row = {
  id: string;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  label_en: string;
  label_ru: string;
};

const initial = { ok: false as boolean, error: undefined as string | undefined };

export function CampaignsClient({
  projectId,
  campaigns,
  canEdit,
}: {
  projectId: string;
  campaigns: Row[];
  canEdit: boolean;
}) {
  const [saveState, saveAction] = useActionState(upsertSalesCampaign, initial);
  const [delState, delAction] = useActionState(deleteSalesCampaign, initial);

  return (
    <div className="space-y-8">
      {!canEdit ? (
        <p className="text-sm text-[var(--amb)] rounded border border-[var(--bdr)] px-3 py-2">
          Роль sales: просмотр только. Создание кампаний — владелец org.
        </p>
      ) : (
        <form action={saveAction} className="rounded-lg border border-[var(--bdr)] p-4 space-y-3">
          <input type="hidden" name="project_id" value={projectId} />
          <h2 className="font-semibold text-sm">Новая кампания</h2>
          <label className="block text-xs">
            Тип
            <select name="kind" className="block mt-1 border rounded px-2 py-1 w-full max-w-xs">
              <option value="launch">launch</option>
              <option value="sale">sale</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="block text-xs">
            Label EN
            <input name="label_en" className="block mt-1 border rounded px-2 py-1 w-full" />
          </label>
          <label className="block text-xs">
            Label RU
            <input name="label_ru" className="block mt-1 border rounded px-2 py-1 w-full" />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="text-xs">
              Старт
              <input type="datetime-local" name="starts_at" className="block mt-1 border rounded px-2 py-1" />
            </label>
            <label className="text-xs">
              Конец
              <input type="datetime-local" name="ends_at" className="block mt-1 border rounded px-2 py-1" />
            </label>
          </div>
          <button type="submit" className="admin-btn py-2 px-3">
            Сохранить кампанию
          </button>
          {saveState.ok ? <p className="text-sm text-[var(--grn)]">Готово</p> : null}
          {saveState.error ? <p className="text-sm text-[var(--red)]">{saveState.error}</p> : null}
        </form>
      )}

      <div>
        <h2 className="font-semibold text-sm mb-2">Список</h2>
        <ul className="space-y-4">
          {campaigns.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">Пока нет кампаний.</li>
          ) : (
            campaigns.map((c) => (
              <li
                key={c.id}
                className="rounded border border-[var(--bdr)] p-3 flex flex-wrap gap-4 justify-between items-start"
              >
                <div>
                  <p className="text-xs text-[var(--muted)]">{c.kind}</p>
                  <p className="font-medium">
                    {c.label_en || c.label_ru}
                    {c.label_ru && c.label_en ? ` / ${c.label_ru}` : null}
                  </p>
                  <p className="text-xs mt-1">
                    {c.starts_at ? new Date(c.starts_at).toLocaleString() : "—"} —{" "}
                    {c.ends_at ? new Date(c.ends_at).toLocaleString() : "—"}
                  </p>
                </div>
                {canEdit ? (
                  <form action={delAction}>
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <button type="submit" className="text-xs text-[var(--red)] underline">
                      Удалить
                    </button>
                  </form>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {delState.error ? <p className="text-sm text-[var(--red)] mt-2">{delState.error}</p> : null}
      </div>
    </div>
  );
}
