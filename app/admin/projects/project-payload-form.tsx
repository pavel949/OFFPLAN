"use client";

import { useActionState } from "react";
import { adminSaveProjectPayload } from "@/app/actions/admin-brain";

export function ProjectPayloadForm({
  projectId,
  initialJson,
}: {
  projectId: string;
  initialJson: string;
}) {
  const [state, action] = useActionState(
    async (_: { ok: boolean; error?: string }, fd: FormData) => {
      const json = String(fd.get("payload_json") ?? "");
      return adminSaveProjectPayload(projectId, json);
    },
    { ok: false },
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Payload (публичная карточка после публикации)</label>
      <textarea
        name="payload_json"
        className="admin-inp mb-0 font-mono text-xs min-h-[420px]"
        defaultValue={initialJson}
        spellCheck={false}
        required
      />
      <button type="submit" className="admin-btn w-fit">
        Сохранить карточку
      </button>
      {state?.ok ? (
        <p className="text-sm text-[var(--grn)]">Сохранено. Каталог обновится после revalidate.</p>
      ) : null}
      {state?.error ? (
        <p className="text-sm text-[var(--red)]">{state.error}</p>
      ) : null}
    </form>
  );
}
