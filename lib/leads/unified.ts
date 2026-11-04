import { leadSalesSummary } from "./sales-summary";
import { after } from "next/server";
import { resolveLeadBroker } from "@/lib/commission/service";
import { notifyNewLead } from "@/lib/notify";
import { dispatchLeadWebhooks } from "@/lib/marketplace/webhooks";
import { recordAnalyticsEvent } from "@/lib/marketplace/analytics";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import type { LeadRecord, LeadStatus } from "./types";
import {
  appendLead,
  getLead,
  leadStats,
  listLeads,
  updateLead,
} from "./store";

export class LeadStoreUnavailableError extends Error {
  constructor() {
    super("Не удалось загрузить или сохранить заявки. Повторите попытку позже.");
    this.name = "LeadStoreUnavailableError";
  }
}

function requireDevelopmentStore() {
  if (process.env.NODE_ENV === "production") throw new LeadStoreUnavailableError();
}

function mapDbRow(row: {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  project_id: number | null;
  project_name: string | null;
  status: string;
  source: string;
  notes: string;
  locale: string;
  sales_selection?: LeadRecord["salesSelection"] | null;
}): LeadRecord {
  return {
    ...(row.sales_selection?{salesSelection:row.sales_selection}:{}),
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    projectId: row.project_id,
    projectName: row.project_name,
    status: row.status as LeadStatus,
    source: row.source,
    notes: row.notes ?? "",
    locale: row.locale === "ru" ? "ru" : "en",
  };
}

export async function appendLeadUnified(
  input: Omit<
    LeadRecord,
    "id" | "createdAt" | "updatedAt" | "status" | "notes" | "source"
  > & {
    status?: LeadStatus;
    notes?: string;
    source?: string;
    utm?: Record<string, string> | null;
    consentVersion?: string;
  },
): Promise<LeadRecord> {
  if (!hasSupabaseServiceConfig()) {
    // Local file store is a development convenience only: serverless FS is read-only/ephemeral,
    // so in production a missing DB must fail loudly instead of silently losing PII.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Lead store is not configured");
    }
    return appendLead(input);
  }

  const supabase = createServiceRoleClient();
  let project_uuid: string | null = null;
  let org_id: string | null = null;
  if (input.projectId != null) {
    const { data, error: projectError } = await supabase
      .from("catalog_projects")
      .select("id, org_id")
      .eq("legacy_id", input.projectId)
      .maybeSingle();
    if (projectError) throw new LeadStoreUnavailableError();
    project_uuid = data?.id ?? null;
    org_id = (data as { org_id?: string | null } | null)?.org_id ?? null;
  }
  // Multi-broker routing: exclusive agreement of the project/developer, else the configured default broker.
  const broker_org_id = await resolveLeadBroker(supabase, project_uuid, org_id);
  const { data, error } = await supabase
    .from("leads")
    .insert({
      broker_org_id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      message: input.message ?? "",
      project_id: input.projectId,
      project_name: input.projectName,
      project_uuid,
      status: input.status ?? "new",
      notes: input.notes ?? "",
      source: input.source ?? "website",
      locale: input.locale,
      utm: input.utm && Object.keys(input.utm).length ? input.utm : null,
      consent_at: new Date().toISOString(),
      consent_version: input.consentVersion ?? null,
      ...(input.salesSelection?{sales_selection:input.salesSelection}:{}),
    })
    .select()
    .single();
  if (error) {
    console.error("[leads] insert failed", error.message);
    throw new Error("Lead insert failed");
  }
  const created = mapDbRow(data as Parameters<typeof mapDbRow>[0]);

  // Side effects run after the response is sent but are kept alive by the platform.
  after(async () => {
    await Promise.allSettled([
      recordAnalyticsEvent({
        name: "lead.submitted",
        project_id: project_uuid,
        payload: { lead_id: created.id, utm: input.utm ?? undefined },
      }),
      notifyNewLead({
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        message: created.message,
        projectName: created.projectName,
        salesSelection: created.salesSelection,
      }),
      dispatchLeadWebhooks({
        event: "lead.created",
        ...(leadSalesSummary(created.salesSelection)?{sales_selection:leadSalesSummary(created.salesSelection)!}:{}),
        lead_id: created.id,
        project_uuid,
        org_id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        created_at: created.createdAt,
      }),
    ]);
  });
  return created;
}

export async function listLeadsUnified(): Promise<LeadRecord[]> {
  if (hasSupabaseServiceConfig()) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new LeadStoreUnavailableError();
    return (data ?? []).map((r) => mapDbRow(r as Parameters<typeof mapDbRow>[0]));
  }
  requireDevelopmentStore();
  return listLeads();
}

export async function getLeadUnified(id: string): Promise<LeadRecord | undefined> {
  if (hasSupabaseServiceConfig()) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new LeadStoreUnavailableError();
    return data ? mapDbRow(data as Parameters<typeof mapDbRow>[0]) : undefined;
  }
  requireDevelopmentStore();
  return getLead(id);
}

export async function updateLeadUnified(
  id: string,
  patch: Partial<Pick<LeadRecord, "status" | "notes">>,
): Promise<LeadRecord | undefined> {
  if (hasSupabaseServiceConfig()) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("leads")
      .update({
        status: patch.status,
        notes: patch.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new LeadStoreUnavailableError();
    return data ? mapDbRow(data as Parameters<typeof mapDbRow>[0]) : undefined;
  }
  requireDevelopmentStore();
  return updateLead(id, patch);
}

export async function leadStatsUnified(): Promise<{
  total: number;
  byStatus: Record<LeadStatus, number>;
  newCount: number;
}> {
  const all = await listLeadsUnified();
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

/** @deprecated use leadStatsUnified */
export { leadStats };
