"use server";

import { preparePhotoEvidence, type PhotoUploadItem } from "@/lib/photo-upload";
import { revalidatePath } from "next/cache";
import { requireAdminQuery, projectIsPublished } from "@/lib/admin-workspace";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { insertCatalogAuditLog } from "@/lib/marketplace/audit";
import { devCode } from "@/lib/project-wizard";
import { catalogProjectSchema } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import { completeness, mergeStudioFields, parseStudioForm, type CompletenessItem } from "@/lib/studio";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

type Db = ReturnType<typeof createServiceRoleClient>;
type Res = { ok: boolean; error?: string };

async function admin(): Promise<Db> {
  if (!(await getAdminSessionOk())) throw new Error("Нужен вход в панель IE");
  if (!hasSupabaseServiceConfig()) throw new Error("Не задан SUPABASE_SERVICE_ROLE_KEY");
  return createServiceRoleClient();
}
const msg = (e: unknown) => (e instanceof Error ? e.message : "Ошибка");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refresh(projectId: string, slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/project", "layout");
  if (slug) revalidatePath(`/project/${slug}`);
}

// ───────────────────────────── reference data ─────────────────────────────
export type DeveloperOpt = { id: string; code: string; name: string };
export type LocationOpt = { id: string; name_en: string; name_ru: string; region: string; country: string };

export async function adminStudioReference(): Promise<{
  developers: DeveloperOpt[];
  locations: LocationOpt[];
  regions: { id: string; name: string; country: string }[];
}> {
  const db = await admin();
  const [d, r] = await Promise.all([
    db.from("developers").select("id, code, name_en, name_ru").order("name_en"),
    db.from("regions").select("id, jurisdiction_code, parent_id, level, name").order("sort_order"),
  ]);
  requireAdminQuery(d, "Не удалось загрузить справочник застройщиков");
  requireAdminQuery(r, "Не удалось загрузить справочник локаций");
  const regs = (r.data ?? []) as { id: string; jurisdiction_code: string; parent_id: string | null; level: string; name: { en?: string; ru?: string } }[];
  const regionName = new Map(regs.map((x) => [x.id, x.name?.ru || x.name?.en || ""]));
  return {
    developers: (d.data ?? []).map((x) => ({ id: x.id as string, code: x.code as string, name: (x.name_ru || x.name_en) as string })),
    locations: regs
      .filter((x) => x.level === "district" || x.level === "region")
      .map((x) => ({
        id: x.id,
        name_en: x.name?.en ?? "",
        name_ru: x.name?.ru ?? x.name?.en ?? "",
        region: x.parent_id ? regionName.get(x.parent_id) ?? "" : "",
        country: x.jurisdiction_code,
      })),
    regions: regs
      .filter((x) => x.level === "region")
      .map((x) => ({ id: x.id, name: x.name?.ru || x.name?.en || "", country: x.jurisdiction_code })),
  };
}

// ───────────────────────────── project list ─────────────────────────────
export type StudioRow = {
  id: string;
  slug: string;
  name: string;
  developer: string;
  zone: string;
  stK: string;
  priceFromM: number;
  status: string;
  published: boolean;
  units: number;
  photos: number;
  links: number;
  news: number;
  score: number;
};

