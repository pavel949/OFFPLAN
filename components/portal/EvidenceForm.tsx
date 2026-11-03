"use client";
import { useActionState, useState } from "react";
import { submitProjectEvidence } from "@/app/actions/project-evidence";
const examples: Record<string, string> = {
  photo:
    '{"url":"https://your-domain.example/photo.jpg","caption":"Фасад, дата съёмки","render":false}',
  amenity: '{"description":"Бассейн 25 м, заявлено в спецификации"}',
  operating_cost:
    '{"amount":80,"currency":"THB","basis":"sqm","period":"month"}',
  sales: '{"stage":"launch","starts_at":"2026-11-03","total_units":100}',
};
export function EvidenceForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(submitProjectEvidence, {
    ok: false,
  });
  const [kind, setKind] = useState("photo");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="block">
        Тип
        <select
          className="admin-inp"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="photo">Фотография / строительный прогресс</option>
          <option value="amenity">Инфраструктура и преимущество</option>
          <option value="operating_cost">Расходы эксплуатации</option>
          <option value="sales">Стадия продаж</option>
        </select>
      </label>
      <label className="block">
        Код сведения (например, cam или pool)
        <input className="admin-inp" name="fact_key" required maxLength={100} />
      </label>
      <label className="block">
        Название
        <input className="admin-inp" name="title" required maxLength={300} />
      </label>
      <label className="block">
        Ссылка на источник
        <input
          className="admin-inp"
          name="source_url"
          type="url"
          required
          placeholder="https://"
        />
      </label>
      <label className="block">
        Дата сведений
        <input
          className="admin-inp"
          name="observed_at"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
        />
      </label>
      <label className="block">
        Данные JSON
        <textarea
          key={kind}
          className="admin-inp"
          name="details"
          rows={5}
          required
          placeholder={examples[kind]}
        />
      </label>
      <p className="text-sm text-[var(--muted)]">
        Пример в подсказке — только формат. Укажите фактические сведения из
        источника. Публикация произойдёт после проверки командой.
      </p>
      <button className="admin-btn" disabled={pending}>
        {pending ? "Отправка…" : "Отправить на проверку"}
      </button>
      <p role="status">{state.ok ? "Отправлено на проверку" : state.error}</p>
    </form>
  );
}
