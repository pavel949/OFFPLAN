"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Reviewer decision on a methodology version. The database publishes it only when two distinct reviewers approve. */
export function ReviewActions({ id, approvals, mine }: { id: string; approvals: number; mine: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  function decide(decision: "approve" | "return") {
    start(async () => {
      const sb = createSupabaseBrowserClient();
      if (!sb) return setMsg({ ok: false, text: "Нет подключения" });
      const { data, error } = await sb.rpc("cv_review_version", { p_id: id, p_decision: decision, p_note: note });
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: data === "published" ? "Версия опубликована: оба аналитика утвердили" : data === "returned" ? "Возвращено владельцу на доработку" : "Ваше утверждение записано, ждём второго аналитика" });
      router.refresh();
    });
  }

  return (
    <section className="adm-card" style={{ margin: 0 }}>
      <h3>Ваше решение</h3>
      <p className="adm-hint" style={{ margin: "6px 0 10px" }}>Утверждений: <b>{approvals} из 2</b>{mine ? ` · ваше решение: ${mine === "approve" ? "утверждено" : "возврат"}` : ""}. Публикует версию второе независимое утверждение. Содержимое неизменяемо после публикации.</p>
      <div className="adm-field"><label>Комментарий (обязателен при возврате)</label><textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 70 }} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="adm-btn" disabled={busy} onClick={() => decide("approve")}>Утвердить</button>
        <button type="button" className="adm-btn adm-btn--danger" disabled={busy || note.trim().length < 10} onClick={() => decide("return")}>Вернуть на доработку</button>
      </div>
      {msg ? <p className={`adm-msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 8 }}>{msg.text}</p> : null}
    </section>
  );
}
