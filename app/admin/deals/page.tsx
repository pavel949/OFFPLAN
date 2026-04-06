import { hasSupabaseServiceConfig, createServiceRoleClient } from "@/lib/supabase/service";

export default async function AdminDealsPage() {
  type DealRow = {
    id: string;
    status: string;
    commission_amount_thb: number | null;
    currency: string;
    notes: string;
    created_at: string;
    lead_id: string | null;
  };
  let rows: DealRow[] = [];

  if (hasSupabaseServiceConfig()) {
    try {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("deals")
        .select("id, status, commission_amount_thb, currency, notes, created_at, lead_id")
        .order("created_at", { ascending: false })
        .limit(100);
      rows = (data ?? []) as DealRow[];
    } catch {
      rows = [];
    }
  }

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Сделки и комиссии</h1>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-xl">
        Связь лида со сделкой и начислением комиссии. Заполняется из CRM.
      </p>
      {!hasSupabaseServiceConfig() ? (
        <p className="text-[var(--red)] text-sm">
          Supabase не настроен.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">Пока нет сделок в БД.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статус</th>
                <th>Комиссия</th>
                <th>Лид</th>
                <th>Заметки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td>{r.status}</td>
                  <td>
                    {r.commission_amount_thb != null
                      ? `${r.commission_amount_thb.toLocaleString()} ${r.currency}`
                      : "—"}
                  </td>
                  <td className="font-mono text-xs">{r.lead_id ?? "—"}</td>
                  <td className="max-w-[200px] truncate">{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
