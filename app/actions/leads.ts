"use server";

import { headers } from "next/headers";
import { verifyCaptcha } from "@/lib/captcha";
import { CONSENT_VERSION } from "@/lib/legal";
import { serverRateLimit } from "@/lib/server-rate-limit";
import { clientIp } from "@/lib/rate-limit";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { leadSubmitSchema } from "@/lib/leads/schema";
import {
  appendLeadUnified,
  getLeadUnified,
  listLeadsUnified,
  updateLeadUnified,
} from "@/lib/leads/unified";
import type { LeadRecord, LeadStatus } from "@/lib/leads/types";

async function assertAdmin(): Promise<boolean> {
  return getAdminSessionOk();
}

export type SubmitLeadState = { ok: boolean; error?: string };

const ERR = {
  ru: {
    unavailable: "Приём заявок временно недоступен. Повторите попытку позже.",
    tooMany: "Слишком много запросов. Пожалуйста, повторите попытку позже.",
    captcha: "Не удалось пройти проверку на робота. Попробуйте ещё раз.",
    invalid: "Проверьте заполнение формы и отметьте согласие на обработку данных.",
    save: "Не удалось сохранить заявку. Повторите попытку или напишите нам напрямую.",
  },
  en: {
    unavailable: "Requests are temporarily unavailable. Please try again later.",
    tooMany: "Too many requests. Please try again later.",
    captcha: "Captcha verification failed. Please retry.",
    invalid: "Please check the form fields and tick the consent box.",
    save: "Could not save your request. Please try again or email us directly.",
  },
} as const;

function parseUtmJson(raw: string | null): Record<string, string> | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function submitLead(
  _prev: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  if (String(formData.get("_hp") ?? "").trim() !== "") {
    return { ok: true };
  }
  const loc = formData.get("locale") === "en" ? "en" : "ru";
  const E = ERR[loc];
  const ip = clientIp(await headers());
  const ipLimit = await serverRateLimit(`lead:ip:${ip}`, 5, 10 * 60 * 1000);
  if (!ipLimit.ok) return { ok: false, error: ipLimit.unavailable ? E.unavailable : E.tooMany };
  const captchaOk = await verifyCaptcha(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
  );
  if (!captchaOk) {
    return { ok: false, error: E.captcha };
  }
  const pidRaw = formData.get("projectId");
  let projectId: number | null = null;
  if (typeof pidRaw === "string" && pidRaw.trim() !== "") {
    const n = Number(pidRaw);
    if (Number.isFinite(n)) projectId = n;
  }
  const pn = String(formData.get("projectName") ?? "").trim();
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
    projectId,
    projectName: pn === "" ? null : pn,
    locale: formData.get("locale"),
    consent: formData.get("consent") === "on" ? true : undefined,
  };
  const parsed = leadSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error.flatten().fieldErrors;
    const first =
      Object.values(err).flat()[0] || parsed.error.issues[0]?.message;
    // Field messages are Russian; English visitors get the generic English message.
    return { ok: false, error: loc === "ru" && first ? first : E.invalid };
  }
  const emailLimit = await serverRateLimit(`lead:email:${parsed.data.email.toLowerCase()}`, 3, 60 * 60 * 1000);
  if (!emailLimit.ok) return { ok: false, error: emailLimit.unavailable ? E.unavailable : E.tooMany };
  const utm = parseUtmJson(String(formData.get("utm_json") ?? ""));
  try {
    await appendLeadUnified({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? "",
      message: parsed.data.message ?? "",
      projectId: parsed.data.projectId ?? null,
      projectName: parsed.data.projectName ?? null,
      locale: parsed.data.locale,
      utm,
      consentVersion: CONSENT_VERSION,
    });
  } catch {
    // Details are logged server-side; never leak internals to the visitor.
    return {
      ok: false,
      error: E.save,
    };
  }
  return { ok: true };
}

export async function adminListLeads(): Promise<LeadRecord[]> {
  if (!(await assertAdmin())) return [];
  return listLeadsUnified();
}

export async function adminGetLead(id: string): Promise<LeadRecord | null> {
  if (!(await assertAdmin())) return null;
  return (await getLeadUnified(id)) ?? null;
}

export async function adminUpdateLead(
  id: string,
  patch: { status?: LeadStatus; notes?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  let next;
  try { next = await updateLeadUnified(id, patch); }
  catch { return { ok: false, error: "Не удалось сохранить изменения. Повторите попытку." }; }
  if (!next) return { ok: false, error: "Лид не найден" };
  return { ok: true };
}

export async function updateLeadFromForm(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await assertAdmin())) {
    return { ok: false, error: "Нет доступа" };
  }
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  const notes = String(formData.get("notes") ?? "");
  const allowed: LeadStatus[] = [
    "new",
    "contacted",
    "qualified",
    "closed",
    "lost",
  ];
  if (!allowed.includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }
  let next;
  try { next = await updateLeadUnified(id, { status, notes }); }
  catch { return { ok: false, error: "Не удалось сохранить изменения. Повторите попытку." }; }
  if (!next) return { ok: false, error: "Лид не найден" };
  return { ok: true };
}