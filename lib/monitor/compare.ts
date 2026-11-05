/**
 * Read-only comparison of developer inventory snapshots.
 *
 * Telegram messages and PDF/Excel attachments are evidence, not permission to
 * overwrite published inventory. Parsing/authorization/storage are separate.
 */
export type DeveloperStatus = "available" | "reserved" | "hold" | "sold" | "unknown";

export interface PriceSource {
  projectId: string;
  url: string;
  publishedAt: string;
  version: string;
  /** A full, independently validated project/phase scope is required to flag absences. */
  coverage: "full" | "partial" | "unknown";
  /** E.g. phase/building subset. Only identical scopes may be compared for absences. */
  scope: string;
}

export interface PriceUnit {
  building: string;
  unit: string;
  price: number | null;
  currency: string;
  status: DeveloperStatus;
}

export interface PriceSnapshot {
  source: PriceSource;
  units: PriceUnit[];
}

export type PriceChange =
  | { kind: "new"; key: string; next: PriceUnit }
  | { kind: "price"; key: string; previous: number | null; next: number | null; currency: string }
  | { kind: "currency"; key: string; previous: string; next: string }
  | { kind: "status"; key: string; previous: DeveloperStatus; next: DeveloperStatus }
  | { kind: "absent_unconfirmed"; key: string; previous: PriceUnit };

export interface SnapshotComparison {
  previous: PriceSource;
  current: PriceSource;
  changes: PriceChange[];
  /** A partial document cannot prove the absence of any inventory unit. */
  absencesCompared: boolean;
}

const normalized = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();

export function inventoryKey(projectId: string, building: string, unit: string): string {
  if (![projectId, building, unit].every((s) => s.trim())) throw new Error("Project, building and unit are required");
  return [normalized(projectId), normalized(building), normalized(unit)].join("::");
}

function index(snapshot: PriceSnapshot): Map<string, PriceUnit> {
  const map = new Map<string, PriceUnit>();
  for (const row of snapshot.units) {
    const key = inventoryKey(snapshot.source.projectId, row.building, row.unit);
    if (map.has(key)) throw new Error(`Duplicate unit in snapshot: ${key}`);
    if (row.price !== null && (!Number.isFinite(row.price) || row.price < 0)) {
      throw new Error(`Invalid price for ${key}`);
    }
    if (!row.currency.trim()) throw new Error(`Currency required for ${key}`);
    map.set(key, row);
  }
  return map;
}

export function comparePriceSnapshots(previous: PriceSnapshot, current: PriceSnapshot): SnapshotComparison {
  if (previous.source.projectId !== current.source.projectId) {
    throw new Error("Cannot compare different projects");
  }
  if (!previous.source.url || !current.source.url || !previous.source.version || !current.source.version) {
    throw new Error("Snapshot source URL and version are required");
  }
  if (!Number.isFinite(Date.parse(previous.source.publishedAt)) ||
      !Number.isFinite(Date.parse(current.source.publishedAt))) {
    throw new Error("Valid source publication dates are required");
  }
  if (Date.parse(current.source.publishedAt) < Date.parse(previous.source.publishedAt)) {
    throw new Error("Refusing to compare an older source as current");
  }
  const before = index(previous);
  const after = index(current);
  const changes: PriceChange[] = [];
  for (const [key, next] of after) {
    const old = before.get(key);
    if (!old) { changes.push({ kind: "new", key, next }); continue; }
    if (old.currency !== next.currency) {
      changes.push({ kind: "currency", key, previous: old.currency, next: next.currency });
    } else if (old.price !== next.price) {
      changes.push({ kind: "price", key, previous: old.price, next: next.price, currency: next.currency });
    }
    // Unknown source status is not evidence of a transition.
    if (next.status !== "unknown" && old.status !== "unknown" && old.status !== next.status) {
      changes.push({ kind: "status", key, previous: old.status, next: next.status });
    }
  }
  const absencesCompared = current.source.coverage === "full" &&
    previous.source.scope === current.source.scope;
  if (absencesCompared) {
    for (const [key, old] of before) {
      if (!after.has(key)) changes.push({ kind: "absent_unconfirmed", key, previous: old });
    }
  }
  return { previous: previous.source, current: current.source, changes, absencesCompared };
}
