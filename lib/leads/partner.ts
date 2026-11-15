import { z } from "zod";

export const partnerLeadCommand = z.object({
  leadId: z.uuid(),
  action: z.enum(["claim", "release", "responded", "status"]),
  status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).optional(),
}).refine((v) => v.action !== "status" || !!v.status);

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Новая", contacted: "Связались", qualified: "Подтверждён интерес", closed: "Закрыта", lost: "Неактуальна",
};

export function responseDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "Нет данных";
  if (minutes < 60) return `${Math.round(minutes)} мин`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} ч`;
  return `${(minutes / 1440).toFixed(1)} дн`;
}
