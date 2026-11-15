import { CLEARVIEW_V22, type CvConfig } from "./config";
import { applies, type ItemState, type Stage } from "./engine";
import type { DomainCode, Gate } from "./registry";

export type Respondent = "developer" | "buyer";
export type Impact = "high" | "medium" | "low";
export interface PublicQuickResult {
  blocked: boolean;
  flags: { gate: Gate; text: string }[];
  unresolvedGates: { gate: Gate; text: string }[];
  domains: { code: DomainCode; ru: string; status: "risk_reported" | "needs_verification" | "not_assessed" }[];
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


/** A checklist of claims, never a rating. Missing answers and unknown answers are equivalent.
 * No registry defaults, simulated gate clearance or evidence-weighted scores reach this result.
 */
export function runQuick(
  answers: Record<string, string | undefined>,
  opts: { respondent: Respondent; stage: Stage },
  cfg: CvConfig = CLEARVIEW_V22,
): PublicQuickResult {
  const states = new Map<string, ItemState>();
  const gates: Partial<Record<Gate, "clear" | "triggered" | "unknown">> = {};
  const selected = new Map(cfg.quick.map(q => [q.id, q.options.find(o => o.id === answers[q.id])]));
  let answered = 0;
  for (const q of cfg.quick) {
    const option = selected.get(q.id);
    // Seed all asked items as unknown, including skipped questions.
    for (const o of q.options) for (const e of o.effects) if (!states.has(e.item)) states.set(e.item, "unknown");
    if (!option || option.id === "unknown") continue;
    answered++;
    for (const e of option.effects) states.set(e.item, e.state);
    Object.assign(gates, option.gates);
  }
  // Risk 2.1 is a conjunction, not two competing assignments. A known false operand
  // resolves it; otherwise either missing operand leaves it unknown.
  const escrow = selected.get("escrow")?.id;
  const frontload = selected.get("frontload")?.id;
  states.set("2.1", escrow === "escrow" || frontload === "low" ? "absent"
    : escrow === "developer" && frontload === "high" ? "present" : "unknown");
  // Same legal owner does not establish beneficial ownership or exclude nominees.
  if (answers.owner === "same") { delete gates.G1; states.set("3.6", "unknown"); }
  // A prelaunch answer is not evidence that a permit exists.
  if (answers.permit === "prelaunch") states.set("4.3", "unknown");
  const rental = selected.get("rental")?.id;
  const rentalThesis = rental?.startsWith("str") ? "str" : rental === "ltr" ? "ltr" : "none";
  const scope = { stage: opts.stage, rentalThesis } as const;
  const relevantGates = (Object.keys(cfg.gates) as Gate[]).filter(g => g !== "G10" || !rental || rental === "unknown" || rentalThesis === "str");
  const flags = relevantGates.filter(g => gates[g] === "triggered").map(gate => ({ gate, text: GATE_RU[gate] }));
  const unresolvedGates = relevantGates.filter(g => !gates[g] || gates[g] === "unknown").map(gate => ({ gate, text: GATE_RU[gate] }));
  const domains: PublicQuickResult["domains"] = cfg.domains.map(d => {
    const items = cfg.items.filter(i => i.domain === d.code && applies(i, scope));
    const reported = items.some(i => states.get(i.code) === "present" || states.get(i.code) === "partial");
    const asked = items.some(i => states.has(i.code));
    return { code: d.code, ru: d.ru, status: reported ? "risk_reported" : asked ? "needs_verification" : "not_assessed" };
  });
  const steps: PublicQuickResult["nextSteps"] = [];
  const gateItems = new Set<string>();
  for (const { gate } of [...flags, ...unresolvedGates]) {
    const item = cfg.items.find(i => i.gate === gate);
    if (!item) continue;
    gateItems.add(item.code);
    steps.push({ text: `${gates[gate] === "triggered" ? "Приоритетная проверка заявленного стоп-условия" : "Не проверено стоп-условие"}: ${GATE_RU[gate]}. ${ACTION_RU[item.code] ?? "Запросить независимое документальное подтверждение до сделки"}.`, impact: "high", domain: item.domain });
  }
  // Priority is triage urgency, not a promised improvement in a score. Hard stops
  // remain high priority even though a rejected assessment has no composite.
  for (const state of ["present", "partial", "unknown"] as const) {
    for (const [code, value] of states) {
      const item = cfg.items.find(i => i.code === code);
      if (value !== state || gateItems.has(code) || !item || !applies(item, scope)) continue;
      steps.push({ text: ACTION_RU[code] ?? `Запросить документы по вопросу: ${item.title}`, impact: state === "unknown" ? "medium" : "high", domain: item.domain });
    }
  }
  const total = cfg.quick.length;
  const share = total ? answered / total : 0;
  return {
    blocked: flags.length > 0, flags, unresolvedGates, domains, answered, total,
    coverage: share >= 0.85 ? "high" : share >= 0.55 ? "medium" : "low",
    nextSteps: steps,
    note: "Это предварительный список вопросов по вашим ответам, а не оценка ClearView или рекомендация покупать. Документы здесь не проверяются. Полнота ответов не означает полноту доказательств; отсутствие выявленного риска не означает безопасность проекта. Перед сделкой нужна независимая юридическая проверка.",
  };
}
