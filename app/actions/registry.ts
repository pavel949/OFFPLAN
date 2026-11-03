"use server";

import { revalidatePath } from "next/cache";
import { registryError } from "@/lib/registry/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export type RegState = { ok: boolean; error?: string; message?: string };

const MAX_FILE = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function userClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase не настроен" as const };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Войдите в систему" as const };
  return { supabase, user };
}

async function rpc(name: string, args: Record<string, unknown>, revalidate: string[] = []): Promise<RegState> {
  const u = await userClient();
  if ("error" in u) return { ok: false, error: u.error };
  const { error } = await u.supabase.rpc(name, args);
  if (error) return { ok: false, error: registryError(error.message) };
  for (const p of revalidate) revalidatePath(p);
  return { ok: true };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ------------------------------ developer ------------------------------
export async function startVerification(_p: RegState, fd: FormData): Promise<RegState> {
  const project = s(fd, "project_id");
  const level = Number(s(fd, "level"));
  if (!project || ![1, 2].includes(level)) return { ok: false, error: "Некорректные данные" };
  return rpc("start_verification_case", { p_project: project, p_level: level }, [`/partner/projects/${project}/verification`]);
}

export async function uploadEvidence(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  const item = s(fd, "item_key");
  const file = fd.get("file");
  if (!caseId || !item || !(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_FILE) return { ok: false, error: "Файл больше 15 МБ" };
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: "Допустимы PDF, JPG, PNG, WebP, DOCX" };
  if (!hasSupabaseServiceConfig()) return { ok: false, error: "Хранилище не настроено" };

  const u = await userClient();
  if ("error" in u) return { ok: false, error: u.error };
  // RLS: only the owner organisation can see its case => ownership check
  const { data: c } = await u.supabase.from("verification_cases").select("id, project_id, status").eq("id", caseId).maybeSingle();
  if (!c) return { ok: false, error: "Заявка не найдена" };
  if (!["draft", "changes_requested"].includes(c.status as string)) return { ok: false, error: "Заявка уже подана" };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${caseId}/${item}/${Date.now()}_${safe}`;
  const admin = createServiceRoleClient();
  const { error: upErr } = await admin.storage
    .from("verification-docs")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await u.supabase.rpc("attach_verification_evidence", {
    p_case: caseId,
    p_item: item,
    p_path: path,
    p_filename: file.name.slice(0, 200),
    p_size: file.size,
  });
  if (error) {
    await admin.storage.from("verification-docs").remove([path]);
    return { ok: false, error: registryError(error.message) };
  }
  revalidatePath(`/partner/projects/${c.project_id}/verification`);
  return { ok: true, message: "Файл загружен" };
}

export async function submitVerification(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  const project = s(fd, "project_id");
  return rpc("submit_verification_case", { p_case: caseId }, [`/partner/projects/${project}/verification`, "/registry/review"]);
}

export async function postMessage(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  const body = s(fd, "body");
  if (!body) return { ok: false, error: "Введите текст" };
  const r = await rpc("post_verification_message", { p_case: caseId, p_body: body.slice(0, 4000) });
  if (r.ok) {
    revalidatePath(`/registry/review/${caseId}`);
    const project = s(fd, "project_id");
    if (project) revalidatePath(`/partner/projects/${project}/verification`);
  }
  return r;
}

// ------------------------------ reviewer ------------------------------
export async function claimCase(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  return rpc("claim_verification_case", { p_case: caseId }, ["/registry/review", `/registry/review/${caseId}`]);
}

export async function recuseCase(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  return rpc("recuse_from_case", { p_case: caseId, p_reason: s(fd, "reason") }, ["/registry/review", `/registry/review/${caseId}`]);
}

export async function reviewItem(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  return rpc(
    "review_verification_item",
    { p_case: caseId, p_item: s(fd, "item_key"), p_status: s(fd, "status"), p_note: s(fd, "note") },
    [`/registry/review/${caseId}`],
  );
}

export async function requestChanges(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  return rpc("request_verification_changes", { p_case: caseId, p_summary: s(fd, "summary") }, ["/registry/review", `/registry/review/${caseId}`, "/registry"]);
}

export async function decideCase(_p: RegState, fd: FormData): Promise<RegState> {
  const caseId = s(fd, "case_id");
  const decision = s(fd, "decision");
  const r = await rpc(
    "decide_verification",
    { p_case: caseId, p_decision: decision, p_public_summary: s(fd, "summary") },
    ["/registry/review", `/registry/review/${caseId}`, "/registry", "/"],
  );
  return r;
}

export async function revokeVerification(_p: RegState, fd: FormData): Promise<RegState> {
  return rpc("revoke_verification", { p_project: s(fd, "project_id"), p_reason: s(fd, "reason") }, ["/registry", "/registry/review", "/"]);
}

/** Short-lived signed URL for an evidence file; only reviewers may call it. */
export async function evidenceUrl(caseId: string, path: string): Promise<{ url?: string; error?: string }> {
  const u = await userClient();
  if ("error" in u) return { error: u.error };
  const { data: prof } = await u.supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (prof?.role !== "reviewer") return { error: "Недостаточно прав" };
  if (!path.startsWith(`${caseId}/`)) return { error: "Недопустимый путь" };
  if (!hasSupabaseServiceConfig()) return { error: "Хранилище не настроено" };
  const { data, error } = await createServiceRoleClient().storage.from("verification-docs").createSignedUrl(path, 300);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
