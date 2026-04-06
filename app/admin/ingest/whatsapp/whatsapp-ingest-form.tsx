"use client";

import { useActionState, useMemo, useState } from "react";
import { adminSaveWhatsAppIngest } from "@/app/actions/admin-brain";
import { parseWhatsAppText } from "@/lib/whatsapp-parse";

export function WhatsAppIngestForm() {
  const [text, setText] = useState("");
  const preview = useMemo(() => parseWhatsAppText(text), [text]);
  const [state, action] = useActionState(adminSaveWhatsAppIngest, { ok: false });

  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Метка источника</span>
        <input
          name="source_label"
          className="admin-inp mb-0 max-w-xs"
          placeholder="Группа Phuket / застройщик X"
          defaultValue="paste"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Текст чата</span>
        <textarea
          name="raw_text"
          required
          rows={14}
          className="admin-inp mb-0 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставьте экспорт или копипаст сообщений…"
        />
      </label>

      <div className="text-xs text-[var(--txt2)] border border-[var(--bdr)] rounded-lg p-3 bg-[var(--sur)]">
        <strong>Предпросмотр разбора:</strong> строк {preview.stats.lineCount}, сообщений ~{" "}
        {preview.stats.messageCount}, ссылок {preview.urls.length}, телефонов{" "}
        {preview.phones.length}
        {preview.urls.length > 0 ? (
          <div className="mt-2 break-all">URLs: {preview.urls.slice(0, 8).join(" · ")}</div>
        ) : null}
      </div>

      <button type="submit" className="admin-btn w-fit">
        Сохранить импорт
      </button>
      {state?.ok ? (
        <p className="text-sm text-[var(--grn)]">Сохранено. id: {state.id ?? "—"}</p>
      ) : null}
      {state?.error ? <p className="text-sm text-[var(--red)]">{state.error}</p> : null}
    </form>
  );
}
