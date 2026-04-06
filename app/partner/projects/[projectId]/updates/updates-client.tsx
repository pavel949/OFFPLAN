"use client";

import { useActionState } from "react";
import { saveProjectUpdate } from "@/app/actions/partner-marketplace";

const initial = { ok: false as boolean, error: undefined as string | undefined };

type Row = {
  id: string;
  kind: string;
  title_en: string;
  title_ru: string;
  published_at: string;
};

export function UpdatesClient({
  projectId,
  initialList,
}: {
  projectId: string;
  initialList: Row[];
}) {
  const [state, action] = useActionState(saveProjectUpdate, initial);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3 rounded-lg border border-[var(--bdr)] p-4">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block text-xs">
          Тип
          <select name="kind" className="block w-full border rounded mt-1 px-2 py-1">
            <option value="news">news</option>
            <option value="construction">construction</option>
            <option value="milestone">milestone</option>
          </select>
        </label>
        <label className="block text-xs">
          Title EN
          <input name="title_en" className="block w-full border rounded mt-1 px-2 py-1" />
        </label>
        <label className="block text-xs">
          Title RU
          <input name="title_ru" className="block w-full border rounded mt-1 px-2 py-1" />
        </label>
        <label className="block text-xs">
          Body EN
          <textarea name="body_en" rows={3} className="block w-full border rounded mt-1 px-2 py-1" />
        </label>
        <label className="block text-xs">
          Body RU
          <textarea name="body_ru" rows={3} className="block w-full border rounded mt-1 px-2 py-1" />
        </label>
        <button type="submit" className="admin-btn py-2 px-3">
          Опубликовать
        </button>
        {state.ok ? <p className="text-sm text-[var(--grn)]">Опубликовано</p> : null}
        {state.error ? <p className="text-sm text-[var(--red)]">{state.error}</p> : null}
      </form>

      <ul className="text-sm space-y-2">
        {initialList.map((r) => (
          <li key={r.id} className="border-b border-[var(--bdr)] pb-2">
            <span className="text-[var(--muted)]">
              {new Date(r.published_at).toLocaleString("ru-RU")} · {r.kind}
            </span>
            <div className="font-medium">{r.title_en || r.title_ru}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}