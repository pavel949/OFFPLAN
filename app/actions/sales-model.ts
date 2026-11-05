"use server";

import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { emptySalesModel, salesModelSchema } from "@/lib/sales-model";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldLabels } from "@/lib/sales-form";
import { publicSalesProjection } from "@/lib/sales-public";

async function admin() {
  if (!(await getAdminSessionOk())) throw new Error("Нужен вход администратора");
  return createServiceRoleClient();
}

export async function adminGetSalesModel(projectId: string) {
  const db = await admin();
  z.uuid().parse(projectId);
  const [project, latest, publication] = await Promise.all([
    db.from("catalog_projects").select("id,jurisdiction_code").eq("id",projectId).single(),
    db.from("project_sales_models").select("revision,model,created_at,actor").eq("project_id",projectId).order("revision",{ascending:false}).limit(1).maybeSingle(),
    db.from("project_sales_publications").select("revision,expires_at").eq("project_id",projectId).maybeSingle(),
  ]);
  if (project.error) throw new Error("Проект не найден");
  if (latest.error || publication.error) throw new Error("Не удалось прочитать коммерческую модель");
  // Paginate: a project may exceed PostgREST's default 1000-row limit.
  const units: {id:string;label:string;status:string}[]=[];
  for(let start=0;;start+=500) {
    const r=await db.from("project_units").select("id,label,status").eq("project_id",projectId).order("id").range(start,start+499);
    if(r.error) throw new Error("Не удалось прочитать юниты");
    units.push(...r.data);
    if(r.data.length<500) break;
  }
  const model=latest.data ? salesModelSchema.parse(latest.data.model) : emptySalesModel();
  if(!latest.data) {
    model.countryCode=project.data.jurisdiction_code ?? "";
    const geo=await db.from("jurisdictions").select("currency").eq("code",model.countryCode).maybeSingle();
    if(geo.error) throw new Error("Не удалось прочитать валюту юрисдикции");
    if(geo.data?.currency) model.defaultCurrency=geo.data.currency;
  }
  return {actor:latest.data?.actor ?? null,model,revision:latest.data?.revision ?? 0,updatedAt:latest.data?.created_at ?? null,units,publication:publication.data};
}

export async function adminPublishSalesModel(projectId:string,revision:number,until:string) {
  try {
    const db=await admin();z.uuid().parse(projectId);z.iso.date().parse(until);
    const expiry=new Date(`${until}T23:59:59Z`).getTime();
    if(expiry<=Date.now()||expiry>Date.now()+31*86400000) return {ok:false,error:"Срок публикации — от сегодня до 30 дней"};
    const current=await adminGetSalesModel(projectId);
    if(current.revision!==revision || !revision) return {ok:false,error:"Сначала сохраните и обновите последнюю версию"};
    const projection=publicSalesProjection(current.model,revision,current.units,new Date().toISOString().slice(0,10));
    const intended=current.model.offers.filter(o=>o.status==="offered");
    if(!intended.length||projection.offers.length!==intended.length) return {ok:false,error:"Для каждого публикуемого предложения нужны цена и доступный юнит с датированными источниками не старше 30 дней. Проверьте сроки и статусы в «Лоты и цены»."};
    const p=await db.from("catalog_projects").select("slug,is_published,moderation_status").eq("id",projectId).single();
    if(p.error||!p.data.is_published||p.data.moderation_status!=="published") return {ok:false,error:"Сначала опубликуйте сам проект"};
    const {error}=await db.from("project_sales_publications").upsert({project_id:projectId,revision,expires_at:new Date(expiry).toISOString(),published_at:new Date().toISOString()});
    if(error) throw error;
    revalidatePath(`/admin/projects/${projectId}`);revalidatePath(`/project/${p.data.slug}`);
    return {ok:true,error:undefined};
  }catch{return {ok:false,error:"Не удалось опубликовать условия"};}
}