export async function adminStudioList(): Promise<StudioRow[]> {
  const db = await admin();
  const [p, u, ph, so, up] = await Promise.all([
    db.from("catalog_projects").select("id, slug, moderation_status, is_published, payload, developer_id, region_id, draft_payload").order("slug"),
    db.from("project_units").select("project_id").limit(20000),
    db.from("project_evidence").select("project_id").eq("kind", "photo").eq("status", "published").limit(20000),
    db.from("project_sources").select("project_id").limit(20000),
    db.from("project_updates").select("project_id").limit(20000),
  ]);
  requireAdminQuery(p, "Не удалось загрузить проекты");
  for (const result of [u, ph, so, up]) requireAdminQuery(result, "Не удалось загрузить заполненность проектов. Повторите загрузку страницы.");
  const count = (rows: { project_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1);
    return m;
  };
  const cu = count(u.data), cp = count(ph.data), cs = count(so.data), cn = count(up.data);
  return (p.data ?? []).map((r) => {
    const pl = (r.payload ?? {}) as Partial<ReturnType<typeof catalogProjectSchema.parse>>;
    const c = completeness({
      hasDeveloper: !!r.developer_id,
      hasLocation: !!r.region_id,
      descLength: (pl.desc ?? "").length,
      hasSource: !!pl.src,
      priceKnown: (pl.pN ?? 0) > 0,
      units: cu.get(r.id) ?? 0,
      photos: cp.get(r.id) ?? 0,
      links: cs.get(r.id) ?? 0,
      news: cn.get(r.id) ?? 0,
    });
    return {
      id: r.id,
      slug: r.slug,
      name: pl.n ?? r.slug,
      developer: pl.dev ?? "",
      zone: pl.zone ?? "",
      stK: pl.stK ?? "",
      priceFromM: pl.pN ?? 0,
      status: r.moderation_status,
      published: projectIsPublished(r),
      units: cu.get(r.id) ?? 0,
      photos: cp.get(r.id) ?? 0,
      links: cs.get(r.id) ?? 0,
      news: cn.get(r.id) ?? 0,
      score: c.score,
    };
  });
}

// ───────────────────────────── one project ─────────────────────────────
export type StudioProject = {
  id: string;
  slug: string;
  status: string;
  published: boolean;
  payload: ReturnType<typeof catalogProjectSchema.parse>;
  developerId: string | null;
  regionId: string | null;
  confirmedAt: string | null;
  checklist: { score: number; items: CompletenessItem[] };
  counts: { units: number; photos: number; photosPending: number; links: number; news: number };
};

export async function adminStudioGetProject(id: string): Promise<StudioProject> {
  const db = await admin();
  const { data, error } = await db
    .from("catalog_projects")
    .select("id, slug, moderation_status, is_published, payload, developer_id, region_id, data_confirmed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Проект не найден");
  const head = (t: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = db.from(t).select("id", { count: "exact", head: true }).eq("project_id", id);
    if (f) q = f(q);
    return q.then((r) => {
      requireAdminQuery(r, "Не удалось загрузить состав проекта");
      return r.count ?? 0;
    });
  };
  const [units, photos, photosPending, links, news] = await Promise.all([
    head("project_units"),
    head("project_evidence", (q) => q.eq("kind", "photo").eq("status", "published")),
    head("project_evidence", (q) => q.eq("kind", "photo").eq("status", "pending")),
    head("project_sources"),
    head("project_updates"),
  ]);
  const payload = catalogProjectSchema.parse(data.payload);
  return {
    id: data.id,
    slug: data.slug,
    status: data.moderation_status,
    published: projectIsPublished(data),
    payload,
    developerId: data.developer_id,
    regionId: data.region_id,
    confirmedAt: data.data_confirmed_at,
    counts: { units, photos, photosPending, links, news },
    checklist: completeness({
      hasDeveloper: !!data.developer_id,
      hasLocation: !!data.region_id,
      descLength: payload.desc.length,
      hasSource: !!payload.src,
      priceKnown: payload.pN > 0,
      units, photos, links, news,
    }),
  };
}

