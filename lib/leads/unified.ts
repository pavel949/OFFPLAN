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
}): LeadRecord {
  return {
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
  },
): Promise<LeadRecord> {
  if (hasSupabaseServiceConfig()) {
    try {
      const supabase = createServiceRoleClient();
      let project_uuid: string | null = null;
      let org_id: string | null = null;
      if (input.projectId != null) {
        const { data } = await supabase
          .from("catalog_projects")
          .select("id, org_id")
          .eq("legacy_id", input.projectId)
          .maybeSingle();
        project_uuid = data?.id ?? null;
        org_id = (data as { org_id?: string | null } | null)?.org_id ?? null;
      }
      const { data, error } = await supabase
        .from("leads")
        .insert({
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
        })
        .select()
        .single();
      if (error) throw error;
      const row = data as Parameters<typeof mapDbRow>[0];
      const created = mapDbRow(row);
      void recordAnalyticsEvent({
        name: "lead.submitted",
        project_id: project_uuid,
        payload: { lead_id: created.id, utm: input.utm ?? undefined },
      });
      void dispatchLeadWebhooks({
        event: "lead.created",
        lead_id: created.id,
        project_uuid,
        org_id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        created_at: created.createdAt,
      });
      return created;
    } catch {
      return appendLead(input);
    }
  }
  return appendLead(input);
}

export async function listLeadsUnified(): Promise<LeadRecord[]> {
  if (hasSupabaseServiceConfig()) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data?.length) {
      return data.map((r) => mapDbRow(r as Parameters<typeof mapDbRow>[0]));
    }
  }
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
    if (!error && data) {
      return mapDbRow(data as Parameters<typeof mapDbRow>[0]);
    }
  }
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
      .single();
    if (!error && data) {
      return mapDbRow(data as Parameters<typeof mapDbRow>[0]);
    }
    return undefined;
  }
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