export async function adminWithdrawSalesModel(projectId:string) {
  try {
    const db=await admin();z.uuid().parse(projectId);
    const {error}=await db.from("project_sales_publications").delete().eq("project_id",projectId);
    if(error) throw error;
    revalidatePath(`/admin/projects/${projectId}`);revalidatePath("/project/[slug]","page");
    return {ok:true,error:undefined};
  }catch{return {ok:false,error:"Не удалось снять условия с публикации"};}
}

export async function adminSaveSalesModel(projectId: string, revision: number, input: unknown) {
  try {
    const db=await admin();
    z.uuid().parse(projectId);
    z.number().int().nonnegative().parse(revision);
    if(JSON.stringify(input).length>2_000_000) return {ok:false,error:"Модель слишком велика"};
    const parsed=salesModelSchema.safeParse(input);
    if(!parsed.success) return {ok:false,error:parsed.error.issues.slice(0,8).map(i=>`${i.path.map(p=>typeof p === "number"?p+1:fieldLabels[String(p)] ?? String(p)).join(" → ")}: ${i.message}`).join("\n")};
    const previous=await db.from("project_sales_models").select("model").eq("project_id",projectId).eq("revision",revision).maybeSingle();
    if(previous.error) return {ok:false,error:"Не удалось проверить предыдущую версию"};
    if(previous.data) {
      const old=salesModelSchema.parse(previous.data.model);
      if(old.areaUnit!==parsed.data.areaUnit && (old.units.length || old.fees.some(f=>f.basis.startsWith("per_")))) return {ok:false,error:"Нельзя менять единицу площади у заполненной модели без пересчёта. Сохраните отдельную версию без площадей и ставок за площадь, затем задайте новую единицу и внесите пересчитанные значения."};
    }
    const {error}=await db.from("project_sales_models").insert({project_id:projectId,revision:revision+1,model:parsed.data});
    if(error) {
      if(error.code === "23505" || error.message.includes("revision conflict")) return {ok:false,error:"Другой сотрудник уже сохранил новую версию. Обновите страницу; ваши несохранённые изменения пока остаются в форме."};
      if(error.message.includes("unit project mismatch")) return {ok:false,error:"Юнит удалён или относится к другому проекту. Обновите список юнитов."};
      return {ok:false,error:"Не удалось сохранить модель. Проверьте данные и повторите."};
    }
    revalidatePath(`/admin/projects/${projectId}`);
    return {ok:true,revision:revision+1};
  } catch { return {ok:false,error:"Не удалось сохранить. Проверьте вход администратора."}; }
}

/** Thin metadata only; latest partner revisions awaiting explicit operator publication. */
export async function adminPendingSalesReviews() {
  const db = await admin();
  const latest = new Map<string, { project_id: string; revision: number; actor: string; created_at: string }>();
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("project_sales_models").select("project_id,revision,actor,created_at").order("project_id").order("revision", { ascending: false }).range(offset, offset + 499);
    if (result.error) throw new Error("Не удалось загрузить очередь условий продажи");
    for (const row of result.data) if (!latest.has(row.project_id)) latest.set(row.project_id, row);
    if (result.data.length < 500) break;
  }
  const candidates = [...latest.values()].filter(r => r.actor?.startsWith("partner:"));
  if (!candidates.length) return [];
  const result: { projectId: string; revision: number; name: string; createdAt: string }[] = [];
  for (let offset = 0; offset < candidates.length; offset += 100) {
    const batch = candidates.slice(offset, offset + 100), ids = batch.map(r => r.project_id);
    const [published, projects] = await Promise.all([
      db.from("project_sales_publications").select("project_id,revision").in("project_id", ids),
      db.from("catalog_projects").select("id,payload").in("id", ids),
    ]);
    if (published.error || projects.error) throw new Error("Не удалось сопоставить очередь с публикациями");
    for (const r of batch) if (!published.data.some(p => p.project_id === r.project_id && p.revision === r.revision)) {
      result.push({ projectId: r.project_id, revision: r.revision, name: String(projects.data.find(p => p.id === r.project_id)?.payload?.n ?? "Проект"), createdAt: r.created_at });
    }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
