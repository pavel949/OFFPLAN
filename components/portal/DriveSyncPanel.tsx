"use client";

import { useActionState, useState, useTransition } from "react";
import type { DriveListState } from "@/app/actions/drive-sync";
import type { ImportState } from "@/lib/inventory/run";

type Api = {
  list: (sourceId: string) => Promise<DriveListState>;
  run: (prev: ImportState, f: FormData) => Promise<ImportState>;
};

/** Reads a shared Google Drive folder, lets the user pick a price list and import it (preview → apply). */
export function DriveSyncPanel({ sourceId, api }: { sourceId: string; api: Api }) {
  const [listing, setListing] = useState<DriveListState | null>(null);
  const [busy, start] = useTransition();
  const [state, action, pending] = useActionState(async (prev: ImportState & { previewFileId?: string }, form: FormData) => {
    const result = await api.run(prev, form);
    return { ...result, previewFileId: String(form.get("file_id") ?? "") };
  }, { ok: false } as ImportState & { previewFileId?: string });
  const [fileId, setFileId] = useState("");

  return (
    <div className="mt-3 border-t border-[var(--bdr,#ddd)] pt-3 space-y-3 text-sm">
      <button
        type="button"
        className="admin-btn"
        disabled={busy}
        onClick={() => start(async () => setListing(await api.list(sourceId)))}
      >
        {busy ? "Читаем папку…" : "Показать файлы из Google Drive"}
      </button>

      {listing && !listing.ok ? (
        <p role="alert" className="text-[var(--red,#b3261e)]">
          {listing.error}
          {listing.serviceAccountEmail ? (
            <>
              {" "}
              Адрес сервисного аккаунта: <b>{listing.serviceAccountEmail}</b>
            </>
          ) : null}
        </p>
      ) : null}

      {listing?.ok ? (
        <form action={action} className="space-y-2">
          <p className="text-[var(--muted,#666)]">
            Найдены файлы, включая подпапки. Содержимое PDF, документов, изображений и видео ещё не извлечено и не загружено на платформу.
            Наличие файла не подтверждает сведения о проекте или право публикации. Импортируются только таблицы после проверки.
          </p>
          {listing.materials?.length ? <button type="button" className="admin-btn" onClick={() => {
            const blob = new Blob([JSON.stringify({ version: 1, sourceId, materials: listing.materials }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "drive-materials-review.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Скачать список материалов для проверки (JSON)</button> : null}
          <input type="hidden" name="source_id" value={sourceId} />
          <input type="hidden" name="file_id" value={fileId} />
          <ul className="space-y-1">
            {listing.files?.length ? null : <li>В папке нет файлов.</li>}
            {listing.files?.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pick"
                  checked={fileId === f.id}
                  disabled={pending || !f.importable}
                  onChange={() => setFileId(f.id)}
                  aria-label={f.name}
                />
                <span className={f.importable ? "" : "text-[var(--muted,#666)]"}>
                  {f.path ?? f.name} · изменён {new Date(f.modifiedTime).toLocaleString("ru-RU")}
                  {f.excel ? " · Excel: сохраните как Google Таблицу или CSV" : !f.importable ? " · содержимое не извлечено" : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="admin-btn" name="mode" value="preview" disabled={pending || !fileId}>
              Проверить
            </button>
            <button
              className="admin-btn"
              name="mode"
              value="apply"
              disabled={pending || !fileId || !(state.ok && state.mode === "preview" && state.canApply && state.previewFileId === fileId)}
            >
              Применить
            </button>
          </div>
          {state.previewFileId === fileId && state.error ? <p role="alert" className="text-[var(--red,#b3261e)]">{state.error}</p> : null}
          {state.previewFileId === fileId && state.ok && state.mode === "preview" && state.summary ? (
            <p>
              Будет добавлено: <b>{state.summary.inserts}</b>, изменено: <b>{state.summary.updates}</b>, без изменений:{" "}
              <b>{state.summary.unchanged}</b>. Лоты, которых нет в файле, не удаляются.
            </p>
          ) : null}
          {state.previewFileId === fileId && state.ok && state.mode === "apply" ? (
            <p>Готово: добавлено {state.applied?.inserted ?? 0}, изменено {state.applied?.updated ?? 0}.</p>
          ) : null}
          {state.previewFileId === fileId && state.sample?.length ? (
            <ul className="list-disc pl-5">
              {state.sample.map((s, i) => (
                <li key={i}>
                  {s.kind === "insert" ? "новый" : "правка"}: {s.label} — {s.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
