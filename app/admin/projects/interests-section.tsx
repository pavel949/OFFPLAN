"use client";

import { useActionState } from "react";
import { adminAddInterest, adminRemoveInterest, type InterestRow } from "@/app/actions/admin-brain";

const KIND_RU: Record<string, string> = {
  broker_agreement: "Агентский договор",
  deal: "Сделка",
  other: "Иное",
};

export function InterestsSection({
  projectId,
  interests,
  brokers,
}: {
  projectId: string;
  interests: InterestRow[];
  brokers: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(adminAddInterest, { ok: false } as { ok: boolean; error?: string });
  return (
    <section className="mt-8 rounded-lg border border-[var(--bdr)] p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1">Коммерческие интересы (реестр верификации)</h2>
      <p className="text-sm text-[var(--txt2)] mb-3">
        Эксперты реестра из указанных организаций автоматически отводятся от проверки этого проекта.
        Лиды, направленные брокеру, учитываются автоматически.
      </p>
      <ul className="text-sm mb-3 space-y-1">
        {interests.length === 0 ? <li className="text-[var(--txt2)]">Не заявлено.</li> : null}
        {interests.map((i) => (
          <li key={`${i.org_id}${i.kind}`}>
            {i.org_name} — {KIND_RU[i.kind] ?? i.kind}
            {i.note ? ` (${i.note})` : ""}{" "}
            <button type="button" className="underline text-xs" onClick={() => void adminRemoveInterest(projectId, i.org_id, i.kind).then(() => location.reload())}>
              удалить
            </button>
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-wrap gap-2 items-end">
        <input type="hidden" name="project_id" value={projectId} />
        <select name="org_id" required className="border rounded text-sm">
          <option value="">Брокер…</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="kind" className="border rounded text-sm">
          {Object.entries(KIND_RU).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
        <input name="note" placeholder="Примечание" className="admin-inp mb-0" />
        <button className="admin-btn py-1 px-3 text-sm">Добавить</button>
      </form>
      {state.error ? <p className="text-sm text-[var(--red)] mt-1">{state.error}</p> : null}
    </section>
  );
}
