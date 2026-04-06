"use client";

import { useActionState } from "react";
import {
  adminSaveCatalogHeadline,
  adminSaveRatingMethodology,
} from "@/app/actions/admin-brain";

type Rm = { ru?: string; en?: string; weights?: unknown };
type Ch = { totalValueBnTHB?: number; quarterLabel?: string };

export function SettingsForms({
  ratingMethodology,
  catalogHeadline,
}: {
  ratingMethodology: Rm | undefined;
  catalogHeadline: Ch | undefined;
}) {
  const weightsStr = ratingMethodology?.weights
    ? JSON.stringify(ratingMethodology.weights, null, 2)
    : '{\n  "rat": "0–10",\n  "risk": "1–3",\n  "rec": "BUY | WATCH | AVOID"\n}';

  const [rmState, rmAction] = useActionState(
    async (_: { ok: boolean; error?: string }, fd: FormData) => {
      return adminSaveRatingMethodology(fd);
    },
    { ok: false },
  );

  const [chState, chAction] = useActionState(
    async (_: { ok: boolean; error?: string }, fd: FormData) => {
      return adminSaveCatalogHeadline(fd);
    },
    { ok: false },
  );

  return (
    <>
      <section>
        <h2 className="serif text-lg mb-2">Методология рейтинга</h2>
        <form action={rmAction} className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Описание (RU)</span>
            <textarea
              name="ru"
              rows={5}
              className="admin-inp mb-0 min-h-[100px]"
              defaultValue={ratingMethodology?.ru ?? ""}
              placeholder="Шкала rat, risk, источники данных…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Описание (EN)</span>
            <textarea
              name="en"
              rows={5}
              className="admin-inp mb-0 min-h-[100px]"
              defaultValue={ratingMethodology?.en ?? ""}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Веса / шкалы (JSON)</span>
            <textarea
              name="weights"
              rows={8}
              className="admin-inp mb-0 font-mono text-xs"
              defaultValue={weightsStr}
            />
          </label>
          <button type="submit" className="admin-btn w-fit">
            Сохранить методологию
          </button>
          {rmState?.ok ? (
            <p className="text-sm text-[var(--grn)]">Сохранено.</p>
          ) : null}
          {rmState?.error ? (
            <p className="text-sm text-[var(--red)]">{rmState.error}</p>
          ) : null}
        </form>
      </section>

      <section className="mt-10">
        <h2 className="serif text-lg mb-2">Шапка каталога (главная)</h2>
        <form action={chAction} className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Квартал (лейбл)</span>
            <input
              name="quarterLabel"
              className="admin-inp mb-0 w-40"
              defaultValue={catalogHeadline?.quarterLabel ?? "Q2 2026"}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Объём рынка (Bn THB)</span>
            <input
              name="totalValueBnTHB"
              type="number"
              step="0.1"
              className="admin-inp mb-0 w-32 tabular-nums"
              defaultValue={catalogHeadline?.totalValueBnTHB ?? 71}
            />
          </label>
          <button type="submit" className="admin-btn w-fit">
            Сохранить
          </button>
          {chState?.ok ? (
            <p className="text-sm text-[var(--grn)] w-full">Сохранено.</p>
          ) : null}
          {chState?.error ? (
            <p className="text-sm text-[var(--red)] w-full">{chState.error}</p>
          ) : null}
        </form>
      </section>
    </>
  );
}
