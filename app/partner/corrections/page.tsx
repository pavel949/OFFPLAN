import Link from "next/link";
import { redirect } from "next/navigation";
import { catalogProjectSchema } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CorrectionForm } from "./correction-form";

const statusRu: Record<string, { label: string; cls: string }> = {
  open: { label: "На рассмотрении", cls: "warn" },
  granted: { label: "Доступ к правке выдан", cls: "ok" },
  closed: { label: "Закрыт", cls: "" },
};

export default async function PartnerCorrectionsPage() {
  const db = await createSupabaseServerClient();
  if (!db) return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await db.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!prof?.org_id) return <div className="pt-warn">Ваша учётная запись ещё не привязана к компании. <Link href="/protection/contact" style={{ textDecoration: "underline" }}>Напишите нам</Link>.</div>;

  const [{ data: projs }, { data: reqs }] = await Promise.all([
    db.from("catalog_projects").select("id, payload").eq("org_id", prof.org_id),
    db.from("correction_requests").select("id, project_id, message, status, created_at").eq("org_id", prof.org_id).order("created_at", { ascending: false }).limit(20),
  ]);
  const projects = (projs ?? []).map((p) => ({ id: p.id as string, name: catalogProjectSchema.safeParse(p.payload).data?.n ?? "Проект" }));
  const name = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <>
      <div className="pt-hero"><div><h1>Исправить данные на сайте</h1><p>Если в опубликованной карточке есть ошибка, напишите нам. После проверки мы откроем карточку для правки или исправим сами.</p></div></div>
      <CorrectionForm projects={projects} />
      {reqs?.length ? (
        <section className="adm-card">
          <h3>Мои просьбы</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 12 }}>
            {reqs.map((r) => {
              const st = statusRu[r.status as string] ?? { label: r.status as string, cls: "" };
              return (
                <li key={r.id as string} style={{ borderTop: "1px solid var(--bdr)", paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <b>{name.get(r.project_id as string) ?? "Проект"}</b>
                    <span className={`adm-pill ${st.cls}`}>{st.label}</span>
                    <span className="adm-hint">{new Date(r.created_at as string).toLocaleDateString("ru-RU")}</span>
                  </div>
                  <p style={{ fontSize: 14, marginTop: 4 }}>{r.message as string}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
