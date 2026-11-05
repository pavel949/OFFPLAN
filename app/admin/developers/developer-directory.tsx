"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { adminSaveDeveloper, type DeveloperSaveState } from "@/app/actions/developer-directory";
import { retainDeveloperIdentity, type DirectoryDeveloper } from "@/lib/developer-directory";

type Org = { id: string; name_ru: string };
function DeveloperForm({ developer, orgs, done }: { developer?: DirectoryDeveloper; orgs: Org[]; done?: () => void }) {
  const router = useRouter();
  const [fields, setFields] = useState({ name_en: developer?.name_en ?? "", name_ru: developer?.name_ru ?? "", website: developer?.website ?? "", org_id: developer?.org_id ?? "" });
  const setField = (key: keyof typeof fields, value: string) => setFields(current => ({ ...current, [key]: value }));
  const [state, action, pending] = useActionState(async (previous: DeveloperSaveState, fd: FormData) => {
    const result = await adminSaveDeveloper(previous, fd);
    if (result.ok) router.refresh();
    return retainDeveloperIdentity(previous, result);
  }, { ok: false } as DeveloperSaveState);
  // Successful create keeps its returned ID: another click edits the same record, never creates a duplicate.
  return <form action={action} className="adm-grid">
    <input type="hidden" name="id" value={state.id ?? developer?.id ?? ""} />
    <input type="hidden" name="revision" value={state.revision ?? developer?.admin_revision ?? 0} />
    <label className="c6">Название на английском<input className="admin-inp" name="name_en" required minLength={2} maxLength={200} value={fields.name_en} onChange={event => setField("name_en", event.target.value)} /></label>
    <label className="c6">Название на русском<input className="admin-inp" name="name_ru" maxLength={200} value={fields.name_ru} onChange={event => setField("name_ru", event.target.value)} placeholder="Если пусто, используем английское" /></label>
    <label className="c6">Сайт<input className="admin-inp" name="website" type="url" maxLength={500} value={fields.website} onChange={event => setField("website", event.target.value)} placeholder="https://…" /></label>
    <label className="c6">Организация партнёра<select className="admin-inp" name="org_id" value={fields.org_id} onChange={event => setField("org_id", event.target.value)}><option value="">Без связи с кабинетом</option>{orgs.map(org => <option key={org.id} value={org.id}>{org.name_ru}</option>)}</select></label>
    <p className="adm-hint c12">Связь со справочником не выдаёт доступ к проектам. Права партнёров и принадлежность существующих проектов не изменяются.</p>
    {developer ? <p className="adm-hint c12">Код {developer.code} не меняется, чтобы сохранить ссылки на публичное досье. Английское имя обновится в публичных карточках связанных проектов; русское имя используется в справочнике.</p> : null}
    <div className="c12"><button className="adm-btn" disabled={pending}>{pending ? "Сохраняю…" : "Сохранить застройщика"}</button>{done ? <button type="button" className="adm-btn adm-btn--line" onClick={done} disabled={pending}>Закрыть редактор</button> : null}</div>
    {state.ok ? <p role="status" className="adm-msg ok c12">Сохранено. Застройщик доступен при выборе в карточке проекта.</p> : null}
    {state.error ? <p role="alert" className="adm-msg err c12">{state.error}</p> : null}
  </form>;
}
export function DeveloperDirectory({ developers, orgs }: { developers: DirectoryDeveloper[]; orgs: Org[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = developers.filter(d => `${d.name_en} ${d.name_ru} ${d.code}`.toLowerCase().includes(q));
  return <>
    <section className="adm-card"><h2>Справочник застройщиков</h2><p>Создайте застройщика без приглашения пользователя или измените существующую запись. Затем выберите его в проекте.</p>
      <button type="button" className="adm-btn" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "Закрыть создание" : "+ Новый застройщик"}</button>
      {editing === "new" ? <DeveloperForm key="new" orgs={orgs} done={() => setEditing(null)} /> : null}
    </section>
    <label>Поиск застройщика<input type="search" className="admin-inp" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или код" /></label>
    <p className="adm-hint">Показано {list.length} из {developers.length}</p>
    {list.map(developer => <section className="adm-card" key={developer.id}>
      <div className="adm-head"><div><h2>{developer.name_ru || developer.name_en}</h2><p className="adm-hint">{developer.name_en} · {developer.code} · {orgs.find(o => o.id === developer.org_id)?.name_ru ?? "Без кабинета партнёра"}</p></div><button type="button" className="adm-btn adm-btn--line" onClick={() => setEditing(editing === developer.id ? null : developer.id)}>{editing === developer.id ? "Закрыть" : "Редактировать"}</button></div>
      {editing === developer.id ? <DeveloperForm key={developer.id} developer={developer} orgs={orgs} done={() => setEditing(null)} /> : null}
    </section>)}
    {!list.length ? <p>Застройщики не найдены. Измените поиск или создайте запись.</p> : null}
  </>;
}
