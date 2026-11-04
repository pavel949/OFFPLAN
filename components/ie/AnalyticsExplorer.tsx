"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { fmtInt, fmtM, fmtPct, groupBy, parseSqmPrice, parseUnits, summarize, TYPE_RU } from "@/lib/analytics";
import { developerSlug } from "@/lib/developers";
import { locationSlug } from "@/lib/slug";
import type { CatalogProject } from "@/lib/types";
import { Bars } from "./Bars";

type Row = Pick<CatalogProject, "id" | "n" | "dev" | "dt" | "zone" | "type" | "stK" | "pN" | "pT" | "sqmP" | "units" | "yN" | "compY" | "compQ"> & { slug: string; locRu: string; href: string };

const STAGE = {unknown:"Стадия не подтверждена", offplan: "Старт продаж", building: "Строится", ready: "Сдан" } as const;
const FILTERS = ["loc", "type", "stage", "dev", "year"] as const;
type FKey = (typeof FILTERS)[number];

export function AnalyticsExplorer({ rows, locNames }: { rows: Row[]; locNames: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const f: Record<FKey, string> = { loc: sp.get("loc") ?? "", type: sp.get("type") ?? "", stage: sp.get("stage") ?? "", dev: sp.get("dev") ?? "", year: sp.get("year") ?? "" };
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "n", dir: 1 });

  const set = useCallback(
    (k: FKey, v: string) => {
      const q = new URLSearchParams(sp.toString());
      if (v) q.set(k, v);
      else q.delete(k);
      router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  const list = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!f.loc || r.slug === f.loc) &&
          (!f.type || r.type === f.type) &&
          (!f.stage || r.stK === f.stage) &&
          (!f.dev || developerSlug(r.dt) === f.dev) &&
          (!f.year || String(r.compY) === f.year),
      ),
    [rows, f.loc, f.type, f.stage, f.dev, f.year],
  );
  const asProjects = list as unknown as CatalogProject[];
  const s = useMemo(() => summarize(asProjects), [asProjects]);
  const byLoc = useMemo(() => groupBy(asProjects, (p) => locationSlug(p.zone), (p) => p.zone), [asProjects]);
  const byDev = useMemo(() => groupBy(asProjects, (p) => developerSlug(p.dt), (p) => p.dev), [asProjects]);

  const locOpts = useMemo(() => [...new Map(rows.map((r) => [r.slug, r.locRu])).entries()].sort((a, b) => a[1].localeCompare(b[1], "ru")), [rows]);
  const devOpts = useMemo(() => [...new Map(rows.map((r) => [developerSlug(r.dt), r.dev])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const years = useMemo(() => [...new Set(rows.map((r) => r.compY).filter((y): y is number => y != null))].sort(), [rows]);
  const active = FILTERS.some((k) => f[k]);

  const sorted = useMemo(() => {
    const val = (r: Row): string | number =>
      sort.k === "n" ? r.n.toLowerCase() : sort.k === "loc" ? r.locRu : sort.k === "dev" ? r.dev.toLowerCase() : sort.k === "price" ? r.pN || Infinity : sort.k === "yield" ? r.yN : sort.k === "year" ? r.compY ?? Infinity : sort.k === "sqm" ? parseSqmPrice(r.sqmP) ?? -1 : sort.k === "units" ? parseUnits(r.units) ?? -1 : 0;
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [list, sort]);

  const th = (k: string, label: string) => (
    <th aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((p) => ({ k, dir: p.k === k ? (p.dir === 1 ? -1 : 1) : 1 }))}>
        {label}
        {sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Проект", "Локация", "Застройщик", "Тип", "Стадия", "Цена от, млн THB", "Цена за м², THB", "Лотов", "Доходность %", "Сдача"];
    const body = sorted.map((r) => [r.n, r.locRu, r.dev, TYPE_RU[r.type] ?? r.type, STAGE[r.stK as keyof typeof STAGE] ?? r.stK, r.pN || "", parseSqmPrice(r.sqmP) ?? "", parseUnits(r.units) ?? "", r.yN || "", r.compQ || r.compY || ""]);
    const csv = "﻿" + [head, ...body].map((l) => l.map(esc).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "ignatev-estate-analytics.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="ie-wrap" style={{ padding: "30px 0 70px", display: "grid", gap: 20 }}>
      <div className="ie-filterbar" role="group" aria-label="Фильтры аналитики">
        <select aria-label="Локация" value={f.loc} onChange={(e) => set("loc", e.target.value)}>
          <option value="">Все локации</option>
          {locOpts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Тип" value={f.type} onChange={(e) => set("type", e.target.value)}>
          <option value="">Все типы</option>
          {Object.entries(TYPE_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Стадия" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
          <option value="">Любая стадия</option>
          {Object.entries(STAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Застройщик" value={f.dev} onChange={(e) => set("dev", e.target.value)}>
          <option value="">Все застройщики</option>
          {devOpts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Год сдачи" value={f.year} onChange={(e) => set("year", e.target.value)}>
          <option value="">Любой год сдачи</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {active ? <button type="button" className="ie-btn ie-btn--line" onClick={() => router.replace(pathname, { scroll: false })}>Сбросить</button> : null}
        <button type="button" className="ie-btn ie-btn--ink" style={{ marginLeft: "auto" }} onClick={exportCsv}>Скачать CSV ({sorted.length})</button>
      </div>

      <div className="ie-kpis" aria-live="polite">
        <div className="ie-kpi"><small>Проектов</small><b>{s.projects}</b><span>{s.stage.ready} сдано · {s.stage.building} строится · {s.stage.offplan} старт · {s.stage.unknown} стадия уточняется</span></div>
        <div className="ie-kpi"><small>Локаций</small><b>{s.locations}</b><span>в выборке</span></div>
        <div className="ie-kpi"><small>Застройщиков</small><b>{s.developers}</b><span>в выборке</span></div>
        <div className="ie-kpi"><small>Медиана цены</small><b>{fmtM(s.price.median)}</b><span>от {fmtM(s.price.min)} до {fmtM(s.price.max)} (n={s.price.n})</span></div>
        <div className="ie-kpi"><small>Цена за м²</small><b>{s.perSqm.median ? `฿${fmtInt(s.perSqm.median)}` : "—"}</b><span>медиана, n={s.perSqm.n}</span></div>
        <div className="ie-kpi"><small>Доходность (заявл.)</small><b>{fmtPct(s.yield.avg)}</b><span>среднее, n={s.yield.n}</span></div>
        <div className="ie-kpi"><small>Лотов</small><b>{fmtInt(s.units.total)}</b><span>данные по {s.units.coveredProjects} из {s.projects} проект.</span></div>
      </div>

      <div className="ie-two">
        <section className="ie-card">
          <h2 className="ie-h2">Проекты по локациям</h2>
          <Bars items={byLoc.slice(0, 14).map((g) => ({ key: g.key, label: locNames[g.key] ?? g.label, value: g.projects, sub: `медиана ${fmtM(g.median)}` }))} href={(k) => `/locations/${k}`} />
        </section>
        <section className="ie-card">
          <h2 className="ie-h2">Медиана цены по локациям, млн ฿</h2>
          <Bars
            color="#1b6f80"
            items={byLoc.filter((g) => g.median != null).sort((a, b) => (b.median ?? 0) - (a.median ?? 0)).slice(0, 14).map((g) => ({ key: g.key, label: locNames[g.key] ?? g.label, value: Math.round((g.median ?? 0) * 10) / 10, sub: `${g.projects} проект.` }))}
            href={(k) => `/locations/${k}`}
          />
        </section>
        <section className="ie-card">
          <h2 className="ie-h2">Распределение по цене</h2>
          <Bars items={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.projects }))} />
          <h3 className="ie-h3" style={{ marginTop: 18 }}>По типу</h3>
          <Bars color="#1b6f80" items={Object.entries(s.byType).map(([k, v]) => ({ key: k, label: TYPE_RU[k] ?? k, value: v }))} />
        </section>
        <section className="ie-card">
          <h2 className="ie-h2">Сдача по годам</h2>
          <Bars items={s.byYear.map((y) => ({ key: String(y.year), label: String(y.year), value: y.projects, sub: `${fmtInt(y.units)} лотов` }))} />
          <p className="ie-small">Показаны проекты; в подсказке лоты, где они указаны.</p>
        </section>
      </div>

      <section className="ie-card">
        <h2 className="ie-h2">Застройщики</h2>
        <div className="ie-tbl-scroll">
          <table className="ie-table">
            <thead><tr><th>Застройщик</th><th>Проектов</th><th>Сдано</th><th>Медиана цены</th><th>Доходность</th></tr></thead>
            <tbody>
              {byDev.slice(0, 15).map((g) => (
                <tr key={g.key}><td><Link href={`/developers/${g.key}`} className="ie-ulink">{g.label}</Link></td><td>{g.projects}</td><td>{g.ready}</td><td>{fmtM(g.median)}</td><td>{fmtPct(g.yieldAvg)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ie-card">
        <h2 className="ie-h2">Все проекты ({sorted.length})</h2>
        <div className="ie-tbl-scroll">
          <table className="ie-table ie-sortable">
            <thead><tr>{th("n", "Проект")}{th("loc", "Локация")}{th("dev", "Застройщик")}{th("price", "Цена от")}{th("sqm", "₿/м²")}{th("units", "Лотов")}{th("yield", "Дох-ть")}{th("year", "Сдача")}</tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td><Link href={r.href} className="ie-ulink" prefetch={false}>{r.n}</Link></td>
                  <td><Link href={`/locations/${r.slug}`}>{r.locRu}</Link></td>
                  <td><Link href={`/developers/${developerSlug(r.dt)}`}>{r.dev}</Link></td>
                  <td>{r.pN ? fmtM(r.pN) : r.pT}</td>
                  <td>{parseSqmPrice(r.sqmP) ? fmtInt(parseSqmPrice(r.sqmP)) : "—"}</td>
                  <td>{parseUnits(r.units) ?? "—"}</td>
                  <td>{r.yN ? fmtPct(r.yN) : "—"}</td>
                  <td>{r.compQ && r.compQ !== String(r.compY) ? r.compQ : r.compY ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ie-small">Цены в миллионах тайских батов. Показатели доходности заявлены застройщиками и не проверялись реестром. Пустые значения означают, что застройщик не внёс данные, а не ноль.</p>
      </section>
    </div>
  );
}
