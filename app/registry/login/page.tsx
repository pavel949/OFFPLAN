"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RegistryLoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setErr("Supabase не настроен");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/registry/review`, shouldCreateUser: false },
    });
    if (error) setErr(error.message);
    else setMsg("Проверьте почту — ссылка для входа отправлена.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "48px 16px" }}>
      <h1 className="serif text-2xl mb-2">Вход эксперта реестра</h1>
      <p className="text-sm mb-4" style={{ opacity: 0.75 }}>
        Доступ только для экспертов реестра. Ссылка для входа придёт на email.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="admin-inp mb-0" />
        <button type="submit" className="admin-btn w-fit">Получить ссылку</button>
      </form>
      {msg ? <p className="text-sm mt-3" style={{ color: "var(--grn)" }}>{msg}</p> : null}
      {err ? <p className="text-sm mt-3" style={{ color: "var(--red)" }}>{err}</p> : null}
    </main>
  );
}
