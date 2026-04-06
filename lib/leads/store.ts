import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { LeadRecord, LeadStatus } from "./types";

const FILE = path.join(process.cwd(), "data", "leads.json");

function readAll(): LeadRecord[] {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const a: unknown = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a as LeadRecord[];
  } catch {
    return [];
  }
}

function writeAll(rows: LeadRecord[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export function appendLead(
  input: Omit<
    LeadRecord,
    "id" | "createdAt" | "updatedAt" | "status" | "notes" | "source"
  > & { status?: LeadStatus; notes?: string; source?: string },
): LeadRecord {
  const all = readAll();
  const now = new Date().toISOString();
  const r: LeadRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: input.status ?? "new",
    notes: input.notes ?? "",
    source: input.source ?? "website",
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    projectId: input.projectId,
    projectName: input.projectName,
    locale: input.locale,
  };
  all.unshift(r);
  writeAll(all);
  return r;
}

export function listLeads(): LeadRecord[] {
  return readAll();
}

export function getLead(id: string): LeadRecord | undefined {
  return readAll().find((x) => x.id === id);
}

export function updateLead(
  id: string,
  patch: Partial<Pick<LeadRecord, "status" | "notes">>,
): LeadRecord | undefined {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  const next = {
    ...all[i],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  all[i] = next;
  writeAll(all);
  return next;
}

export function leadStats(): {
  total: number;
  byStatus: Record<LeadStatus, number>;
  newCount: number;
} {
  const all = readAll();
  const byStatus: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    closed: 0,
    lost: 0,
  };
  for (const l of all) {
    byStatus[l.status] += 1;
  }
  return {
    total: all.length,
    byStatus,
    newCount: byStatus.new,
  };
}
