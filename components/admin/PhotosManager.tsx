"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  adminStudioPhotoDecision, adminStudioRegisterPhotos, adminStudioSignUploads, type PhotoRow,
} from "@/app/actions/admin-studio";

type Pick = { file: File; caption: string };
const MAX = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const STATUS_RU: Record<string, string> = { published: "на сайте", pending: "на проверке", rejected: "отклонено" };

export function PhotosManager({ projectId, photos }: { projectId: string; photos: PhotoRow[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();

  function pick(files: FileList | null) {
    if (!files) return;
    const ok: Pick[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (EXT[f.type] && f.size <= MAX) ok.push({ file: f, caption: "" });
      else skipped++;
    }
    setPicks((p) => [...p, ...ok].slice(0, 40));
    setMsg(skipped ? { ok: false, text: `Пропущено: ${skipped} (нужен JPG/PNG/WebP до 8 МБ)` } : null);
  }

  async function upload() {
    const sb = createSupabaseBrowserClient();
    if (!sb) return setMsg({ ok: false, text: "Нет подключения к хранилищу" });
    setBusy(true);
    setMsg(null);
    const slots = await adminStudioSignUploads(projectId, picks.length, picks.map((p) => EXT[p.file.type]));
    if (!slots.ok || !slots.slots) { setBusy(false); return setMsg({ ok: false, text: slots.error ?? "Ошибка" }); }
    const done: { path: string; caption: string }[] = [];
    for (let i = 0; i < picks.length; i++) {
      const s = slots.slots[i];
      const { error } = await sb.storage.from("project-photos").uploadToSignedUrl(s.path, s.token, picks[i].file, { contentType: picks[i].file.type });
      if (error) { setBusy(false); return setMsg({ ok: false, text: `«${picks[i].file.name}»: ${error.message}` }); }
      done.push({ path: s.path, caption: picks[i].caption });
    }
    const r = await adminStudioRegisterPhotos(projectId, done, date);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Ошибка" });
    setPicks([]);
    setMsg({ ok: true, text: `Опубликовано фото: ${r.saved}` });
    router.refresh();
  }

  function decide(id: string, action: "approve" | "reject" | "remove") {
    if (action === "remove" && !confirm("Убрать фото с сайта?")) return;
    start(async () => {
      const r = await adminStudioPhotoDecision(projectId, id, action);
      setMsg(r.ok ? { ok: true, text: "Готово" } : { ok: false, text: r.error ?? "Ошибка" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <section className="adm-card">
        <h3>Загрузить фотографии</h3>
        <p className="adm-lead">Выберите файлы (JPG, PNG, WebP до 8 МБ, до 40 за раз), добавьте подписи и дату съёмки. Фото публикуются сразу. Самое свежее фото становится обложкой проекта.</p>
        <div className="adm-drop">
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
        {picks.length ? (
          <>
            <div className="adm-grid" style={{ marginTop: 14 }}>
              <div className="adm-field c3"><label>Дата съёмки</label><input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="adm-photos" style={{ marginTop: 14 }}>
              {picks.map((p, i) => (
                <div className="adm-photo" key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(p.file)} alt="" />
                  <div>
                    <input className="adm-cell" placeholder="Подпись, например: Фасад, блок A" value={p.caption} onChange={(e) => setPicks((c) => c.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
                    <button type="button" className="adm-btn adm-btn--line adm-btn--sm" onClick={() => setPicks((c) => c.filter((_, j) => j !== i))}>Убрать</button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 14 }}><button type="button" className="adm-btn" disabled={busy} onClick={upload}>{busy ? "Загрузка…" : `Опубликовать (${picks.length})`}</button></p>
          </>
        ) : null}
        {msg ? <p className={`adm-msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{msg.text}</p> : null}
      </section>

      <section className="adm-card">
        <h3>Фото проекта · {photos.filter((p) => p.status === "published").length} на сайте</h3>
        {photos.length === 0 ? <p className="adm-hint">Пока нет ни одного фото.</p> : (
          <div className="adm-photos">
            {photos.map((p) => (
              <div className="adm-photo" key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption} referrerPolicy="no-referrer" loading="lazy" />
                <div>
                  <b>{p.caption}</b>
                  <span className="adm-hint">{p.observed_at} · <span className={`adm-pill ${p.status === "published" ? "ok" : p.status === "pending" ? "warn" : "bad"}`}>{STATUS_RU[p.status] ?? p.status}</span></span>
                  {p.status === "pending" ? <button type="button" className="adm-btn adm-btn--sm" onClick={() => decide(p.id, "approve")}>Опубликовать</button> : null}
                  {p.status === "pending" ? <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => decide(p.id, "reject")}>Отклонить</button> : null}
                  {p.status === "published" ? <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => decide(p.id, "remove")}>Убрать с сайта</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
