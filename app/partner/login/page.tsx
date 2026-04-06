"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PartnerLoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setErr("Настройте NEXT_PUBLIC_SUPABASE_URL и ANON KEY");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/partner` },
      });
      if (error) throw error;
      setMsg("Проверьте почту — ссылка для входа отправлена.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="serif text-2xl mb-2">Вход застройщика</h1>
      <p className="text-[var(--muted)] text-sm mb-4">
        Magic link на email (Supabase Auth).
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          className="admin-inp mb-0"
        />
        <button type="submit" className="admin-btn w-fit">
          Получить ссылку
        </button>
      </form>
      {msg ? <p className="text-[var(--grn)] text-sm mt-3">{msg}</p> : null}
      {err ? <p className="text-[var(--red)] text-sm mt-3">{err}</p> : null}
    </div>
  );
}
