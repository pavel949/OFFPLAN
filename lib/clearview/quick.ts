import { CLEARVIEW_V22, type CvConfig, type QuickQuestion, type Tier } from "./config";
import {
  TIER_ORDER, assess, fromState, type AssessmentInput, type ItemInput, type Stage,
} from "./engine";
import type { DomainCode, Gate } from "./registry";

/**
 * Public quick self-check. It runs on the server; the client only ever receives `PublicQuickResult`, which
 * deliberately contains no composite score, no weights and no per-item numbers: with those, anyone could tune answers
 * (or evidence) to a target instead of fixing the underlying risk.
 */
export type Respondent = "developer" | "buyer";
export type Level = 1 | 2 | 3 | 4 | 5;
export type Impact = "high" | "medium" | "low";

export interface PublicQuickResult {
  /** Lowest and highest tier consistent with the unanswered questions. */
  tierRange: { low: Tier; high: Tier };
  /** True when a hard-fail condition was answered "yes": the tier is REJECT regardless of anything else. */
  blocked: boolean;
  flags: { gate: Gate; text: string }[];
  domains: { code: DomainCode; ru: string; level: Level }[];
  answered: number;
  total: number;
  coverage: "low" | "medium" | "high";
  nextSteps: { text: string; impact: Impact; domain: DomainCode }[];
  note: string;
}

export const GATE_RU: Record<Gate, string> = {
  G1: "Скрытая структура владения через подставных лиц",
  G2: "Титул Sor Kor 1: иностранец не может получить собственность",
  G3: "Участок в охраняемой или береговой зоне",
  G4: "Нужна экологическая оценка (EIA), а её нет или она отозвана",
  G5: "Идёт стройка без разрешения на строительство",
  G6: "Квота иностранцев на собственность исчерпана (49%)",
  G7: "Ипотека или обременение мешает передаче титула",
  G8: "Продавец не управляет землёй проекта",
  G9: "Заявлена стройка, но подтверждений на площадке нет",
  G10: "Посуточная аренда без отельной лицензии: доход под вопросом",
};

/** What to do about an item, in plain Russian. Items without an entry fall back to a generic step. */
export const ACTION_RU: Record<string, string> = {
  "3.1": "Получить выписку о типе титула в Земельном департаменте",
  "3.7": "Уточнить класс титула и возможность его повышения до Chanote",
  "3.2": "Заказать выписку об обременениях на землю",
  "3.4": "Подтвердить, что продавец владеет землёй или имеет обязывающее право на неё",
  "3.6": "Раскрыть конечных владельцев земли и компании-застройщика",
  "3.3": "Запросить письмо о квоте иностранцев у юридического лица кондоминиума",
  "3.8": "Отслеживать долю иностранной квоты до сделки",
  "4.3": "Получить копию разрешения на строительство и сверить число лотов",
  "4.2": "Получить решение по EIA в ONEP или подтверждение, что оно не требуется",
  "2.1": "Согласовать эскроу или банковскую гарантию на платежи покупателей",
  "5.1": "Перенести платежи на эскроу-счёт или под банковскую гарантию",
  "1.1": "Показать сданные проекты группы и подтверждения сроков",
  "1.3": "Предоставить аудированную отчётность лицензированного аудитора",
  "2.2": "Получить письмо банка о строительном финансировании",
  "2.3": "Подтвердить выборку по строительному кредиту",
  "1.6": "Назвать банк, финансирующий стройку",
  "4.1": "Подтвердить движение на стройке датированными фото или отчётом инженера",
  "4.8": "Показать подготовку площадки или эскроу до старта",
  "2.5": "Добавить в договор неустойку за просрочку сдачи",
  "5.3": "Добавить право расторжения при просрочке сдачи больше 6 месяцев",
  "6.4": "Получить отельную лицензию или перейти на аренду от 30 дней",
};

const levelOf = (score: number): Level => (score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1);

export function impactOf(delta: number): Impact {
  return delta >= 2.5 ? "high" : delta >= 0.8 ? "medium" : "low";
}

type Answers = Record<string, string | undefined>;

function build(questions: QuickQuestion[], answers: Answers, respondent: Respondent, stage: Stage, cfg: CvConfig) {
  const ev = respondent === "developer" ? "developer" : "analyst";
  const items: Record<string, ItemInput> = {};
  const gates: Partial<Record<Gate, "clear" | "triggered" | "unknown">> = {};
  const facts: AssessmentInput["facts"] = {};
  let rental: "none" | "str" | "ltr" = "none";
  let answered = 0;
  const unjudged: string[] = [];
  const present: string[] = [];
  for (const qn of questions) {
    const opt = qn.options.find((o) => o.id === answers[qn.id]);
    if (!opt) continue;
    answered++;
    if (qn.id === "rental") rental = opt.id === "ltr" ? "ltr" : opt.id.startsWith("str") ? "str" : "none";
    for (const e of opt.effects) {
      const item = cfg.items.find((i) => i.code === e.item);
      if (!item) continue;
      items[e.item] = fromState(item, e.state, ev, "none", cfg);
      if (e.state === "unknown") unjudged.push(e.item);
      if (e.state === "present" || e.state === "partial") present.push(e.item);
    }
    for (const [g, v] of Object.entries(opt.gates ?? {})) gates[g as Gate] = v;
    if (opt.facts?.d4Halt90) facts.d4Halt90 = true;
  }
  return { items, gates, facts, scope: { stage, rentalThesis: rental }, answered, unjudged, present };
}

