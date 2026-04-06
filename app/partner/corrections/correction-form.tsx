"use client";

import { useActionState } from "react";
import { submitCorrectionRequest } from "@/app/actions/partner";

export function CorrectionForm() {
  const [state, formAction] = useActionState(submitCorrectionRequest, {
    ok: false,
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">UUID проекта (catalog_projects.id)</span>
        <input
          name="project_id"
          required
          className="admin-inp mb-0 font-mono text-xs"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Что исправить</span>
        <textarea
          name="message"
          required
          rows={5}
          className="admin-inp mb-0"
          placeholder="Неверная цена / сроки / описание..."
        />
      </label>
      <button type="submit" className="admin-btn w-fit">
        Отправить
      </button>
      {state?.ok ? (
        <p className="text-[var(--grn)] text-sm">Запрос отправлен в IE.</p>
      ) : null}
      {state?.error ? (
        <p className="text-[var(--red)] text-sm">{state.error}</p>
      ) : null}
    </form>
  );
}
