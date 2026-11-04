import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DraftInfoForm } from "@/components/partner/DraftInfoForm";
import { ProjectTabs } from "@/components/partner/ProjectTabs";
import { STATUS_RU } from "@/lib/partner-projects";
import { catalogProjectSchema } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerProjectEditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await createSupabaseServerClient();
  if (!db) return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: prof } = await db.from("profiles").select("org_id, role, partner_role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id) redirect("/partner");

  const { data: row } = await db
    .from("catalog_projects")
    .select("id, org_id, payload, draft_payload, moderation_status")
    .eq("id", projectId)
    .maybeSingle();
  if (!row || row.org_id !== prof.org_id) notFound();

  const parsed = catalogProjectSchema.safeParse(row.draft_payload ?? row.payload);
  if (!parsed.success) return <p className="pt-warn">Карточка повреждена. Напишите нам, мы восстановим её.</p>;

  const [{ count: pending }, { data: regs }] = await Promise.all([
    db.from("moderation_submissions").select("id", { count: "exact", head: true }).eq("entity_type", "project").eq("entity_id", projectId).eq("status", "pending"),
    db.from("regions").select("id, name, parent_id, level"),
  ]);
  const regions = (regs ?? []) as { id: string; name: { en?: string; ru?: string }; parent_id: string | null; level: string }[];
  const regionName = new Map(regions.map((r) => [r.id, r.name?.ru ?? r.name?.en ?? ""]));
  const locations = regions
    .filter((r) => r.level === "district")
    .map((r) => ({ id: r.id, name_en: r.name?.en ?? "", name_ru: r.name?.ru ?? r.name?.en ?? "", region: r.parent_id ? regionName.get(r.parent_id) ?? "" : "" }))
    .sort((a, b) => a.region.localeCompare(b.region) || a.name_ru.localeCompare(b.name_ru));

  const locked = (pending ?? 0) > 0;
  const canEdit = prof.partner_role !== "sales";
  const st = STATUS_RU[row.moderation_status] ?? { label: row.moderation_status, cls: "" };

  return (
    <>
      <ProjectTabs projectId={projectId} active="" name={parsed.data.n} />
      <p className="adm-sub" style={{ marginBottom: 16 }}>
        <span className={`adm-pill ${st.cls}`}>{st.label}</span>
        {row.moderation_status === "published" ? <Link href="/" target="_blank">Каталог ↗</Link> : null}
      </p>
      {locked ? <div className="pt-lock">Карточка на проверке у команды IE, редактирование закрыто до решения. Лоты, фото и новости можно вести как обычно.</div> : null}
      {!canEdit ? <div className="pt-lock">Карточку может редактировать владелец компании. Вам доступны лоты, новости и акции.</div> : null}
      <DraftInfoForm projectId={projectId} payload={parsed.data} locations={locations} locked={locked} canEdit={canEdit} />
    </>
  );
}
