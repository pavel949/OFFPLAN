import { salesModelSchema, type SalesModel } from "./sales-model";

export const PRIVATE_SALES_SOURCE = "Источник хранится у команды IE";
const evidenceSections = ["units", "offers", "licenses", "fees", "paymentPlans"] as const;

/** Partner access is project-scoped, but operator source URLs/notes are not shared. */
export function partnerSalesView(model: SalesModel): SalesModel {
  const copy = structuredClone(model);
  for (const section of evidenceSections) for (const row of copy[section]) {
    row.source = row.source ? PRIVATE_SALES_SOURCE : "";
    row.checkedOn = "";
    row.verification = row.source && row.sourceDate ? "documented" : "unknown";
    if ("notes" in row) row.notes = "";
    if ("depositPayee" in row) { row.depositPayee = ""; row.paymentMethod = ""; }
  }
  return copy;
}

/** Restore private evidence only for unchanged rows; changed facts require new evidence. */
export function preparePartnerSales(input: unknown, previous: SalesModel): SalesModel {
  const next = salesModelSchema.parse(input);
  if (next.areaUnit !== previous.areaUnit && (previous.units.length || previous.fees.some(f => f.basis.startsWith("per_")))) {
    throw new Error("Нельзя менять единицу площади заполненной модели без пересчёта. Обратитесь к команде IE.");
  }
  const visible = partnerSalesView(previous);
  for (const section of evidenceSections) {
    const rows = next[section].map(row => {
      const before = visible[section].find(r => r.id === row.id);
      const original = previous[section].find(r => r.id === row.id);
      if (before && original && JSON.stringify(row) === JSON.stringify(before)) return structuredClone(original);
      if (row.source === PRIVATE_SALES_SOURCE) throw new Error("Для изменённой записи укажите собственный источник и его дату. Внутреннее подтверждение IE нельзя переносить на новые условия.");
      return { ...row, verification: row.source && row.sourceDate ? "documented" : "unknown", checkedOn: "" };
    });
    Object.assign(next, { [section]: rows });
  }
  return salesModelSchema.parse(next);
}
