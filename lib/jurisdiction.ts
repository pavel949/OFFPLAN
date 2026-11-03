import type { Locale } from "./i18n/locales";

/**
 * Jurisdiction = country-level market configuration. The authoritative, editable copy lives in the
 * `jurisdictions` table (see migration 20250410000000); this is the build-time default used by
 * formatting and metadata so a new market is a configuration change, not a code fork.
 */
export interface JurisdictionConfig {
  code: "TH" | "VN" | "KH";
  currency: string;
  currencySymbol: string;
  defaultLocale: Locale;
  name: Record<Locale, string>;
  /** Short market label used in headings, e.g. "Пхукет". */
  marketLabel: Record<Locale, string>;
}

export const JURISDICTIONS: Record<JurisdictionConfig["code"], JurisdictionConfig> = {
  TH: {
    code: "TH",
    currency: "THB",
    currencySymbol: "฿",
    defaultLocale: "ru",
    name: { ru: "Таиланд", en: "Thailand" },
    marketLabel: { ru: "Пхукет", en: "Phuket" },
  },
  VN: {
    code: "VN",
    currency: "VND",
    currencySymbol: "₫",
    defaultLocale: "ru",
    name: { ru: "Вьетнам", en: "Vietnam" },
    marketLabel: { ru: "Вьетнам", en: "Vietnam" },
  },
  KH: {
    code: "KH",
    currency: "USD",
    currencySymbol: "$",
    defaultLocale: "ru",
    name: { ru: "Камбоджа", en: "Cambodia" },
    marketLabel: { ru: "Камбоджа", en: "Cambodia" },
  },
};

export function activeJurisdiction(): JurisdictionConfig {
  const code = (process.env.NEXT_PUBLIC_JURISDICTION || "TH").toUpperCase();
  return JURISDICTIONS[code as JurisdictionConfig["code"]] ?? JURISDICTIONS.TH;
}
