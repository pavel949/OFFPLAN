"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreservedForm } from "@/components/forms/use-preserved-form";
import {
  CADENCE_LABEL_RU,
  SOURCE_CADENCE,
  SOURCE_KINDS,
  SOURCE_KIND_LABEL_RU,
  SOURCE_VISIBILITY,
  VISIBILITY_LABEL_RU,
  sourceFreshness,
  sourceHost,
  type ProjectSourceRow,
} from "@/lib/sources";
import type { SourceState } from "@/app/actions/project-sources";
import type { DriveListState } from "@/app/actions/drive-sync";
import { parseDriveUrl } from "@/lib/drive/url";
import type { ImportState } from "@/lib/inventory/run";
import { DriveSyncPanel } from "./DriveSyncPanel";

type Api = {
  add: (prev: SourceState, f: FormData) => Promise<SourceState>;
  remove: (id: string, projectId: string) => Promise<SourceState>;
  confirm: (id: string, projectId: string) => Promise<SourceState>;
};

const FRESH_LABEL = {
  fresh: { text: "актуально", color: "var(--grn, #1a7f4b)" },
  stale: { text: "давно не подтверждалось", color: "var(--red, #b3261e)" },
  unconfirmed: { text: "не подтверждено", color: "var(--amb, #b26a00)" },
} as const;

type DriveApi = {
  list: (sourceId: string) => Promise<DriveListState>;
  run: (prev: ImportState, f: FormData) => Promise<ImportState>;
  /** Present for IE staff only: enable/disable folder sync for a source. */
  setSync?: (sourceId: string, projectId: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
};

export function SourcesManager({
  projectId,
  sources,
  api,
  drive,
}: {
  projectId: string;
  sources: ProjectSourceRow[];
  api: Api;
  drive?: DriveApi;
}) {
  const router = useRouter();
  const { state, onSubmit, formRef, pending } = usePreservedForm(async (previous, data) => {
    const result = await api.add(previous, data);
    if (result.ok) router.refresh();
    return result;
  });
  const [busy, start] = useTransition();
  const busyRef = useRef(false);
  const [operationError, setOperationError] = useState("");
  const run = (operation: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setOperationError("");
    start(async () => {
      try {
        const result = await operation();
        if (result.ok) router.refresh();
        else setOperationError(result.error || "Не удалось выполнить действие.");
      } catch {
        setOperationError("Не удалось получить результат. Обновите список перед повторной попыткой.");
      } finally { busyRef.current = false; }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-[var(--muted,#666)]">
        Укажите ссылки на материалы, которыми вы делитесь с агентами: папка с брошюрой, рендерами и
        документами, мастер-план, прайс-лист, Telegram-канал с актуальной доступностью. Файлы
        копировать не нужно: достаточно ссылки с доступом «по ссылке». Мы показываем дату, когда
        вы последний раз подтверждали актуальность.
      </p>

      {operationError ? <p role="alert">{operationError}</p> : null}
      <ul className="space-y-2">
        {sources.length === 0 ? (
          <li className="text-sm text-[var(--muted,#666)]">Пока нет ни одной ссылки.</li>
        ) : null}
        {sources.map((s) => {
          const f = sourceFreshness(s.cadence, s.confirmed_at);
          return (
            <li
              key={s.id}
              className="border border-[var(--bdr,#ddd)] rounded-lg p-3 text-sm flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold">
                  {SOURCE_KIND_LABEL_RU[s.kind]} · {s.title}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline break-all"
                >
                  {sourceHost(s.url) || s.url}
                </a>
                <div className="text-xs text-[var(--muted,#666)] mt-1">
                  {VISIBILITY_LABEL_RU[s.visibility]} · обновление: {CADENCE_LABEL_RU[s.cadence]} ·{" "}
                  <span style={{ color: FRESH_LABEL[f].color }}>
                    {FRESH_LABEL[f].text}
                    {s.confirmed_at
                      ? ` (${new Date(s.confirmed_at).toLocaleDateString("ru-RU")})`
                      : ""}
                  </span>
                </div>
                {s.note ? <div className="text-xs mt-1">{s.note}</div> : null}
                {drive && parseDriveUrl(s.url) ? (
                  <div className="text-xs mt-2">
                    {s.sync_enabled ? (
                      <>
                        <b>Синхронизация с Google Drive включена</b>
                        {s.last_synced_at
                          ? ` · последний импорт ${new Date(s.last_synced_at).toLocaleString("ru-RU")} (${s.last_sync_note})`
                          : ""}
                        <DriveSyncPanel sourceId={s.id} api={{ list: drive.list, run: drive.run }} />
                      </>
                    ) : (
                      <span className="text-[var(--muted,#666)]">
                        Чтобы подтягивать прайс из этой папки, откройте доступ «Читатель» для сервисного
                        аккаунта IE и напишите нам: команда включит синхронизацию.
                      </span>
                    )}
                    {drive.setSync ? (
                      <div className="mt-1">
                        <button
                          className="admin-btn"
                          disabled={busy}
                          onClick={() =>
                            run(() => drive.setSync!(s.id, projectId, !s.sync_enabled))
                          }
                        >
                          {s.sync_enabled ? "Выключить синхронизацию" : "Включить синхронизацию"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  className="admin-btn"
                  disabled={busy}
                  onClick={() => run(() => api.confirm(s.id, projectId))}
                >
                  Подтвердить актуальность
                </button>
                <button
                  className="admin-btn"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Удалить ссылку?"))
                      run(() => api.remove(s.id, projectId));
                  }}
                >
                  Удалить
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-3 border border-[var(--bdr,#ddd)] rounded-lg p-4">
        <fieldset disabled={pending} className="space-y-3" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <h2 className="font-semibold">Добавить ссылку</h2>
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block text-sm">
          Что это
          <select className="admin-inp" name="kind" defaultValue="data_room">
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SOURCE_KIND_LABEL_RU[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Название
          <input className="admin-inp" name="title" required maxLength={200} placeholder="Например: Материалы для агентов, Q4 2026" />
        </label>
        <label className="block text-sm">
          Ссылка (https://…)
          <input className="admin-inp" name="url" type="url" required placeholder="https://drive.google.com/…" />
        </label>
        <label className="block text-sm">
          Кто видит ссылку
          <select className="admin-inp" name="visibility" defaultValue="partners">
            {SOURCE_VISIBILITY.map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABEL_RU[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Как часто обновляется
          <select className="admin-inp" name="cadence" defaultValue="on_change">
            {SOURCE_CADENCE.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL_RU[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Заметка (необязательно)
          <input className="admin-inp" name="note" maxLength={1000} placeholder="Например: прайс обновляется по пятницам" />
        </label>
        <p className="text-xs text-[var(--muted,#666)]">
          Не публикуйте ссылки с личными данными. Для «Видна всем» убедитесь, что материалы вы
          разрешаете показывать покупателям.
        </p>
        <button className="admin-btn" disabled={pending}>
          {pending ? "Сохранение…" : "Добавить"}
        </button>
        <p role="status" className="text-sm">
          {state.ok ? "Сохранено" : state.error}
        </p>
      </fieldset>
      </form>
    </div>
  );
}

