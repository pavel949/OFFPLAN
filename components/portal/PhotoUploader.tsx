"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { submitUploadedPhotos } from "@/app/actions/project-evidence";

type Item = { file: File; caption: string };
const MAX = 8 * 1024 * 1024;

/** Developers pick image files, add captions; files go straight to Storage, then are queued for review. */
export function PhotoUploader({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(files: FileList | null) {
    if (!files) return;
    const next: Item[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > MAX) skipped++;
      else next.push({ file: f, caption: "" });
    }
    setItems((cur) => [...cur, ...next].slice(0, 40));
    setMsg(skipped ? { ok: false, text: `Пропущено файлов: ${skipped} (нужен JPG/PNG/WebP до 8 МБ)` } : null);
  }

  async function send() {
    const sb = createSupabaseBrowserClient();
    if (!sb) return setMsg({ ok: false, text: "Нет подключения к базе" });
    setBusy(true);
    setMsg(null);
    const done: { path: string; caption: string }[] = [];
    for (const it of items) {
      const ext = it.file.type === "image/png" ? "png" : it.file.type === "image/webp" ? "webp" : "jpg";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("project-photos").upload(path, it.file, {
        contentType: it.file.type,
        cacheControl: "31536000",
      });
      if (error) {
        setBusy(false);
        return setMsg({ ok: false, text: `Не удалось загрузить «${it.file.name}»: ${error.message}` });
      }
      done.push({ path, caption: it.caption });
    }
    const r = await submitUploadedPhotos({ projectId, observedAt: date, items: done });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Ошибка" });
    setItems([]);
    setMsg({ ok: true, text: `Отправлено на проверку: ${r.saved}. После одобрения фото появятся на странице проекта.` });
  }

  return (
    <section className="rounded-lg border border-[var(--bdr)] p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide">Загрузить фотографии</h2>
      <p className="text-sm text-[var(--muted)]">
        Выберите файлы (JPG, PNG, WebP до 8 МБ, до 40 за раз). Укажите дату съёмки: фотоотчёт показывается с датой.
        Первое одобренное фото станет обложкой проекта.
      </p>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files)} className="text-sm" />
      <label className="block text-xs">
        Дата съёмки
        <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="admin-inp" />
      </label>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(it.file)} alt="" className="w-16 h-12 object-cover rounded" />
              <input
                className="admin-inp mb-0 flex-1"
                placeholder="Подпись: например, «Фасад, блок A»"
                value={it.caption}
                onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <button type="button" className="text-sm underline" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}>
                убрать
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="admin-btn py-2 px-3" disabled={busy || !items.length} onClick={send}>
        {busy ? "Загрузка…" : `Отправить на проверку${items.length ? ` (${items.length})` : ""}`}
      </button>
      {msg ? <p role="status" className={msg.ok ? "text-sm text-[var(--grn)]" : "text-sm text-[var(--red)]"}>{msg.text}</p> : null}
    </section>
  );
}
