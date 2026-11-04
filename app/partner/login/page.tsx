"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PartnerLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Вход временно недоступен. Напишите нам, мы поможем.");
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/partner`, shouldCreateUser: false },
      });
      if (error) {
        if (/signups? not allowed|not found/i.test(error.message)) throw new Error("Этот адрес не приглашён в кабинет. Используйте почту из приглашения или напишите нам.");
        if (/rate|seconds/i.test(error.message)) throw new Error("Слишком много попыток. Подождите минуту и попробуйте снова.");
        throw new Error("Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз.");
      }
      setSent(email.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-center">
      <div className="pt-card">
        <div className="pt-logo">IE</div>
        <h1>Кабинет застройщика</h1>
        <p>Здесь вы ведёте свои проекты: цены и наличие лотов, фото со стройки, новости и акции.</p>
        {sent ? (
          <>
            <div className="pt-ok" style={{ marginTop: 20 }}>Мы отправили ссылку для входа на {sent}. Откройте письмо и нажмите на ссылку. Если письма нет, проверьте папку «Спам».</div>
            <p style={{ marginTop: 14 }}><button className="adm-btn adm-btn--line adm-btn--sm" onClick={() => setSent(null)}>Указать другой адрес</button></p>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Рабочая почта из приглашения" aria-label="Электронная почта" />
            <button type="submit" className="adm-btn" disabled={busy}>{busy ? "Отправляем…" : "Получить ссылку для входа"}</button>
            {err ? <div className="pt-err" role="alert">{err}</div> : null}
          </form>
        )}
        <ol className="pt-steps">
          <li><b>1</b><span>Пароль не нужен: мы присылаем одноразовую ссылку на вашу почту.</span></li>
          <li><b>2</b><span>Доступ даётся по приглашению. Нет приглашения? <Link href="/protection/contact" style={{ textDecoration: "underline" }}>Напишите нам</Link>.</span></li>
        </ol>
      </div>
    </div>
  );
}
