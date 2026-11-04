"use client";

import { useActionState } from "react";
import { inviteDeveloper, type InviteState } from "@/app/actions/developers";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteDeveloper, { ok: false });
  return (
    <form action={action} className="space-y-3 max-w-md border border-[var(--bdr)] rounded-lg p-4">
      <h2 className="font-semibold">Пригласить застройщика</h2>
      <label className="block text-sm">
        Название компании (рус.)
        <input className="admin-inp" name="name_ru" required maxLength={200} />
      </label>
      <label className="block text-sm">
        Название (англ., необязательно)
        <input className="admin-inp" name="name_en" maxLength={200} />
      </label>
      <label className="block text-sm">
        E-mail контактного лица
        <input className="admin-inp" name="email" type="email" required />
      </label>
      <label className="block text-sm">
        Имя контактного лица
        <input className="admin-inp" name="full_name" maxLength={200} />
      </label>
      <label className="block text-sm">
        Сайт (https://…, необязательно)
        <input className="admin-inp" name="website" type="url" />
      </label>
      <button className="admin-btn" disabled={pending}>
        {pending ? "Отправка…" : "Создать и отправить приглашение"}
      </button>
      <p role="status" className="text-sm">
        {state.ok ? state.message : state.error}
      </p>
    </form>
  );
}
