"use client";

import { useActionState, useState } from "react";
import type { ImportState } from "@/lib/inventory/run";

const initial: ImportState = { ok: false };

const TEMPLATE =
  "Лот,Спальни,Этаж,Площадь,Цена,Валюта,Статус\nA-101,1,3,45.5,9500000,THB,свободен\nA-102,2,4,70,15200000,THB,бронь\n";

/**
 * Paste from Excel (tab-separated) or upload CSV → preview (nothing is written) → apply.
 * Used by developers (own projects) and by the operator (on behalf of a developer).
 */
export function UnitImportPanel({
  projectId,
  action,
  operator = false,
}: {
  projectId: string;
  action: (prev: ImportState, fd: FormData) => Promise<ImportState>;
  operator?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  const canApply = !!state.canApply && state.mode === "preview" && !dirty && !pending;

  return (
    <section className="rounded-lg border border-[var(--bdr)] p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide">
        {operator ? "Внести прайс-лист за застройщика" : "Загрузить прайс-лист / инвентарь"}
      </h2>
      <p className="text-sm text-[var(--muted)]">
        Скопируйте таблицу из Excel и вставьте ниже или загрузите CSV. Обязательные столбцы:{" "}
        <b>Лот</b> и <b>Цена</b>. Необязательные: Спальни, Этаж, Площадь, Валюта, Статус
        (свободен / бронь / продан), ID. Сначала запускается проверка, ничего не записывается, пока
        вы не нажмёте «Применить». Лоты, которых нет в файле, не удаляются.{" "}
        <a
          className="underline"
          download="inventory-template.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
        >
          Скачать шаблон
        </a>
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="project_id" value={projectId} />
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setText(await f.text());
            setDirty(true);
          }}
          className="text-sm"
        />
        <textarea
          name="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          rows={8}
          placeholder={"Лот\tЦена\tСтатус\nA-101\t9 500 000\tсвободен"}
          className="admin-inp mb-0 font-mono text-xs w-full"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="mode"
            value="preview"
            disabled={pending || !text.trim()}
            onClick={() => setDirty(false)}
            className="admin-btn py-2 px-3"
          >
            Проверить
          </button>
          <button
            type="submit"
            name="mode"
            value="apply"
            disabled={!canApply}
            className="admin-btn py-2 px-3"
            title={canApply ? "" : "Сначала нажмите «Проверить» и исправьте ошибки"}
          >
            Применить
          </button>
        </div>
      </form>

      {state.error ? <p className="text-sm text-[var(--red)]">{state.error}</p> : null}

      {state.errors?.length ? (
        <ul className="text-sm text-[var(--red)] list-disc pl-5 space-y-1">
          {state.errors.map((e, i) => (
            <li key={i}>
              {e.line ? `Строка ${e.line}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      ) : null}

      {state.ok && state.mode === "preview" && state.summary ? (
        <div className="space-y-2">
          <p className="text-sm">
            Будет добавлено: <b>{state.summary.inserts}</b> · обновлено:{" "}
            <b>{state.summary.updates}</b> · без изменений: {state.summary.unchanged} · не затронуто
            (нет в файле): {state.summary.untouched}
          </p>
          {state.sample?.length ? (
            <table className="admin-table text-xs">
              <thead>
                <tr>
                  <th>Действие</th>
                  <th>Лот</th>
                  <th>Изменения</th>
                </tr>
              </thead>
              <tbody>
                {state.sample.map((s, i) => (
                  <tr key={i}>
                    <td>{s.kind === "insert" ? "добавить" : "обновить"}</td>
                    <td>{s.label}</td>
                    <td>{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {!state.canApply ? (
            <p className="text-sm text-[var(--muted)]">Изменений нет — применять нечего.</p>
          ) : null}
        </div>
      ) : null}

      {state.ok && state.mode === "apply" && state.applied ? (
        <p className="text-sm text-[var(--grn)]">
          Готово: добавлено {state.applied.inserted}, обновлено {state.applied.updated}.
        </p>
      ) : null}
    </section>
  );
}
