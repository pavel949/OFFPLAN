"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadRecord, LeadStatus } from "@/lib/leads/types";

const statusRu: Record<LeadStatus, string> = {
  new: "Новый",
  contacted: "В работе",
  qualified: "Квалифицирован",
  closed: "Закрыт",
  lost: "Не целевой",
};

export function LeadsTable({ leads }: { leads: LeadRecord[] }) {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!qq) return true;
      const hay = `${l.name} ${l.email} ${l.phone} ${l.projectName ?? ""} ${l.message}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [leads, filter, q]);

  return (
    <div>
      <div className="admin-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LeadStatus | "all")}
        >
          <option value="all">Все статусы</option>
          {(Object.keys(statusRu) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusRu[s]}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Поиск по имени, email, телефону, проекту…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <span className="tabular-nums text-sm text-[var(--txt2)]">
          Показано: {rows.length} / {leads.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">Нет записей.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Имя</th>
                <th>Email / телефон</th>
                <th>Проект</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <Link href={`/admin/leads/${l.id}`} className="font-semibold">
                      {l.name}
                    </Link>
                  </td>
                  <td>
                    <div>{l.email}</div>
                    {l.phone ? (
                      <div className="text-[var(--txt2)] text-xs">{l.phone}</div>
                    ) : null}
                  </td>
                  <td className="max-w-[200px] truncate" title={l.projectName ?? ""}>
                    {l.projectName ?? "—"}
                  </td>
                  <td>
                    <span className={`admin-badge ${l.status}`}>
                      {statusRu[l.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
