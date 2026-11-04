"use client";

import { useActionState, useState } from "react";
import { loginAdmin } from "@/app/actions/admin-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TeamLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, { ok: false });
  return (
    <form action={action} className="login-form">
      <label htmlFor="team-pw">
        Пароль команды
      </label>
      <input
        id="team-pw"
        className="admin-inp mb-0"
        type="password"
        name="password"
        autoComplete="current-password"
        required
      />
      <button className="admin-btn" disabled={pending}>
        {pending ? "Вход…" : "Войти в панель"}
      </button>
      {state?.error ? (
        <p role="alert" className="login-err">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function EmailLoginForm({
  target,
  label,
  invitedOnly = false,
}: {
  target: "/partner" | "/account";
  label: string;
  /** Developers/brokers are created by IE: unknown addresses must not create accounts. */
  invitedOnly?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setErr("Вход по почте временно недоступен.");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${target}`,
          shouldCreateUser: !invitedOnly,
        },
      });
      if (error) throw error;
      setMsg("Проверьте почту: мы отправили ссылку для входа.");
    } catch (x) {
      const m = x instanceof Error ? x.message : String(x);
      setErr(
        invitedOnly && /signups? not allowed|not allowed for otp/i.test(m)
          ? "Этот адрес пока не приглашён. Напишите команде IE, и мы откроем доступ."
          : m,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label htmlFor={`em-${target}`}>
        E-mail
      </label>
      <input
        id={`em-${target}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@company.com"
        className="admin-inp mb-0"
        autoComplete="email"
      />
      <button type="submit" className="admin-btn" disabled={busy}>
        {busy ? "Отправка…" : label}
      </button>
      {msg ? <p className="login-ok">{msg}</p> : null}
      {err ? <p role="alert" className="login-err">{err}</p> : null}
    </form>
  );
}
