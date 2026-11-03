import { MILESTONE_RU, type CommissionTerms } from "./terms";

export const KIND_RU: Record<string, string> = {
  commission: "Комиссия застройщика",
  platform_fee: "Комиссия платформы",
  referral_fee: "Реферальное вознаграждение",
  payout: "Выплата брокеру",
  adjustment: "Корректировка",
  clawback: "Возврат",
};

export const DEAL_STATUS_RU: Record<string, string> = {
  open: "Открыта",
  reserved: "Бронь",
  contract_signed: "Договор подписан",
  won: "Завершена",
  lost: "Потеряна",
  cancelled: "Отменена",
};

export const ENTRY_STATUS_RU: Record<string, string> = {
  expected: "ожидается",
  due: "к оплате",
  paid: "оплачено",
  void: "аннулировано",
};

export function fmtMoney(n: number | string | null | undefined, currency?: string | null): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v)}${currency ? ` ${currency}` : ""}`;
}

/** Human-readable one-line summary of agreement terms (Russian). */
export function summarizeTerms(t: Partial<CommissionTerms> | null | undefined): string {
  if (!t || !t.model) return "—";
  const base =
    t.model === "percent"
      ? `${t.percent}% от цены`
      : t.model === "fixed"
        ? `фикс. ${fmtMoney(t.fixed, t.currency)}`
        : `ступенчато (${t.tiers?.length ?? 0} ст., ${t.tierMode === "bracket" ? "по диапазону" : "по частям"})`;
  const sched = (t.schedule ?? [])
    .map((s) => `${MILESTONE_RU[s.event].split(" ")[0].toLowerCase()} ${s.percent}%${s.delayDays ? ` (+${s.delayDays} дн.)` : ""}`)
    .join(" / ");
  const bounds = [t.min != null ? `мин. ${fmtMoney(t.min, t.currency)}` : "", t.max != null ? `макс. ${fmtMoney(t.max, t.currency)}` : ""].filter(Boolean).join(", ");
  return [base, bounds, sched, t.payoutMode === "via_platform" ? "через платформу" : "напрямую"].filter(Boolean).join(" · ");
}
