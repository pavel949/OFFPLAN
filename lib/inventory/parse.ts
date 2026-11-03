/**
 * Parser/validator for developer price lists and inventory pasted from Excel or uploaded as CSV.
 * Accepts TSV (Excel copy-paste), CSV and semicolon-CSV; English and Russian column names.
 */

export type UnitStatus = "available" | "reserved" | "sold";

export interface ParsedUnit {
  line: number;
  label: string;
  externalKey: string | null;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price: number | null;
  currency: string;
  status: UnitStatus;
}

export interface ParseResult {
  rows: ParsedUnit[];
  errors: { line: number; message: string }[];
  delimiter: string;
}

export const MAX_IMPORT_ROWS = 500;
export const DEFAULT_CURRENCY = "THB";

const ALIASES: Record<string, string[]> = {
  label: ["label", "лот", "юнит", "unit", "unit no", "unit number", "номер", "номер лота", "название", "квартира"],
  externalKey: ["id", "external id", "external key", "external_key", "артикул", "код", "ключ"],
  bedrooms: ["bedrooms", "br", "спальни", "спален", "количество спален", "кол-во спален", "спальня"],
  floor: ["floor", "этаж"],
  sqm: ["sqm", "area", "площадь", "м2", "м²", "площадь м2", "площадь м²"],
  price: ["price", "цена", "price thb", "price_thb", "стоимость"],
  currency: ["currency", "валюта"],
  status: ["status", "статус"],
};

const STATUS_MAP: Record<string, UnitStatus> = {
  available: "available",
  free: "available",
  "в продаже": "available",
  свободен: "available",
  свободна: "available",
  свободно: "available",
  reserved: "reserved",
  booked: "reserved",
  бронь: "reserved",
  забронирован: "reserved",
  забронирована: "reserved",
  sold: "sold",
  продан: "sold",
  продана: "sold",
  продано: "sold",
};

const CURRENCIES = new Set(["THB", "USD", "EUR", "RUB", "VND", "KHR", "AED"]);
const SYMBOLS: Record<string, string> = { "฿": "THB", $: "USD", "€": "EUR", "₽": "RUB", "₫": "VND" };

function norm(h: string): string {
  return h.toLowerCase().replace(/[.,:;()]/g, "").replace(/\s+/g, " ").trim();
}

/** Split text into records honouring quotes. Returns rows of raw cells. */
export function splitRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delimiter) {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || cur.length) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { "\t": 0, ";": 0, ",": 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",");
}

/** Parse "9 500 000", "9,500,000", "9.5M", "9,5 млн", "฿12.4K" → number (or null). */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[\s ]/g, "").replace(/[฿$€₽₫]|thb|usd|eur|rub|vnd/gi, "");
  if (!s) return null;
  let mult = 1;
  const suffix = s.match(/(млн|млрд|тыс|[kKmMbB])\.?$/);
  if (suffix) {
    const sfx = suffix[1].toLowerCase();
    mult = sfx === "k" || sfx === "тыс" ? 1e3 : sfx === "m" || sfx === "млн" ? 1e6 : 1e9;
    s = s.slice(0, s.length - suffix[0].length);
  }
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s) * mult;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function normalizeKey(label: string): string {
  return label.toUpperCase().replace(/[\s ]+/g, " ").trim();
}

export function parseInventoryText(text: string, defaultCurrency = DEFAULT_CURRENCY): ParseResult {
  const errors: ParseResult["errors"] = [];
  const body = text.trim();
  if (!body) return { rows: [], errors: [{ line: 0, message: "Пустой ввод: вставьте таблицу или загрузите CSV" }], delimiter: "," };

  const firstLine = body.split(/\r?\n/, 1)[0];
  const delimiter = detectDelimiter(firstLine);
  const records = splitRecords(body, delimiter).filter((r) => r.some((c) => c.trim() !== ""));
  if (records.length < 2) {
    return { rows: [], errors: [{ line: 1, message: "Нужна строка заголовков и минимум одна строка данных" }], delimiter };
  }

  const header = records[0].map(norm);
  const idx: Record<string, number> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) idx[field] = i;
  }
  if (idx.label === undefined) {
    return { rows: [], errors: [{ line: 1, message: "Не найден столбец «Лот» (label / unit)" }], delimiter };
  }
  if (idx.price === undefined) {
    return { rows: [], errors: [{ line: 1, message: "Не найден столбец «Цена» (price)" }], delimiter };
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 0, message: `Слишком много строк (${dataRecords.length}). Максимум за один импорт — ${MAX_IMPORT_ROWS}` }], delimiter };
  }

  const rows: ParsedUnit[] = [];
  const seen = new Map<string, number>();
  dataRecords.forEach((rec, k) => {
    const line = k + 2;
    const cell = (f: string) => (idx[f] !== undefined ? (rec[idx[f]] ?? "").trim() : "");
    const label = cell("label");
    if (!label) {
      errors.push({ line, message: "Пустой номер лота" });
      return;
    }
    const rowErr = (message: string) => errors.push({ line, message: `${label}: ${message}` });

    const statusRaw = cell("status").toLowerCase();
    let status: UnitStatus = "available";
    if (statusRaw) {
      const s = STATUS_MAP[statusRaw];
      if (!s) return rowErr(`неизвестный статус «${cell("status")}» (допустимо: свободен / бронь / продан)`);
      status = s;
    }

    const priceRaw = cell("price");
    let price: number | null = null;
    if (priceRaw && !/^(poa|tba|по запросу|-|—)$/i.test(priceRaw)) {
      price = parseNumber(priceRaw);
      if (price === null) return rowErr(`не удалось разобрать цену «${priceRaw}»`);
      if (price < 0) return rowErr("цена не может быть отрицательной");
    }
    if (status === "available" && (price === null || price <= 0)) {
      return rowErr("для свободного лота укажите цену больше 0");
    }

    let currency = cell("currency").toUpperCase() || "";
    if (!currency) {
      const sym = Object.keys(SYMBOLS).find((s) => priceRaw.includes(s));
      currency = sym ? SYMBOLS[sym] : defaultCurrency;
    }
    if (!CURRENCIES.has(currency)) return rowErr(`неизвестная валюта «${currency}»`);

    const num = (f: string, what: string, int = false): number | null | "err" => {
      const raw = cell(f);
      if (!raw) return null;
      const n = parseNumber(raw);
      if (n === null || n < 0 || (int && !Number.isInteger(n))) {
        rowErr(`некорректное значение поля «${what}»: ${raw}`);
        return "err";
      }
      return n;
    };
    const bedrooms = num("bedrooms", "спальни", true);
    const floor = num("floor", "этаж", true);
    const sqm = num("sqm", "площадь");
    if (bedrooms === "err" || floor === "err" || sqm === "err") return;
    if (sqm !== null && sqm <= 0) return rowErr("площадь должна быть больше 0");

    const externalKey = cell("externalKey") || null;
    const key = normalizeKey(externalKey ?? label);
    const prev = seen.get(key);
    if (prev !== undefined) return rowErr(`дубликат (строка ${prev})`);
    seen.set(key, line);

    rows.push({ line, label, externalKey, bedrooms, floor, sqm, price, currency, status });
  });

  return { rows, errors, delimiter };
}
