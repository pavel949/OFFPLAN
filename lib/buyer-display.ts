import type { CatalogProject } from "./types";
import { currentAvailability } from "./published-availability";

export function ownershipLabel(value: string, lang: "ru" | "en" = "ru") {
  return ({ freehold: "Freehold", leasehold: "Leasehold", other: lang === "ru" ? "Иная форма" : "Other", unknown: lang === "ru" ? "Владение уточняется" : "Ownership unconfirmed" } as Record<string,string>)[value] ?? value;
}

/** Translate only known milestone words; retain the source's distinct construction/handover dates. */
export function completionLabel(value: string | number | null, lang: "ru" | "en" = "ru") {
  if (value == null || value === "") return lang === "ru" ? "Срок не подтверждён" : "Date not confirmed";
  const text = String(value);
  if (lang === "en") return text;
  return text.replace(/construction/gi, "Завершение строительства:").replace(/handover/gi, "Передача:")
    .replace(/\bMar(?:ch)?\b/g, "март").replace(/\bQ([1-4])\b/g, (_, q) => `${["I","II","III","IV"][Number(q)-1]} кв.`).replace(/;\s*/g, " · ");
}

export function floorLabel(value: string, lang: "ru" | "en") {
  if (lang === "en") return value;
  // Keep both labels when the source distinguishes a storey name and floor number.
  return value.replace(/GROUND(?: FLOOR)?/gi, "первый уровень").replace(/\b(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\b/gi, v => ({FIRST:"первый",SECOND:"второй",THIRD:"третий",FOURTH:"четвёртый",FIFTH:"пятый",SIXTH:"шестой",SEVENTH:"седьмой",EIGHTH:"восьмой",NINTH:"девятый",TENTH:"десятый"})[v.toUpperCase()] ?? v).replace(/(\d+)(?:st|nd|rd|th)\s*Floor/gi,"$1-й этаж");
}

export function projectPriceM(p: Pick<CatalogProject, "pN" | "sales">, ownership = "", bedrooms = "", now = Date.now()) {
  if (p.sales?.publication) {
    const active = currentAvailability(p.sales.publication, now);
    const options = active?.pricing?.filter(o => o.currency === "THB" && (!ownership || o.ownership === ownership) && (!bedrooms || o.bedrooms === Number(bedrooms)));
    return options?.length ? Math.min(...options.map(o=>o.from)) / 1e6 : 0;
  }
  return ownership || bedrooms ? 0 : p.pN;
}

export function offerDetail(value: string, lang: "ru" | "en") {
  if (lang === "en") return value;
  if (value === "Furniture and houseware packages listed separately; inclusion requires confirmation.") return "Мебель и оснащение указаны отдельными пакетами; включение в цену требует подтверждения.";
  const furniture=value.match(/^Optional furniture THB ([\d.]+); optional houseware THB ([\d.]+)\. Not assumed included$/);
  if(furniture)return `Мебель опционально: ${Number(furniture[1]).toLocaleString("ru-RU")} ฿; оснащение опционально: ${Number(furniture[2]).toLocaleString("ru-RU")} ฿. Не считаются включёнными в цену.`;
  const listing=value.match(/^Developer public listing observed (.+); not a reservation or binding offer\. Tenure and quota require contract confirmation\.$/);
  if(listing && Number.isFinite(Date.parse(listing[1])))return `Публичный прайс просмотрен ${new Date(listing[1]).toLocaleDateString("ru-RU",{timeZone:"UTC"})}. Это не бронь и не обязывающее предложение. Срок владения и квота требуют подтверждения договором.`;
  return value;
}
