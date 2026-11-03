"use client";
import { useActionState } from "react";
import { createPartnerProject } from "@/app/actions/project-evidence";
export default function NewProject() {
  const [state, action, pending] = useActionState(createPartnerProject, {
    ok: false,
  });
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl">Новый проект</h1>
      <p>
        Добавьте JSON по схеме каталога. ID при публикации назначит команда.
        Проект остаётся черновиком до модерации.
      </p>
      <form action={action}>
        <label className="block">
          Данные проекта
          <textarea
            className="admin-inp"
            name="draft_json"
            required
            rows={22}
          />
        </label>
        <button className="admin-btn" disabled={pending}>
          Создать черновик
        </button>
        <p role="status">{state.error}</p>
      </form>
    </div>
  );
}
