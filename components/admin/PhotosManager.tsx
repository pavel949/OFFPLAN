"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoUploadRecovery, usePhotoUploadRecovery } from "@/components/shared/PhotoUploadRecovery";
import { LocalPhotoPreview } from "@/components/shared/LocalPhotoPreview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  adminStudioPhotoDecision, adminStudioRegisterPhotos, adminStudioSignUploads, type PhotoRow,
} from "@/app/actions/admin-studio";

import { MediaFields, mediaDetails, emptyMediaMetadata, type MediaMetadata } from "@/components/portal/MediaFields";
import { mediaLabel } from "@/lib/project-media";
import { photoUploadFailure } from "@/lib/photo-upload";
type Pick = { file: File; caption: string; metadata: MediaMetadata };
const MAX = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const STATUS_RU: Record<string, string> = { published: "на сайте", pending: "на проверке", rejected: "отклонено" };

export function PhotosManager({ projectId, photos, units = [] }: { projectId: string; photos: PhotoRow[]; units?: {id:string;label:string}[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const {recovery,ready,recoveryError,saveRecovery,completeRecovery} = usePhotoUploadRecovery(projectId,"admin");
  const active = useRef(false);
  const [blocked,setBlocked] = useState(false);
  const [uploadedPaths,setUploadedPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deciding, start] = useTransition();

  function pick(files: FileList | null) {
    if (!files) return;
    const ok: Pick[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (EXT[f.type] && f.size <= MAX) ok.push({ file: f, caption: "", metadata:{...emptyMediaMetadata,sort_order:picks.length+ok.length} });
      else skipped++;
    }
    setPicks((p) => [...p, ...ok].slice(0, 40));
    setMsg(skipped ? { ok: false, text: `Пропущено: ${skipped} (нужен JPG/PNG/WebP до 8 МБ)` } : null);
  }

  async function upload() {
    if (active.current || blocked) return;
    if (!ready || recovery || recoveryError) return;
    active.current = true;
    let uploaded = 0;
    let writing = false;
    let phase: "upload" | "register" = "upload";
    const sb = createSupabaseBrowserClient();
    if (!sb) { active.current = false; return setMsg({ ok: false, text: "Нет подключения к хранилищу" }); }
    setBusy(true);
    setMsg(null);
    try {
      const slots = await adminStudioSignUploads(projectId, picks.length, picks.map((p) => EXT[p.file.type]), picks.map(p=>({caption:p.caption,details:mediaDetails(p.metadata)})), date);
      if (!slots.ok || !slots.slots) { setBusy(false); return setMsg({ ok: false, text: slots.error ?? "Ошибка" }); }
      saveRecovery({projectId,observedAt:date,items:slots.slots.map((s,i)=>({path:s.path,caption:picks[i].caption,details:mediaDetails(picks[i].metadata)}))});
      setUploadedPaths(slots.slots.map(s=>s.path));
      const done: { path: string; caption: string; details:Record<string,unknown> }[] = [];
      for (let i = 0; i < picks.length; i++) {
        const s = slots.slots[i];
        writing = true;
        const { error } = await sb.storage.from("project-photos").uploadToSignedUrl(s.path, s.token, picks[i].file, { contentType: picks[i].file.type });
        if (error) throw new Error(`«${picks[i].file.name}»: ${error.message}`);
        uploaded++;
        done.push({ path: s.path, caption: picks[i].caption, details:mediaDetails(picks[i].metadata) });
      }
      phase = "register";
      const r = await adminStudioRegisterPhotos(projectId, done, date);
      setBusy(false);
      if (!r.ok) throw new Error(r.error ?? "Ошибка регистрации");
      completeRecovery();
      setPicks([]);
      setUploadedPaths([]);
      setMsg({ ok: true, text: `Опубликовано фото: ${r.saved}` });
      router.refresh();
    } catch(e) {
      if (writing) setBlocked(true);
      const reason = e instanceof Error ? e.message : "Соединение прервано";
      setMsg({ok:false,text:writing ? photoUploadFailure(uploaded,picks.length,phase,reason) : reason});
    } finally {
      active.current = false;
      setBusy(false);
    }
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
        <p className="adm-lead">Фотографии доступны по ссылке сразу после загрузки. Документы для проверки размещайте в разделе документов. Выберите файлы (JPG, PNG, WebP до 8 МБ, до 40 за раз), добавьте подписи и дату съёмки. Фото публикуются сразу. Выберите тип материала, порядок и предпочтительную обложку. Планы с указанным типом не используются как фон проекта. Загружайте только материалы, которые вы вправе публиковать.</p>
        <div className="adm-drop">
          <input type="file" multiple disabled={busy || blocked || !ready || !!recovery || !!recoveryError} accept="image/jpeg,image/png,image/webp" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
        {picks.length ? (
          <>
            <div className="adm-grid" style={{ marginTop: 14 }}>
              <div className="adm-field c3"><label>Дата съёмки</label><input type="date" disabled={busy || blocked || !ready || !!recovery || !!recoveryError} value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="adm-photos" style={{ marginTop: 14 }}>
              {picks.map((p, i) => (
                <div className="adm-photo" key={i}>
                  <LocalPhotoPreview file={p.file} />
                  <div>
                    <input className="adm-cell" disabled={busy || blocked || !ready || !!recovery || !!recoveryError} placeholder="Подпись, например: Фасад, блок A" value={p.caption} onChange={(e) => setPicks((c) => c.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
                    <MediaFields value={p.metadata} onChange={metadata=>setPicks(c=>c.map((x,j)=>j===i?{...x,metadata}:x))} units={units} disabled={busy || blocked || !ready || !!recovery || !!recoveryError}/>
                    <button type="button" disabled={busy || blocked || !ready || !!recovery || !!recoveryError} className="adm-btn adm-btn--line adm-btn--sm" onClick={() => setPicks((c) => c.filter((_, j) => j !== i))}>Убрать</button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 14 }}><button type="button" className="adm-btn" disabled={busy || blocked || !ready || !!recovery || !!recoveryError} onClick={upload}>{busy ? "Загрузка…" : `Опубликовать (${picks.length})`}</button></p>
          </>
        ) : null}
        <PhotoUploadRecovery recovery={recovery} mode="admin" error={recoveryError} busy={busy} onResolved={()=>{completeRecovery();setPicks([]);setBlocked(false);setUploadedPaths([]);}}/>
        {blocked && uploadedPaths.length ? <details><summary>Пути файлов для проверки</summary><ul>{uploadedPaths.map(path=><li key={path}>{path}</li>)}</ul></details> : null}
        {msg ? <p role="status" className={`adm-msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{msg.text}</p> : null}
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
                  <p className="adm-hint">{mediaLabel(p.details,"ru")} · Обложка: {p.details.cover === true ? "да" : "нет"} · Порядок: {String(p.details.sort_order ?? "не указан")}</p>
                  {p.details.unit_id ? <p className="adm-hint">Лот: {units.find(u=>u.id === p.details.unit_id)?.label ?? "не найден"} ({String(p.details.unit_id)})</p> : null}
                  {p.details.type_label ? <p className="adm-hint">Тип планировки: {String(p.details.type_label)}</p> : null}
                  <span className="adm-hint">{p.observed_at} · <span className={`adm-pill ${p.status === "published" ? "ok" : p.status === "pending" ? "warn" : "bad"}`}>{STATUS_RU[p.status] ?? p.status}</span></span>
                  {p.status === "pending" ? <button type="button" className="adm-btn adm-btn--sm" disabled={deciding} onClick={() => decide(p.id, "approve")}>Опубликовать</button> : null}
                  {p.status === "pending" ? <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={deciding} onClick={() => decide(p.id, "reject")}>Отклонить</button> : null}
                  {p.status === "published" ? <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={deciding} onClick={() => decide(p.id, "remove")}>Убрать с сайта</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

