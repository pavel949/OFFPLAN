import type { CvConfig } from "./config";
import { fromState, type AssessmentInput, type EvidenceClass, type ItemState } from "./engine";
import type { Gate } from "./registry";

/**
 * Synthetic reference projects used by the methodology studio: any change to the rules is shown against them before it is
 * submitted. They are NOT real projects. Replace/extend with real benchmarked projects (known outcomes) once collected.
 */
export interface Benchmark {
  id: string;
  ru: string;
  note: string;
  build: (cfg: CvConfig) => AssessmentInput;
}

const GATES: Gate[] = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"];
const clearGates = (extra: Partial<Record<Gate, "clear" | "triggered" | "unknown">> = {}) => ({
  ...Object.fromEntries(GATES.map((g) => [g, "clear"])),
  ...extra,
}) as Record<Gate, "clear" | "triggered" | "unknown">;

function uniform(cfg: CvConfig, state: ItemState, ev: EvidenceClass, base: Partial<AssessmentInput> = {}): AssessmentInput {
  const items: AssessmentInput["items"] = {};
  for (const it of cfg.items) items[it.code] = fromState(it, state, ev, "none", cfg);
  return { scope: { stage: "early" }, items, gates: clearGates(), ...base };
}
function patch(cfg: CvConfig, input: AssessmentInput, changes: Record<string, [ItemState, EvidenceClass]>): AssessmentInput {
  const items = { ...input.items };
  for (const [code, [state, ev]] of Object.entries(changes)) {
    const it = cfg.items.find((i) => i.code === code);
    if (it) items[code] = fromState(it, state, ev, "none", cfg);
  }
  return { ...input, items };
}

export const BENCHMARKS: Benchmark[] = [
  {
    id: "verified_clean",
    ru: "Эталон: всё подтверждено реестрами",
    note: "Верхняя граница шкалы: ни одного риска, всё документально доказано.",
    build: (c) => uniform(c, "absent", "registry", { facts: { platinum: { eiaConfirmed: true, permitConfirmed: true, quotaUsedPct: 10, escrowActive: true, noCourtAction: true, noFloodRisk: true } } }),
  },
  { id: "claimed_clean", ru: "Чисто, но только со слов застройщика", note: "Проверяет, что заявление не равно доказательству.", build: (c) => uniform(c, "absent", "developer") },
  {
    id: "typical_mid",
    ru: "Типичный: титул подтверждён, эскроу нет, отчётности нет",
    note: "Середина рынка: юридическая часть чистая, финансовая и договорная слабые.",
    build: (c) =>
      patch(c, uniform(c, "unknown", "missing", { scope: { stage: "mid" } }), {
        "3.1": ["absent", "registry"], "3.2": ["absent", "registry"], "3.3": ["absent", "contract"], "3.5": ["absent", "registry"],
        "4.2": ["absent", "registry"], "4.3": ["absent", "registry"], "5.1": ["present", "contract"], "2.1": ["present", "contract"],
        "1.3": ["present", "developer"], "2.2": ["present", "developer"], "2.5": ["absent", "contract"], "1.1": ["absent", "registry"],
      }),
  },
  { id: "opaque", ru: "Ничего не раскрыто", note: "Проект без документов: непрозрачность должна стоить дорого.", build: (c) => uniform(c, "unknown", "missing") },
  {
    id: "risky",
    ru: "Рискованный: авансы без эскроу, стройка стоит",
    note: "Подтверждённые финансовые риски и остановка стройки.",
    build: (c) => {
      const x = patch(c, uniform(c, "absent", "registry", { scope: { stage: "mid" } }), {
        "5.1": ["present", "contract"], "2.1": ["present", "contract"], "1.3": ["present", "registry"], "1.1": ["present", "registry"],
        "2.2": ["present", "developer"], "4.1": ["present", "independent_report"], "4.5": ["present", "contract"],
      });
      return { ...x, facts: { d4Halt90: true } };
    },
  },
  {
    id: "gate_sorkor1",
    ru: "Стоп-условие: титул Sor Kor 1",
    note: "Любое сработавшее стоп-условие должно давать отказ независимо от остального.",
    build: (c) => patch(c, uniform(c, "absent", "registry", { gates: clearGates({ G2: "triggered" }) }), { "3.1": ["present", "registry"] }),
  },
  {
    id: "branded_pool",
    ru: "Брендированная резиденция с пулом аренды",
    note: "Проверяет модуль D9 и поправки на бренд.",
    build: (c) =>
      patch(c, uniform(c, "absent", "contract", { scope: { stage: "late", isBranded: true, rentalThesis: "str", kinds: ["branded"] }, gates: { ...clearGates(), G10: "clear" } }), {
        "9.10": ["present", "contract"], "9.11": ["partial", "contract"], "9.4": ["partial", "contract"],
      }),
  },
  {
    id: "prelaunch",
    ru: "Предстарт без стройки",
    note: "Ранний проект: основная нагрузка на финансирование и право.",
    build: (c) => patch(c, uniform(c, "unknown", "missing", { scope: { stage: "prelaunch" } }), { "3.1": ["absent", "registry"], "3.2": ["absent", "registry"], "4.8": ["partial", "developer"], "2.1": ["absent", "contract"], "5.1": ["absent", "contract"] }),
  },
];
