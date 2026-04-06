"use client";

import { useActionState } from "react";
import { updateLeadFromForm } from "@/app/actions/leads";
import type { LeadStatus } from "@/lib/leads/types";

export function LeadEditForm({
  leadId,
  initialStatus,
  initialNotes,
  statusLabels,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  initialNotes: string;
  statusLabels: Record<LeadStatus, string>;
}) {
  const [state, formAction] = useActionState(updateLeadFromForm, { ok: false });

  return (
    <form action={formAction} className="max-w-xl lead-form">
      <input type="hidden" name="id" value={leadId} />
      <label className="block mb-3">
        <span className="block text-xs font-semibold text-[var(--txt2)] mb-1">
          Статус
        </span>
        <select
          name="status"
          defaultValue={initialStatus}
          className="admin-inp mb-0"
        >
          {(Object.keys(statusLabels) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block mb-3">
        <span className="block text-xs font-semibold text-[var(--txt2)] mb-1">
          Внутренние заметки (CRM)
        </span>
        <textarea
          name="notes"
          defaultValue={initialNotes}
          placeholder="Звонок, договорённости, следующий шаг…"
        />
      </label>
      <button type="submit" className="admin-btn">
        Сохранить
      </button>
      {state?.ok ? (
        <p className="text-[var(--grn)] text-sm mt-3 mb-0">Сохранено.</p>
      ) : null}
      {state?.error ? (
        <p className="admin-err mt-3 mb-0">{state.error}</p>
      ) : null}
    </form>
  );
}
