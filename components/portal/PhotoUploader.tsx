"use client";

import { useRef, useState } from "react";
import { LocalPhotoPreview } from "@/components/shared/LocalPhotoPreview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { preflightUploadedPhotos, submitUploadedPhotos } from "@/app/actions/project-evidence";

import { MediaFields, mediaDetails, emptyMediaMetadata, type MediaMetadata } from "./MediaFields";
import { photoUploadFailure } from "@/lib/photo-upload";
type Item = { file: File; caption: string; metadata: MediaMetadata };
const MAX = 8 * 1024 * 1024;

/** Developers pick image files, add captions; files go straight to Storage, then are queued for review. */
export function PhotoUploader({ projectId, units = [] }: { projectId: string; units?: {id:string;label:string}[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const active = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(files: FileList | null) {
    if (!files) return;
    const next: Item[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > MAX) skipped++;
      else next.push({ file: f, caption: "", metadata: {...emptyMediaMetadata,sort_order:items.length+next.length} });
    }
    setItems((cur) => [...cur, ...next].slice(0, 40));
    setMsg(skipped ? { ok: false, text: `Пропущено файлов: ${skipped} (нужен JPG/PNG/WebP до 8 МБ)` } : null);
  }

  async function send() {
    if (active.current || blocked) return;
    active.current = true;
    setBusy(true);
    setMsg(null);
    let uploaded = 0;
    let writing = false;
    let phase: "upload" | "register" = "upload";
    try {
      const sb = createSupabaseBrowserClient();
      if (!sb) throw new Error("Нет подключения к базе");
      const batch = items.map(it => ({path:`${projectId}/${crypto.randomUUID()}.${it.file.type === "image/png" ? "png" : it.file.type === "image/webp" ? "webp" : "jpg"}`,caption:it.caption,details:mediaDetails(it.metadata)}));
      const checked = await preflightUploadedPhotos({projectId,observedAt:date,items:batch});
      if (!checked.ok) throw new Error(checked.error ?? "Проверьте материалы");
      // Preserve paths even if a network response is lost. Never replay this batch blindly.
      setUploadedPaths(batch.map(x=>x.path));
      for (let i=0;i<items.length;i++) {
        writing = true;
        const {error} = await sb.storage.from("project-photos").upload(batch[i].path,items[i].file,{contentType:items[i].file.type,cacheControl:"31536000"});
        if (error) throw new Error(error.message);
        uploaded++;
      }
      phase = "register";
      const r = await submitUploadedPhotos({projectId,observedAt:date,items:batch});
      if (!r.ok) throw new Error(r.error ?? "Ошибка регистрации");
      setItems([]);
      setUploadedPaths([]);
      setMsg({ok:true,text:`Отправлено на проверку: ${r.saved}. После одобрения материалы появятся на странице проекта.`});
    } catch(e) {
      const reason = e instanceof Error ? e.message : "Соединение прервано";
      if (writing) setBlocked(true);
      setMsg({ok:false,text:writing ? photoUploadFailure(uploaded,items.length,phase,reason) : reason});
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--bdr)] p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide">Загрузить фотографии</h2>
      <p className="text-sm text-[var(--muted)]">
        Хранилище фотографий публично по ссылке сразу после загрузки; документы для проверки здесь размещать нельзя. Выберите файлы (JPG, PNG, WebP до 8 МБ, до 40 за раз). Укажите дату материала и его тип: фото, визуализация или план. Загружайте только материалы, которые вы вправе публиковать.
        Обложку и порядок можно выбрать ниже; изменения публикуются после проверки.
      </p>
      <input type="file" multiple disabled={busy || blocked} accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files)} className="text-sm" />
      <label className="block text-xs">
        Дата материала
        <input type="date" disabled={busy || blocked} value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="admin-inp" />
      </label>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="space-y-3 border border-[var(--bdr)] rounded-lg p-3"><div className="flex gap-3 items-center flex-wrap">
              <LocalPhotoPreview file={it.file} className="w-16 h-12 object-cover rounded" />
              <input
                className="admin-inp mb-0 flex-1"
                disabled={busy || blocked}
                placeholder="Подпись: например, «Фасад, блок A»"
                value={it.caption}
                onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <button type="button" disabled={busy || blocked} className="text-sm underline" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}>
                убрать
              </button></div>
              <MediaFields value={it.metadata} onChange={metadata=>setItems(cur=>cur.map((x,j)=>j===i?{...x,metadata}:x))} disabled={busy || blocked} units={units}/>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="admin-btn py-2 px-3" disabled={busy || blocked || !items.length} onClick={send}>
        {busy ? "Загрузка…" : `Отправить на проверку${items.length ? ` (${items.length})` : ""}`}
      </button>
      {blocked && uploadedPaths.length ? <details><summary>Пути файлов для проверки</summary><ul>{uploadedPaths.map(path=><li key={path}>{path}</li>)}</ul></details> : null}
      {msg ? <p role="status" className={msg.ok ? "text-sm text-[var(--grn)]" : "text-sm text-[var(--red)]"}>{msg.text}</p> : null}
    </section>
  );
}

