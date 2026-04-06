"use client";

import { useActionState, useTransition } from "react";
import {
  adminDeleteProjectDocument,
  adminGetDocumentSignedUrl,
  adminUploadProjectDocument,
} from "@/app/actions/admin-brain";
import type { ProjectDocRow } from "@/app/actions/admin-brain";

export function ProjectDocsSection({
  projectId,
  initialDocs,
}: {
  projectId: string;
  initialDocs: ProjectDocRow[];
}) {
  const [upState, upAction] = useActionState(adminUploadProjectDocument, {
    ok: false,
  });
  const [pending, start] = useTransition();

  return (
    <div className="mt-8 space-y-4">
      <h2 className="serif text-lg">Документы проекта</h2>
      <p className="text-[var(--txt2)] text-sm max-w-xl">
        PDF, таблицы, маркетинг — в приватное хранилище Supabase Storage
        (bucket <code className="text-xs">project-docs</code>). Скачивание по
        временной ссылке.
      </p>

      <form action={upAction} className="flex flex-col gap-2 max-w-md border border-[var(--bdr)] rounded-lg p-3">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="text-sm font-semibold">Тип</label>
        <select name="kind" className="admin-inp mb-0">
          <option value="memo">Заметки / memo</option>
          <option value="marketing">Маркетинг</option>
          <option value="legal">Юр. документы</option>
          <option value="plan">Планировки / планы</option>
          <option value="other">Другое</option>
        </select>
        <label className="text-sm font-semibold">Название</label>
        <input name="title" className="admin-inp mb-0" placeholder="Файл договора / презентация" />
        <label className="text-sm font-semibold">Файл</label>
        <input name="file" type="file" className="text-sm" required />
        <label className="text-sm font-semibold">Комментарий (внутренний)</label>
        <input name="notes" className="admin-inp mb-0" placeholder="Опционально" />
        <button type="submit" className="admin-btn w-fit">
          Загрузить
        </button>
        {upState?.ok ? <p className="text-sm text-[var(--grn)]">Файл добавлен.</p> : null}
        {upState?.error ? <p className="text-sm text-[var(--red)]">{upState.error}</p> : null}
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Название</th>
              <th>Размер</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initialDocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-[var(--txt2)] text-sm">
                  Пока нет файлов.
                </td>
              </tr>
            ) : (
              initialDocs.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap text-xs">
                    {new Date(d.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td>{d.kind}</td>
                  <td>{d.title}</td>
                  <td className="tabular-nums">{Math.round(d.file_size / 1024)} KB</td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="text-[var(--ink)] font-semibold text-sm underline"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          const r = await adminGetDocumentSignedUrl(d.storage_path);
                          if (r.url) window.open(r.url, "_blank", "noopener");
                          else alert(r.error ?? "Ошибка ссылки");
                        });
                      }}
                    >
                      Скачать
                    </button>
                    <button
                      type="button"
                      className="text-[var(--red)] text-sm underline"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Удалить файл?")) return;
                        start(async () => {
                          const r = await adminDeleteProjectDocument(d.id, projectId);
                          if (!r.ok) alert(r.error);
                          else window.location.reload();
                        });
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