/** The pessimistic and optimistic completion of unanswered items, used to turn gaps into a tier range. */
function bound(base: ReturnType<typeof build>, mode: "best" | "worst", cfg: CvConfig, respondent: Respondent): AssessmentInput {
  const ev = respondent === "developer" ? "developer" : "analyst";
  const items = { ...base.items };
  const gates = { ...base.gates };
  // Only items the wizard can ask about are bracketed; the rest stay neutral (a short self-check cannot speak for them).
  const asked = new Set(cfg.quick.flatMap((q) => q.options.flatMap((o) => o.effects.map((e) => e.item))));
  for (const it of cfg.items) {
    if (items[it.code]?.judged || !asked.has(it.code)) continue;
    items[it.code] = fromState(it, mode === "best" ? "absent" : "present", ev, "none", cfg);
  }
  for (const g of Object.keys(cfg.gates) as Gate[]) if (!gates[g] || gates[g] === "unknown") gates[g] = "clear";
  return { scope: base.scope, items, gates, facts: base.facts, options: { gateUnknown: "incomplete" } };
}

export function runQuick(
  answers: Answers,
  opts: { respondent: Respondent; stage: Stage },
  cfg: CvConfig = CLEARVIEW_V22,
): PublicQuickResult {
  const questions = cfg.quick;
  const base = build(questions, answers, opts.respondent, opts.stage, cfg);

  const triggered = (Object.entries(base.gates) as [Gate, string][]).filter(([, v]) => v === "triggered").map(([g]) => g);
  const flags = triggered.map((g) => ({ gate: g, text: GATE_RU[g] }));
  const blocked = triggered.length > 0;

  const best = assess(bound(base, "best", cfg, opts.respondent), cfg);
  const worst = assess(bound(base, "worst", cfg, opts.respondent), cfg);
  let high: Tier = (best.tier ?? "CAUTION") as Tier;
  let low: Tier = (worst.tier ?? "CAUTION") as Tier;
  if (blocked) { high = "REJECT"; low = "REJECT"; }
  if (TIER_ORDER.indexOf(low) > TIER_ORDER.indexOf(high)) low = high;
  // A self-check built on claims can never reach the top: that needs verification by registries and third parties.
  const claimCap: Tier = "SILVER";
  if (TIER_ORDER.indexOf(high) > TIER_ORDER.indexOf(claimCap)) high = claimCap;
  if (TIER_ORDER.indexOf(low) > TIER_ORDER.indexOf(high)) low = high;

  // Domain levels from the neutral case: unanswered items keep their registry defaults.
  const expected = assess(
    { scope: base.scope, items: base.items, gates: Object.fromEntries((Object.keys(cfg.gates) as Gate[]).map((g) => [g, base.gates[g] === "triggered" ? "triggered" : "clear"])), facts: base.facts },
    cfg,
  );
  const domains = cfg.domains.map((d) => ({ code: d.code, ru: d.ru, level: levelOf(expected.domainScores[d.code]) }));

  // Next steps: what verifying each open or risky item would be worth, as a class only.
  const current = assess(bound(base, "worst", cfg, opts.respondent), cfg);
  const steps: { text: string; impact: Impact; domain: DomainCode; rank: number }[] = [];
  const candidates = new Set([...base.unjudged, ...base.present]);
  for (const code of candidates) {
    const item = cfg.items.find((i) => i.code === code);
    if (!item) continue;
    const verified = { ...bound(base, "worst", cfg, opts.respondent) };
    verified.items = { ...verified.items, [code]: fromState(item, "absent", "registry", "none", cfg) };
    const after = assess(verified, cfg);
    const delta = (after.composite ?? 0) - (current.composite ?? 0);
    steps.push({ text: ACTION_RU[code] ?? `Подтвердить документом: ${item.title}`, impact: impactOf(delta), domain: item.domain, rank: delta });
  }
  steps.sort((a, b) => b.rank - a.rank);
  let nextSteps: PublicQuickResult["nextSteps"] = steps.slice(0, 5).map(({ rank, ...rest }) => { void rank; return rest; });
  if (!blocked && TIER_ORDER.indexOf(high) >= TIER_ORDER.indexOf("SILVER")) {
    nextSteps = [
      { text: "Подтвердить заявленное документами из реестров и письмами банка и юридического лица кондо: самооценка по словам не поднимается выше «Серебра»", impact: "high" as const, domain: "D3" as DomainCode },
      ...nextSteps,
    ].slice(0, 5);
  }

  const total = questions.length;
  const share = base.answered / total;
  return {
    tierRange: { low, high },
    blocked,
    flags,
    domains,
    answered: base.answered,
    total,
    coverage: share >= 0.85 ? "high" : share >= 0.55 ? "medium" : "low",
    nextSteps,
    note: "Это предварительная самооценка по вашим ответам. Она не является оценкой ClearView и не заменяет проверку документов и юридическую консультацию.",
  };
}


