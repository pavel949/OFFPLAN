"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/actions/admin-auth";

export function AdminLogin() {
  const [state, formAction] = useActionState(loginAdmin, { ok: false });

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <h1>Ignatev Estate</h1>
        <p>Вход в панель управления лидами и каталогом.</p>
        <form action={formAction}>
          <label className="block text-xs font-semibold text-[var(--txt2)] mb-1">
            Пароль (ADMIN_SECRET)
          </label>
          <input
            className="admin-inp"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
          {state?.error ? <p className="admin-err">{state.error}</p> : null}
          <button type="submit" className="admin-btn">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
