import "server-only";
import {createServiceRoleClient,hasSupabaseServiceConfig} from "./supabase/service";
import {salesModelSchema} from "./sales-model";
import {publicSalesProjection} from "./sales-public";

export async function getPublicSales(projectId:string) {
  if(!hasSupabaseServiceConfig()) return null;
  const db=createServiceRoleClient();
  const [project,published]=await Promise.all([
    db.from("catalog_projects").select("id").eq("id",projectId).eq("is_published",true).eq("moderation_status","published").maybeSingle(),
    db.from("project_sales_publications").select("revision,expires_at").eq("project_id",projectId).maybeSingle(),
  ]);
  if(project.error||published.error) throw new Error("Sales publication unavailable");
  if(!project.data||!published.data) return null;
  const revision=published.data.revision as number;
  if(new Date(published.data.expires_at).getTime()<=Date.now()) return {revision,offers:[]};
  const {data,error}=await db.from("project_sales_models").select("model").eq("project_id",projectId).eq("revision",revision).single();
  if(error) throw new Error("Sales model unavailable");
  const model=salesModelSchema.parse(data.model);
  const units:{id:string;label:string;status:string}[]=[];
  for(let start=0;;start+=500) {
    const r=await db.from("project_units").select("id,label,status").eq("project_id",projectId).order("id").range(start,start+499);
    if(r.error) throw new Error("Unit identities unavailable");
    units.push(...r.data);if(r.data.length<500) break;
  }
  return publicSalesProjection(model,revision,units,new Date().toISOString().slice(0,10));
}

export async function resolveSalesSelection(legacyId:number,offerId:string,revision:number) {
  const db=createServiceRoleClient();
  const p=await db.from("catalog_projects").select("id,payload").eq("legacy_id",legacyId).eq("is_published",true).eq("moderation_status","published").single();
  if(p.error) throw new Error("Project not available");
  const sales=await getPublicSales(p.data.id);
  const offer=sales?.revision===revision?sales.offers.find(o=>o.id===offerId):null;
  if(!offer) throw new Error("Offer changed or unavailable");
  return {offer,projectName:String(p.data.payload.n ?? "")};
}
