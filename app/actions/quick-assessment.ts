"use server";

import { headers } from "next/headers";
import { getActiveConfig } from "@/lib/clearview/active";
import { runQuick, type PublicQuickResult, type Respondent } from "@/lib/clearview/quick";
import type { Stage } from "@/lib/clearview/engine";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const STAGES: Stage[] = ["prelaunch", "early", "mid", "late", "completed"];

/** Runs on the server so the configuration never reaches the browser; returns the public-safe result only. */
export async function runQuickAssessment(input: { respondent: Respondent; stage: Stage; answers: Record<string, string> }): Promise<{ ok: true; result: PublicQuickResult } | { ok: false; error: string }> {
  const ip = clientIp(await headers());
  if (!rateLimit(`quick:ip:${ip}`, 40, 10 * 60 * 1000).ok) return { ok: false, error: "Слишком много запросов. Подождите несколько минут." };
  if (!["developer", "buyer"].includes(input.respondent) || !STAGES.includes(input.stage)) return { ok: false, error: "Некорректные параметры." };
  const cfg = await getActiveConfig();
  const answers: Record<string, string> = {};
  for (const q of cfg.quick) {
    const a = input.answers?.[q.id];
    if (typeof a === "string" && q.options.some((o) => o.id === a)) answers[q.id] = a;
  }
  return { ok: true, result: runQuick(answers, { respondent: input.respondent, stage: input.stage }, cfg) };
}

/** Question texts for the wizard (labels only: no effects, mappings or parameters are sent to the browser). */
export async function getQuickQuestions(): Promise<{ id: string; text: string; help?: string; options: { id: string; label: string }[] }[]> {
  return (await getActiveConfig()).quick.map((q) => ({ id: q.id, text: q.text, help: q.help, options: q.options.map((o) => ({ id: o.id, label: o.label })) }));
}
