import { partnerGetSalesModel } from "@/app/actions/partner-sales";
import { SalesModelEditor } from "@/components/admin/SalesModelEditor";
import { PhysicalUnitStatus } from "@/components/partner/PhysicalUnitStatus";
import { ProjectTabs } from "@/components/partner/ProjectTabs";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerInventoryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = await createSupabaseServerClient();
  if (!db) return <p role="alert">Кабинет временно недоступен.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: profile } = await db.from("profiles").select("org_id,role,partner_role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "partner" || !profile.org_id) redirect("/partner");
  const { data: project } = await db.from("catalog_projects").select("id,org_id").eq("id", projectId).eq("org_id", profile.org_id).maybeSingle();
  if (!project || project.org_id !== profile.org_id) notFound();
  if (profile.partner_role === "owner") {
    try {
      const sales = await partnerGetSalesModel(projectId);
      return <div><ProjectTabs projectId={projectId} active="/inventory" />
        <p className="pt-lock">Цены и условия для покупателей ведутся здесь, в одной версии с публичной витриной. Черновик → проверка IE → публикация. Изменение черновика не меняет действующие предложения.</p>
        <PhysicalUnitStatus projectId={projectId} units={sales.units} />
        <SalesModelEditor mode="partner" projectId={projectId} initial={sales.model} initialRevision={sales.revision} units={sales.units} initialPublication={sales.publication} />
      </div>;
    } catch {
      return <div><ProjectTabs projectId={projectId} active="/inventory" /><p role="alert">Не удалось загрузить условия продажи. Повторите позже или обратитесь к команде IE. Старый редактор цен не используется вместо этой модели.</p></div>;
    }
  }
  const units: { id: string; label: string; status: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("project_units").select("id,label,status").eq("project_id", projectId).order("id").range(offset, offset + 499);
    if (result.error) return <p role="alert">Не удалось загрузить физические статусы.</p>;
    units.push(...result.data);
    if (result.data.length < 500) break;
  }
  return <div><ProjectTabs projectId={projectId} active="/inventory" /><p>Цены и условия ведёт владелец организации. Сотрудник отдела продаж может обновить физический статус ниже.</p><PhysicalUnitStatus projectId={projectId} units={units} /></div>;
}
