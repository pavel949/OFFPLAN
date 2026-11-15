export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "closed"
  | "lost";

export interface LeadRecord {
  salesSelection?: import("@/lib/sales-public").PublicOffer;
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  projectId: number | null;
  projectName: string | null;
  status: LeadStatus;
  /** website, referral, etc. */
  source: string;
  /** Internal CRM notes */
  notes: string;
  locale: "en" | "ru";
}
