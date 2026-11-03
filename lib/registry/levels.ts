export type VerificationLevel = 0 | 1 | 2;

export interface VerificationInfo {
  level: VerificationLevel;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export const LEVEL_TEXT: Record<VerificationLevel, { ru: string; en: string; ruShort: string; enShort: string; ruHint: string; enHint: string }> = {
  0: {
    ru: "Данные заявлены застройщиком",
    en: "Declared by the developer",
    ruShort: "L0 · заявлено",
    enShort: "L0 · declared",
    ruHint: "Информация предоставлена застройщиком и не проверялась реестром.",
    enHint: "Information supplied by the developer; not checked by the registry.",
  },
  1: {
    ru: "Документы проверены",
    en: "Documents verified",
    ruShort: "L1 · документы",
    enShort: "L1 · documents",
    ruHint: "Реестр проверил комплект документов застройщика и проекта по чек-листу.",
    enHint: "The registry checked the developer and project documents against the checklist.",
  },
  2: {
    ru: "Независимая юридическая проверка",
    en: "Independent legal verification",
    ruShort: "L2 · независимая проверка",
    enShort: "L2 · independent",
    ruHint: "Есть независимое юридическое заключение, проверка титула и отчёт о выезде на объект.",
    enHint: "Independent legal opinion, title search and a site inspection report are on file.",
  },
};

/** Effective level: an expired verification counts as 0. Computed at read time (no cron needed). */
export function effectiveLevel(v: VerificationInfo | null | undefined, now = Date.now()): VerificationLevel {
  if (!v || v.level === 0) return 0;
  if (!v.expiresAt) return 0;
  const t = Date.parse(v.expiresAt);
  if (Number.isNaN(t) || t <= now) return 0;
  return v.level;
}

export function levelLabel(level: VerificationLevel, lang: "ru" | "en", short = false): string {
  const t = LEVEL_TEXT[level];
  return lang === "ru" ? (short ? t.ruShort : t.ru) : short ? t.enShort : t.en;
}
