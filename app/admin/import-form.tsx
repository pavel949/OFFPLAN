"use client";

import { useActionState } from "react";

export function AdminImportForm({
  action,
}: {
  action: typeof import("@/app/actions/admin").importProjectsJson;
}) {
  const [state, formAction] = useActionState(action, { ok: false });

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--txt2)]">JSON проектов</span>
        <textarea
          name="payload"
          rows={14}
          defaultValue="[]"
          className="admin-inp mb-0 font-mono text-xs min-h-[280px]"
        />
      </label>
      <button type="submit" className="admin-btn w-fit">
        Импорт и валидация
      </button>
      {state?.ok === true ? (
        <p className="text-[var(--grn)] text-sm">
          Импортировано проектов: {state.imported ?? 0}.
        </p>
      ) : null}
      {state?.ok === false && state?.error ? (
        <p className="admin-err mb-0">{state.error}</p>
      ) : null}
    </form>
  );
}
