import type { ProjectEvidence } from "./project-evidence";
import { normalizeSourceUrl, type PublicSource, type SourceKind } from "./sources";

export type AssessmentCopy = { ru: string; en: string };
export type BasicAssessmentInput = {
  projectId: string | null;
  facts: ProjectEvidence[];
  sources: PublicSource[];
  error: boolean;
  now?: number;
};
const copy = (ru: string, en: string): AssessmentCopy => ({ ru, en });
const TOPICS: { id: string; title: AssessmentCopy; question: AssessmentCopy; why: AssessmentCopy; kinds: SourceKind[] }[] = [
  { id: "land", title: copy("Земля и право продажи", "Land and seller rights"), question: copy("Предоставьте актуальный титул, выписку об обременениях и документ о праве продавца распоряжаться землёй. Как оформляется право покупателя?", "Provide the current title, encumbrance search and evidence of the seller’s rights to the land. How will the buyer’s ownership or lease be registered?"), why: copy("Без этих документов нельзя подтвердить возможность передачи права покупателю.", "These documents are needed to establish whether the buyer can receive the intended legal rights."), kinds: ["legal_docs", "data_room"] },
  { id: "permits", title: copy("Разрешения и стройка", "Permits and construction"), question: copy("Предоставьте разрешение на строительство, решение по EIA или основание неприменимости, а также датированный отчёт о ходе работ.", "Provide the building permit, EIA approval or documented exemption, and a dated construction progress report."), why: copy("Описание стадии строительства не подтверждает разрешения или фактическую готовность.", "A construction-stage label does not establish permits or actual completion."), kinds: ["legal_docs", "data_room"] },
  { id: "contract", title: copy("Договор и платежи", "Contract and payments"), question: copy("Предоставьте проект договора и график платежей: как защищены деньги, что происходит при задержке и когда возможен возврат?", "Provide the draft sale agreement and payment schedule: how are funds protected, what happens after delays, and when can the buyer obtain a refund?"), why: copy("Брошюра и обещания продавца не заменяют условия договора.", "Brochures and sales promises do not replace contractual protections."), kinds: ["legal_docs", "data_room"] },
  { id: "price", title: copy("Цена и наличие", "Price and availability"), question: copy("Подтвердите выбранный лот, полную цену, срок действия предложения и обязательные платежи на дату бронирования.", "Confirm the selected unit, total price, offer validity and mandatory charges on the reservation date."), why: copy("Прайс или ссылка на остатки могут устареть; они не подтверждают текущую доступность лота.", "Price lists and inventory links can expire; a link alone does not establish current unit availability."), kinds: ["price_list", "availability"] },
  { id: "costs", title: copy("Расходы после покупки", "Ownership costs"), question: copy("Предоставьте тариф обслуживания, взнос в резервный фонд, условия управления и перечень обязательных расходов.", "Provide the maintenance fee, sinking-fund contribution, management terms and all mandatory ownership charges."), why: copy("Без полного перечня нельзя определить реальные расходы после покупки.", "Total ownership costs cannot be established without the complete schedule of charges."), kinds: ["legal_docs", "data_room", "brochure"] },
];

/** Source presence is not document verification. The current evidence schema records
 * published facts and review dates, not legal-document conclusions or an independent report.
 * Do not infer those conclusions from marketing payloads, verification badges or payment.
 */
export function basicProjectAssessment(input: BasicAssessmentInput) {
  const now = input.now ?? Date.now();
  const validDate = (v: string | null) => !!v && Number.isFinite(Date.parse(v)) && Date.parse(v) <= now;
  const facts = input.projectId ? input.facts.filter(f => f.project_id === input.projectId && f.status === "published" && normalizeSourceUrl(f.source_url)) : [];
  const sources = input.projectId ? input.sources.filter(s => s.project_id === input.projectId && normalizeSourceUrl(s.url)) : [];
  const reviewedFacts = facts.filter(f => validDate(f.observed_at) && validDate(f.reviewed_at) && Date.parse(f.reviewed_at!) >= Date.parse(f.observed_at));
  const unreviewedFacts = facts.filter(f => !reviewedFacts.includes(f));
  const topics = TOPICS.map(t => ({ ...t, sources: sources.filter(s => t.kinds.includes(s.kind)), status: "review_not_established" as const }));
  return {
    status: input.error ? "unavailable" as const : reviewedFacts.length ? "review_records_available" as const : facts.length || sources.length ? "sources_only" as const : "no_evidence" as const,
    reviewedFacts, unreviewedFacts, topics,
    // Deliberately no aggregate grade, investment recommendation or percentage.
    conclusion: copy("Проверка не завершена. Публичных данных недостаточно для вывода о юридической и финансовой надёжности проекта.", "Review is incomplete. Public information is insufficient to conclude that the project is legally or financially sound."),
  };
}