/** Save the structured "Основное" form: merges into the payload and links developer and location records. */
export async function adminStudioSaveInfo(projectId: string, _prev: Res, fd: FormData): Promise<Res & { developerId?: string; regionId?: string }> {
  try {
    const db = await admin();
    const parsed = parseStudioForm(fd);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const { data: row, error: rErr } = await db
      .from("catalog_projects")
      .select("slug, payload, region_id, developer_id, jurisdiction_code")
      .eq("id", projectId)
      .maybeSingle();
    if (rErr || !row) return { ok: false, error: rErr?.message ?? "Проект не найден" };

    // Location: an existing district, or a new one created on the fly under a chosen region.
    let regionId = String(fd.get("region_id") ?? "");
    let jurisdiction = row.jurisdiction_code as string | null;
    let zoneEn = "";
    if (regionId === "__new") {
      const en = String(fd.get("zoneNewEn") ?? "").trim();
      const ru = String(fd.get("zoneNewRu") ?? "").trim() || en;
      const parent = String(fd.get("zoneNewParent") ?? "");
      if (!en) return { ok: false, error: "Укажите название новой локации (по-английски)" };
      if (!UUID.test(parent)) return { ok: false, error: "Выберите город или провинцию для новой локации" };
      const { data: par } = await db.from("regions").select("jurisdiction_code").eq("id", parent).maybeSingle();
      if (!par) return { ok: false, error: "Город или провинция не найдены" };
      const { data: made, error: mErr } = await db
        .from("regions")
        .insert({ jurisdiction_code: par.jurisdiction_code, parent_id: parent, slug: slugify(en), level: "district", name: { en, ru } })
        .select("id")
        .single();
      if (mErr) return { ok: false, error: mErr.code === "23505" ? "Локация с таким названием уже есть: выберите её из списка" : mErr.message };
      regionId = made.id;
      jurisdiction = par.jurisdiction_code;
      zoneEn = en;
    } else if (UUID.test(regionId)) {
      const { data: reg } = await db.from("regions").select("jurisdiction_code, name").eq("id", regionId).maybeSingle();
      if (!reg) return { ok: false, error: "Локация не найдена" };
      jurisdiction = reg.jurisdiction_code;
      zoneEn = (reg.name as { en?: string }).en ?? "";
    } else {
      return { ok: false, error: "Выберите локацию" };
    }

    // Developer: existing, or created on the fly.
    let developerId = String(fd.get("developer_id") ?? "");
    let devName = "";
    let devCodeValue = "";
    if (developerId === "__new") {
      const name = String(fd.get("devNewName") ?? "").trim();
      if (name.length < 2) return { ok: false, error: "Укажите название нового застройщика" };
      let code = devCode(name).toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "").slice(0, 30) || "DEV";
      const { data: taken } = await db.from("developers").select("code").like("code", `${code}%`);
      if (taken?.some((t) => t.code === code)) code = `${code}${(taken?.length ?? 0) + 1}`;
      const { data: made, error: dErr } = await db
        .from("developers")
        .insert({ code, name_en: name, name_ru: name, jurisdiction_code: jurisdiction })
        .select("id")
        .single();
      if (dErr) return { ok: false, error: dErr.message };
      developerId = made.id;
      devName = name;
      devCodeValue = code;
    } else if (UUID.test(developerId)) {
      const { data: dv } = await db.from("developers").select("code, name_en, name_ru").eq("id", developerId).maybeSingle();
      if (!dv) return { ok: false, error: "Застройщик не найден" };
      devName = dv.name_en || dv.name_ru;
      devCodeValue = dv.code;
    } else {
      return { ok: false, error: "Выберите застройщика" };
    }

    const before = catalogProjectSchema.parse(row.payload);
    let merged;
    try {
      merged = mergeStudioFields(before, parsed.fields, { dev: devName, dt: devCodeValue, zone: zoneEn });
    } catch (e) {
      return { ok: false, error: `Проверьте поля: ${msg(e)}` };
    }

    const confirm = fd.get("confirm") === "on";
    const { error } = await db
      .from("catalog_projects")
      .update({
        payload: merged,
        developer_id: developerId,
        region_id: regionId,
        jurisdiction_code: jurisdiction,
        updated_at: new Date().toISOString(),
        ...(confirm ? { data_confirmed_at: new Date().toISOString() } : {}),
      })
      .eq("id", projectId);
    if (error) return { ok: false, error: error.message };

    const changed = (Object.keys(merged) as (keyof typeof merged)[]).filter((k) => JSON.stringify(merged[k]) !== JSON.stringify(before[k]));
    await insertCatalogAuditLog({ entity_type: "project", entity_id: projectId, actor_id: null, action: "project_edited_by_operator", diff: { changed } });
    refresh(projectId, row.slug);
    return { ok: true, developerId, regionId };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ───────────────────────────── units ─────────────────────────────
export type UnitInput = {
  id?: string;
  label: string;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price: number | null;
  status: "unknown" | "available" | "reserved" | "sold";
};

export async function adminStudioSaveUnit(projectId: string, u: UnitInput): Promise<Res & { id?: string; priceUpdatedAt?: string | null }> {
  try {
    const db = await admin();
    const label = u.label.trim();
    if (!label) return { ok: false, error: "Укажите номер лота" };
    if (!["unknown", "available", "reserved", "sold"].includes(u.status)) return { ok: false, error: "Некорректный статус" };
    const nn = (v: number | null, max: number, label: string, integer = false) => {
      if (v == null) return null;
      if (!Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v)))
        throw new Error(`${label}: укажите корректное ${integer ? "целое " : ""}число от 0 до ${max}`);
      return v;
    };
    const row = {
      label: label.slice(0, 80),
      bedrooms: nn(u.bedrooms, 50, "Спальни", true),
      floor: nn(u.floor, 300, "Этаж", true),
      sqm: nn(u.sqm, 100_000, "Площадь"),
      price_thb: nn(u.price, 1e12, "Цена"),
      status: u.status,
    };
    if (u.id) {
      const { data: old } = await db.from("project_units").select("price_thb, price_updated_at").eq("id", u.id).eq("project_id", projectId).maybeSingle();
      if (!old) return { ok: false, error: "Лот не найден" };
      const priceTouched = Number(old.price_thb ?? -1) !== Number(row.price_thb ?? -1);
      const priceUpdatedAt = priceTouched ? new Date().toISOString() : old.price_updated_at;
      const { error } = await db
        .from("project_units")
        .update({ ...row, ...(priceTouched ? { price_updated_at: priceUpdatedAt } : {}), source: "operator", updated_at: new Date().toISOString() })
        .eq("id", u.id)
        .eq("project_id", projectId);
      if (error) return { ok: false, error: error.message };
      refresh(projectId);
      return { ok: true, id: u.id, priceUpdatedAt };
    }
    const priceUpdatedAt = new Date().toISOString();
    const { data, error } = await db
      .from("project_units")
      .insert({ ...row, project_id: projectId, currency: "THB", source: "operator", price_updated_at: priceUpdatedAt, sort_order: 100000 })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true, id: data.id, priceUpdatedAt };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminStudioDeleteUnit(projectId: string, unitId: string): Promise<Res> {
  try {
    const db = await admin();
    const { error } = await db.from("project_units").delete().eq("id", unitId).eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** "Prices are still valid": re-stamps every priced, unsold unit as confirmed today. */
export async function adminStudioConfirmPrices(projectId: string): Promise<Res & { count?: number; ids?: string[]; confirmedAt?: string }> {
  try {
    const db = await admin();
    const confirmedAt = new Date().toISOString();
    const { data, error } = await db
      .from("project_units")
      .update({ price_updated_at: confirmedAt, source: "operator" })
      .eq("project_id", projectId)
      .neq("status", "sold")
      .not("price_thb", "is", null)
      .select("id");
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true, count: data?.length ?? 0, ids: (data ?? []).map((row) => row.id), confirmedAt };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ───────────────────────────── photos ─────────────────────────────
export type PhotoRow = { id: string; url: string; caption: string; status: string; observed_at: string; details: Record<string, unknown> };

export async function adminStudioListPhotos(projectId: string): Promise<PhotoRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("project_evidence")
    .select("id, details, status, observed_at")
    .eq("project_id", projectId)
    .eq("kind", "photo")
    .in("status", ["published", "pending", "rejected"])
    .order("observed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const d = (r.details ?? {}) as { url?: string; caption?: string };
    return { id: r.id, url: d.url ?? "", caption: d.caption ?? "", status: r.status, observed_at: r.observed_at, details: (r.details ?? {}) as Record<string, unknown> };
  });
}

/** Browser uploads go straight to Storage through one-time signed URLs (no body-size limit on our server). */
export async function adminStudioSignUploads(
  projectId: string,
  count: number,
  exts: string[],
  metadata: {caption:string;details?:Record<string,unknown>}[],
  observedAt: string,
): Promise<{ ok: boolean; error?: string; slots?: { path: string; token: string }[] }> {
  try {
    const db = await admin();
    if (!UUID.test(projectId) || !Number.isInteger(count) || count < 1 || count > 40 || metadata.length !== count || exts.length !== count) return { ok: false, error: "От 1 до 40 файлов за раз" };
    const paths = exts.map(ext => `${projectId}/${crypto.randomUUID()}.${["jpg", "png", "webp"].includes(ext) ? ext : "jpg"}`);
    const rows = preparePhotoEvidence({projectId,observedAt,items:metadata.map((m,i)=>({...m,path:paths[i]}))}, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const {data: project} = await db.from("catalog_projects").select("id").eq("id",projectId).maybeSingle();
    if (!project) return {ok:false,error:"Проект не найден"};
    for (const row of rows) {
      if (!row.details.unit_id) continue;
      const {data: unit} = await db.from("project_units").select("id").eq("id",String(row.details.unit_id)).eq("project_id",projectId).maybeSingle();
      if (!unit) return {ok:false,error:"Лот не принадлежит этому проекту"};
    }
    const slots: { path: string; token: string }[] = [];
    for (let i = 0; i < count; i++) {
      const path = paths[i];
      const { data, error } = await db.storage.from("project-photos").createSignedUploadUrl(path);
      if (error || !data) return { ok: false, error: error?.message ?? "Не удалось подготовить загрузку" };
      slots.push({ path, token: data.token });
    }
    return { ok: true, slots };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Operator-uploaded photos are trusted: they are published immediately. */
export async function adminStudioRegisterPhotos(
  projectId: string,
  items: PhotoUploadItem[],
  observedAt: string,
): Promise<Res & { saved?: number }> {
  let saved = 0;
  try {
    const db = await admin();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return { ok: false, error: "Нет NEXT_PUBLIC_SUPABASE_URL" };
    const rows = preparePhotoEvidence({projectId,observedAt,items}, url);
    for (const row of rows) {
      if (!row.details.unit_id) continue;
      const {data: unit} = await db.from("project_units").select("id").eq("id",String(row.details.unit_id)).eq("project_id",projectId).maybeSingle();
      if (!unit) return {ok:false,error:"Лот не принадлежит этому проекту"};
    }
    for (const row of rows) {
      const { data, error } = await db
        .from("project_evidence")
        .insert({
          ...row,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) return { ok: false, saved, error: `Опубликовано: ${saved} из ${items.length}. ${error.message}` };
      const { error: aErr } = await db.rpc("review_project_evidence", { p_id: data.id, p_approve: true });
      if (aErr) return { ok: false, saved, error: `Опубликовано: ${saved} из ${items.length}; ещё один материал ожидает проверки. ${aErr.message}` };
      saved++;
    }
    refresh(projectId);
    return { ok: true, saved };
  } catch (e) {
    return { ok: false, saved, error: `Подтверждённо опубликовано: ${saved}. ${msg(e)}` };
  } finally {
    if (saved) refresh(projectId);
  }
}

export async function adminStudioPhotoDecision(projectId: string, id: string, action: "approve" | "reject" | "remove"): Promise<Res> {
  try {
    const db = await admin();
    if (action === "remove") {
      const { error } = await db.from("project_evidence").update({ status: "archived" }).eq("id", id).eq("project_id", projectId).eq("kind", "photo").eq("status", "published");
      if (error) return { ok: false, error: error.message };
    } else {
      const {data: evidence} = await db.from("project_evidence").select("id").eq("id",id).eq("project_id",projectId).eq("kind","photo").eq("status","pending").maybeSingle();
      if (!evidence) return {ok:false,error:"Ожидающий проверки материал проекта не найден"};
      const { error } = await db.rpc("review_project_evidence", { p_id: id, p_approve: action === "approve" });
      if (error) return { ok: false, error: error.message };
    }
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ───────────────────────────── news and promotions ─────────────────────────────
export type NewsRow = { id: string; kind: string; title_ru: string; body_ru: string; published_at: string };
export type PromoRow = { id: string; kind: string; label_ru: string; starts_at: string | null; ends_at: string | null };

export async function adminStudioListNews(projectId: string): Promise<{ news: NewsRow[]; promos: PromoRow[] }> {
  const db = await admin();
  const [n, c] = await Promise.all([
    db.from("project_updates").select("id, kind, title_ru, title_en, body_ru, published_at").eq("project_id", projectId).order("published_at", { ascending: false }),
    db.from("sales_campaigns").select("id, kind, label_ru, label_en, starts_at, ends_at").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);
  requireAdminQuery(n, "Не удалось загрузить новости проекта");
  requireAdminQuery(c, "Не удалось загрузить акции проекта");
  return {
    news: (n.data ?? []).map((r) => ({ id: r.id, kind: r.kind, title_ru: r.title_ru || r.title_en, body_ru: r.body_ru, published_at: r.published_at })),
    promos: (c.data ?? []).map((r) => ({ id: r.id, kind: r.kind, label_ru: r.label_ru || r.label_en, starts_at: r.starts_at, ends_at: r.ends_at })),
  };
}

export async function adminStudioAddNews(projectId: string, _p: Res, fd: FormData): Promise<Res> {
  try {
    const db = await admin();
    const kind = String(fd.get("kind") ?? "news");
    const title = String(fd.get("title") ?? "").trim();
    const body = String(fd.get("body") ?? "").trim();
    if (!["news", "construction", "milestone"].includes(kind)) return { ok: false, error: "Некорректный тип" };
    if (title.length < 3) return { ok: false, error: "Укажите заголовок" };
    const date = String(fd.get("date") ?? "");
    const at = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T09:00:00Z`) : new Date();
    if (at.getTime() > Date.now() + 86_400_000) return { ok: false, error: "Дата не может быть в будущем" };
    const { error } = await db.from("project_updates").insert({
      project_id: projectId, kind, title_ru: title.slice(0, 200), title_en: title.slice(0, 200),
      body_ru: body.slice(0, 4000), body_en: body.slice(0, 4000), is_published: true, published_at: at.toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminStudioDeleteNews(projectId: string, id: string): Promise<Res> {
  try {
    const db = await admin();
    const { error } = await db.from("project_updates").delete().eq("id", id).eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminStudioAddPromo(projectId: string, _p: Res, fd: FormData): Promise<Res> {
  try {
    const db = await admin();
    const kind = String(fd.get("kind") ?? "sale");
    const label = String(fd.get("label") ?? "").trim();
    if (!["launch", "sale", "other"].includes(kind)) return { ok: false, error: "Некорректный тип" };
    if (label.length < 3) return { ok: false, error: "Опишите акцию, например: «Скидка 5% при бронировании до 30 ноября»" };
    const d = (k: string) => { const v = String(fd.get(k) ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`).toISOString() : null; };
    const starts = d("starts"), ends = d("ends");
    if (starts && ends && ends < starts) return { ok: false, error: "Окончание раньше начала" };
    const { error } = await db.from("sales_campaigns").insert({ project_id: projectId, kind, label_ru: label.slice(0, 200), label_en: label.slice(0, 200), starts_at: starts, ends_at: ends });
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminStudioDeletePromo(projectId: string, id: string): Promise<Res> {
  try {
    const db = await admin();
    const { error } = await db.from("sales_campaigns").delete().eq("id", id).eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    refresh(projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}


