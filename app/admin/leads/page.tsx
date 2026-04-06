import { listLeadsUnified } from "@/lib/leads/unified";
import { LeadsTable } from "./leads-table";

export default async function AdminLeadsPage() {
  const leads = await listLeadsUnified();

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Лиды</h1>
      <p className="text-[var(--txt2)] text-sm mb-6">
        Заявки с формы на сайте. Меняйте статус и заметки при обработке.
      </p>
      <LeadsTable leads={leads} />
    </div>
  );
}
