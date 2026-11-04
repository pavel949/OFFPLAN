"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cvCreateDraft } from "@/app/actions/cv-methodology";

export function NewDraftButton() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="adm-btn" disabled={busy} onClick={() => start(async () => {
        const r = await cvCreateDraft();
        if (r.ok && r.id) router.push(`/admin/methodology/${r.id}`);
        else setErr(r.error ?? "Ошибка");
      })}>{busy ? "Создаю…" : "+ Новый черновик"}</button>
      {err ? <span className="adm-msg err" style={{ marginLeft: 10 }}>{err}</span> : null}
    </>
  );
}
