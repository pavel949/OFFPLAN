"use client";

import { useActionState } from "react";
import {
  saveProjectDraft,
  submitProjectForModeration,
} from "@/app/actions/moderation";

export function ProjectDraftForm({
  projectId,
  initialJson,
  readOnly = false,
}: {
  projectId: string;
  initialJson: string;
  readOnly?: boolean;
}) {
  const [saveState, saveAction] = useActionState(saveProjectDraft, {
    ok: false,
  });
  const [submitState, submitAction] = useActionState(
    submitProjectForModeration,
    { ok: false },
  );

  return (
    <div className="space-y-8">
      <form action={saveAction} className="flex flex-col gap-3">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Черновик (JSON каталога)</span>
          <textarea
            name="draft_json"
            required
            rows={22}
            className="admin-inp mb-0 font-mono text-xs leading-relaxed"
            defaultValue={initialJson}
            spellCheck={false}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </label>
        <button type="submit" className="admin-btn w-fit" disabled={readOnly}>
          Сохранить черновик
        </button>
        {saveState?.ok ? (
          <p className="text-[var(--grn)] text-sm">Сохранено.</p>
        ) : null}
        {saveState?.error ? (
          <p className="text-[var(--red)] text-sm">{saveState.error}</p>
        ) : null}
      </form>

      <form action={submitAction} className="flex flex-col gap-2 border-t border-[var(--bdr)] pt-6">
        <input type="hidden" name="project_id" value={projectId} />
        <p className="text-sm text-[var(--muted)]">
          После отправки заявка попадёт в очередь IE. Для уже опубликованных
          проектов на сайте останется прежняя версия до одобрения.
        </p>
        <button
          type="submit"
          className="admin-btn w-fit bg-[var(--gold)] text-[var(--ink)]"
          disabled={readOnly}
        >
          Отправить на модерацию
        </button>
        {submitState?.ok ? (
          <p className="text-[var(--grn)] text-sm">Отправлено в очередь модерации.</p>
        ) : null}
        {submitState?.error ? (
          <p className="text-[var(--red)] text-sm">{submitState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
