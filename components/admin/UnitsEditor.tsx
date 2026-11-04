"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminStudioConfirmPrices, adminStudioDeleteUnit, adminStudioSaveUnit, type UnitInput,
} from "@/app/actions/admin-studio";
import type { OperatorUnitRow } from "@/app/actions/admin-brain";
import { daysSince, freshnessOf } from "@/lib/inventory/freshness";

type Row = { key: string; id?: string; label: string; bedrooms: string; floor: string; sqm: string; price: string; status: UnitInput["status"]; dirty: boolean; saved?: string; at: string | null };

const toRow = (u: OperatorUnitRow): Row => ({
  key: u.id, id: u.id, label: u.label, bedrooms: u.bedrooms?.toString() ?? "", floor: u.floor?.toString() ?? "",
  sqm: u.sqm?.toString() ?? "", price: u.price_thb?.toString() ?? "", status: u.status as UnitInput["status"], dirty: false, at: u.price_updated_at,
});
const blank = (): Row => ({ key: `n-${Math.random().toString(36).slice(2)}`, label: "", bedrooms: "", floor: "", sqm: "", price: "", status: "unknown", dirty: true, at: null });
const num = (s: string) => { const v = s.replace(/[\s,]/g, ""); return v === "" ? null : Number(v); };
const STATUS: Record<string, string> = { unknown: "Уточняется", available: "Свободен", reserved: "Бронь", sold: "Продан" };

export function UnitsEditor({ projectId, initial }: { projectId: string; initial: OperatorUnitRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const now = Date.now();

  const patch = (key: string, p: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...p, dirty: true, saved: undefined } : x)));

  function save(row: Row) {
    start(async () => {
      const res = await adminStudioSaveUnit(projectId, {
        id: row.id, label: row.label, bedrooms: num(row.bedrooms), floor: num(row.floor), sqm: num(row.sqm), price: num(row.price), status: row.status,
      });
      if (!res.ok) return setMsg({ ok: false, text: `${row.label || "Новый лот"}: ${res.error}` });
      setRows((r) => r.map((x) => (x.key === row.key ? { ...x, id: res.id, key: res.id ?? x.key, dirty: false, saved: "✓", at: new Date().toISOString() } : x)));
      setMsg({ ok: true, text: "Сохранено" });
    });
  }
  async function saveAll() {
    for (const r of rows.filter((x) => x.dirty && x.label.trim())) {
      const res = await adminStudioSaveUnit(projectId, { id: r.id, label: r.label, bedrooms: num(r.bedrooms), floor: num(r.floor), sqm: num(r.sqm), price: num(r.price), status: r.status });
      if (!res.ok) return setMsg({ ok: false, text: `${r.label}: ${res.error}` });
    }
    setMsg({ ok: true, text: "Все изменения сохранены" });
    router.refresh();
  }
  function remove(row: Row) {
    if (!row.id) return setRows((r) => r.filter((x) => x.key !== row.key));
    if (!confirm(`Удалить лот ${row.label}?`)) return;
    start(async () => {
      const res = await adminStudioDeleteUnit(projectId, row.id!);
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Ошибка" });
      setRows((r) => r.filter((x) => x.key !== row.key));
    });
  }
  function confirmPrices() {
    start(async () => {
      const res = await adminStudioConfirmPrices(projectId);
      setMsg(res.ok ? { ok: true, text: `Цены подтверждены сегодня: ${res.count} лот.` } : { ok: false, text: res.error ?? "Ошибка" });
      if (res.ok) router.refresh();
    });
  }

  const dirty = rows.filter((r) => r.dirty && r.label.trim()).length;
  return (
    <section className="adm-card">
      <h3>Лоты и цены</h3>
      <p className="adm-lead">Редактируйте прямо в таблице. Изменение цены обновляет дату её актуальности; цены старше 30 дней на сайте скрываются, поэтому после сверки с застройщиком нажмите «Цены актуальны».</p>
      <div className="adm-toolbar">
        <button type="button" className="adm-btn adm-btn--line adm-btn--sm" onClick={() => setRows((r) => [...r, blank()])}>+ Добавить лот</button>
        <button type="button" className="adm-btn adm-btn--line adm-btn--sm" disabled={busy || !rows.some((r) => r.id)} onClick={confirmPrices}>✓ Цены актуальны сегодня</button>
        <span className="adm-count">Лотов: {rows.length} · свободно: {rows.filter((r) => r.status === "available").length}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="adm-btn adm-btn--sm" disabled={busy || !dirty} onClick={saveAll}>Сохранить всё{dirty ? ` (${dirty})` : ""}</button>
      </div>
      {msg ? <p className={`adm-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p> : null}
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>Лот</th><th>Спальни</th><th>Этаж</th><th>м²</th><th>Цена, ฿</th><th>Статус</th><th>Свежесть</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const f = freshnessOf(r.at, now);
              return (
                <tr key={r.key}>
                  <td><input className="adm-cell" style={{ minWidth: 90 }} value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="A-101" /></td>
                  <td><input className="adm-cell" style={{ width: 70 }} inputMode="numeric" value={r.bedrooms} onChange={(e) => patch(r.key, { bedrooms: e.target.value })} /></td>
                  <td><input className="adm-cell" style={{ width: 70 }} inputMode="numeric" value={r.floor} onChange={(e) => patch(r.key, { floor: e.target.value })} /></td>
                  <td><input className="adm-cell" style={{ width: 90 }} inputMode="decimal" value={r.sqm} onChange={(e) => patch(r.key, { sqm: e.target.value })} /></td>
                  <td><input className="adm-cell" style={{ width: 130 }} inputMode="numeric" value={r.price} onChange={(e) => patch(r.key, { price: e.target.value })} /></td>
                  <td>
                    <select className="adm-cell" value={r.status} onChange={(e) => patch(r.key, { status: e.target.value as UnitInput["status"] })}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    {r.id && r.status !== "sold" ? (
                      <span className={`adm-pill ${f === "fresh" ? "ok" : f === "stale" ? "warn" : "bad"}`}>
                        {f === "fresh" ? "актуально" : f === "stale" ? "подтвердите" : "цена скрыта"} · {daysSince(r.at, now) ?? "?"} дн.
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.dirty && r.label.trim() ? <button type="button" className="adm-btn adm-btn--sm" disabled={busy} onClick={() => save(r)}>Сохранить</button> : r.saved ? <span className="adm-msg ok">{r.saved}</span> : null}{" "}
                    <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={busy} onClick={() => remove(r)} aria-label={`Удалить ${r.label}`}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="adm-hint" style={{ padding: 14 }}>Лотов пока нет. Добавьте первый или вставьте таблицу из Excel ниже.</p> : null}
      </div>
    </section>
  );
}
