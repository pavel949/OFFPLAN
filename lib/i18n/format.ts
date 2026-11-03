import type { Locale } from "./locales";

const NBSP = " ";

const SENTINELS: Record<string, Record<Locale, string>> = {
  "н/д": { ru: "н/д", en: "n/a" },
  "n/d": { ru: "н/д", en: "n/a" },
  POA: { ru: "по запросу", en: "On request" },
  TBA: { ru: "будет объявлено", en: "TBA" },
};

/**
 * Localise a short value coming from English-origin data (prices, areas, counts).
 * ru: "฿17.3M" → "฿17,3 млн", "$500K+" → "$500 тыс.+", "48–220 sqm" → "48–220 м²",
 *     "220,000–350,000" → "220 000–350 000", POA/TBA/n-d → words.
 */
export function localizeValue(value: string, lang: Locale): string {
  const v = value.trim();
  const sentinel = SENTINELS[v];
  if (sentinel) return sentinel[lang];
  if (lang !== "ru") return value;

  return value
    .replace(/(\d+(?:\.\d+)?)\s?([KMB])\b/g, (_m, num: string, unit: string) => {
      const n = num.replace(".", ",");
      const word = unit === "K" ? "тыс." : unit === "M" ? "млн" : "млрд";
      return `${n}${NBSP}${word}`;
    })
    .replace(/(\d),(\d{3})(?!\d)/g, `$1${NBSP}$2`)
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/\bsqm\b/g, "м²")
    .replace(/(\d)\s?BR\b/g, "$1 сп.")
    .replace(/\bPH\b/g, "пентхаус")
    .replace(/\bbuilt\b/g, "застроенная")
    .replace(/\(Park Residences phase\)/, "(очередь Park Residences)");
}
