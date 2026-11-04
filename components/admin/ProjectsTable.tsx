"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StudioRow } from "@/app/actions/admin-studio";
import { taxLabel } from "@/lib/taxonomy";

const GAPS: [string, string, (r: StudioRow) => boolean][] = [
  ["", "Все проекты", () => true],
  ["nounits", "Нет лотов", (r) => r.units === 0],
  ["nophotos", "Нет фото", (r) => r.photos === 0],
  ["nolinks", "Нет ссылок", (r) => r.links === 0],
  ["nonews", "Нет новостей", (r) => r.news === 0],
  ["full", "Заполнены полностью", (r) => r.score === 100],
];

export function ProjectsTable({ rows }: { rows: StudioRow[] }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [stage, setStage] = useState("");
  const [gap, setGap] = useState("");
  const [sort, setSort] = useState("name");

  const zones = useMemo(() => [...new Set(rows.map((r) => r.zone).filter(Boolean))].sort(), [rows]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const g = GAPS.find((x) => x[0] === gap)![2];
    const out = rows.filter((r) => (!t || `${r.name} ${r.developer} ${r.zone}`.toLowerCase().includes(t)) && (!zone || r.zone === zone) && (!stage || r.stK === stage) && g(r));
    const by: Record<string, (a: StudioRow, b: StudioRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      score: (a, b) => a.score - b.score,
      dev: (a, b) => a.developer.localeCompare(b.developer),
      price: (a, b) => a.priceFromM - b.priceFromM,
    };
    return [...out].sort(by[sort]);
  }, [rows, q, zone, stage, gap, sort]);

  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;

  return (
    <>
      <div className="adm-toolbar">
        <input type="search" placeholder="Поиск: проект, застройщик, район…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" />
        <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Район"><option value="">Все районы</option>{zones.map((z) => <option key={z}>{z}</option>)}</select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Стадия"><option value="">Любая стадия</option>{(["offplan", "building", "ready"] as const).map((s) => <option key={s} value={s}>{taxLabel("stK", s, "ru", true)}</option>)}</select>
        <select value={gap} onChange={(e) => setGap(e.target.value)} aria-label="Чего не хватает">{GAPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
          <option value="name">По названию</option><option value="score">Сначала менее заполненные</option><option value="dev">По застройщику</option><option value="price">По цене</option>
        </select>
      </div>
      <p className="adm-count" style={{ marginBottom: 10 }}>Найдено: <b>{list.length}</b> из {rows.length} · средняя заполненность <b>{avg}%</b></p>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>Проект</th><th>Застройщик</th><th>Район</th><th>Стадия</th><th className="num">Цена от</th><th className="num">Лоты</th><th className="num">Фото</th><th className="num">Ссылки</th><th>Заполненность</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td><Link className="name" href={`/admin/projects/${r.id}`}>{r.name}</Link></td>
                <td>{r.developer}</td>
                <td>{r.zone}</td>
                <td>{taxLabel("stK", r.stK, "ru", true)}</td>
                <td className="num">{r.priceFromM ? `${r.priceFromM} млн` : <span className="adm-zero">—</span>}</td>
                <td className={`num${r.units ? "" : " adm-zero"}`}>{r.units}</td>
                <td className={`num${r.photos ? "" : " adm-zero"}`}>{r.photos}</td>
                <td className={`num${r.links ? "" : " adm-zero"}`}>{r.links}</td>
                <td style={{ minWidth: 120 }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className={`adm-bar${r.score === 100 ? " full" : ""}`} style={{ flex: 1 }}><b style={{ width: `${r.score}%` }} /></div><span className="adm-hint">{r.score}%</span></div></td>
                <td><span className={`adm-pill ${r.published ? "ok" : "warn"}`}>{r.published ? "на сайте" : r.status}</span></td>
                <td><Link className="adm-btn adm-btn--sm" href={`/admin/projects/${r.id}`}>Открыть</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 ? <p className="adm-hint" style={{ padding: 16 }}>Ничего не найдено.</p> : null}
      </div>
    </>
  );
}
