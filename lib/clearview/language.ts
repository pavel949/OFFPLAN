/**
 * "Legal-safe language" filter required by the methodology (Bible 6.5, Atlas 14.3): reports, club copy and any AI-generated
 * text must not promise returns or capital safety. Run on every generated report and on developer-supplied marketing text
 * that is shown next to a rating.
 */
export interface LanguageIssue { rule: string; match: string; index: number; suggest: string }

const RULES: { rule: string; re: RegExp; suggest: string }[] = [
  { rule: "guaranteed return", re: /guarantee[sd]?\s+(?:rental\s+)?(?:return|income|yield)s?|гарантирован\p{L}*\s+(?:доход|доходност|прибыл|возврат)\p{L}*/giu, suggest: "projected rental yield / developer-offered return programme / ожидаемая доходность по сценарию" },
  { rule: "capital protection", re: /capital\s+(?:protected|protection|guarantee[sd]?)|(?:защищ[её]н\p{L}*|гарантированн\p{L}*)\s+(?:капитал|вложени)\p{L}*|сохранност\p{L}*\s+(?:капитал|вложени)\p{L}*\s+гарант\p{L}*/giu, suggest: "avoid absolute safety claims" },
  { rule: "investment fund", re: /investment\s+fund|fund\s+interest|pooled\s+investment|collective\s+investment|инвестиционн\p{L}*\s+фонд|паев\p{L}*|коллективн\p{L}*\s+инвестиц\p{L}*/giu, suggest: "this is a property purchase, no capital is pooled" },
  { rule: "safe investment", re: /(?:safe|risk-free|zero[- ]risk)\s+investment|безопасн\p{L}*\s+инвестиц\p{L}*|инвестиц\p{L}*\s+без\s+риск\p{L}*|без\s+рисков/giu, suggest: "scenario-based analysis; name the residual risks" },
  { rule: "securities wording", re: /\b(?:securities|bonds?|debt\s+instrument)\b|ценн\p{L}*\s+бумаг\p{L}*|облигаци\p{L}*/giu, suggest: "do not describe a property purchase as a security" },
  { rule: "certain yield", re: /(?:yield|return|доходност\p{L}*)\s*(?:of|is|will\s+be|составит|будет|:)?\s*(?:exactly|ровно|гарантированно)\s*\d/giu, suggest: "present yield as a projection or scenario with its assumptions" },
];

export function lintLegalSafe(text: string): LanguageIssue[] {
  const out: LanguageIssue[] = [];
  for (const { rule, re, suggest } of RULES) {
    for (const m of text.matchAll(re)) out.push({ rule, match: m[0], index: m.index ?? 0, suggest });
  }
  return out.sort((a, b) => a.index - b.index);
}
