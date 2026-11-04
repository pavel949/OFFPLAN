"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cvDeleteDraft, cvSaveDraft, cvSubmit } from "@/app/actions/cv-methodology";
import { BENCHMARKS } from "@/lib/clearview/benchmarks";
import { validateConfig, type CvConfig, type Mod, type Tier } from "@/lib/clearview/config";
import { TIER_ORDER, TIER_RU, assess } from "@/lib/clearview/engine";
import type { DomainCode, RiskItem } from "@/lib/clearview/registry";
import { DualBars, TIER_COLOR, TierLadder } from "./charts";

type Tab = "domains" | "items" | "mods" | "scale" | "quick";
const TABS: [Tab, string][] = [["domains", "Домены и веса"], ["items", "Пункты риска"], ["mods", "Поправки"], ["scale", "Шкала и калибровка"], ["quick", "Быстрая оценка"]];
const DOMAIN_COLORS = ["#1b3a6b", "#2f5fa8", "#1f7a45", "#5b6b85", "#b8872a", "#17717f", "#7a8f3a", "#3d6b7a", "#6a4aa3"];
const GROUPS: { key: "stageMod" | "kindMod" | "buyerMod"; title: string; hint: string; labels: Record<string, string> }[] = [
  { key: "stageMod", title: "Стадия проекта", hint: "Как меняется важность областей по мере стройки.", labels: { prelaunch: "Предстарт", early: "Начало (1–30%)", mid: "Середина (31–70%)", late: "Завершение (71–99%)", completed: "Сдан" } },
  { key: "kindMod", title: "Тип проекта", hint: "Поправки для лизхолда, вилл, отелей, брендов.", labels: { condo_leasehold: "Кондо на аренде земли", villa_company: "Вилла через компанию", villa_usufruct: "Вилла: узуфрукт/суперфиций", mixed_hotel: "Отель + жильё", rental_pool: "Пул аренды (не бренд)", branded: "Брендированная резиденция" } },
  { key: "buyerMod", title: "Профиль покупателя", hint: "Только «персональная линза»: в официальную оценку не входит.", labels: { investor: "Инвестор", personal: "Для себя", capital_preservation: "Сохранение капитала" } },
];
const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(1));

/** Human-readable diff between two configurations (what an approver has to read). */
export function diffConfig(base: CvConfig, next: CvConfig): string[] {
  const out: string[] = [];
  for (const d of next.domains) {
    const b = base.domains.find((x) => x.code === d.code);
    if (b && Math.abs(b.base - d.base) > 1e-9) out.push(`Вес ${d.code}: ${(b.base * 100).toFixed(1)}% → ${(d.base * 100).toFixed(1)}%`);
  }
  for (const it of next.items) {
    const b = base.items.find((x) => x.code === it.code);
    if (!b) { out.push(`Новый пункт ${it.code}`); continue; }
    const ch = (["P", "S", "O", "weight"] as const).filter((k) => b[k] !== it[k]).map((k) => `${k === "weight" ? "вес" : k} ${b[k]}→${it[k]}`);
    if (ch.length) out.push(`Пункт ${it.code}: ${ch.join(", ")}`);
  }
  for (const b of base.items) if (!next.items.some((x) => x.code === b.code)) out.push(`Удалён пункт ${b.code}`);
  for (const g of GROUPS) for (const [k, m] of Object.entries(next[g.key])) {
    const bm = (base[g.key] as Record<string, Mod>)[k] ?? {};
    for (const d of next.domains) if ((bm[d.code] ?? 0) !== ((m as Mod)[d.code] ?? 0)) out.push(`${g.title} «${g.labels[k] ?? k}», ${d.code}: ${bm[d.code] ?? 0} → ${(m as Mod)[d.code] ?? 0}`);
  }
  for (const t of Object.keys(next.tiers) as (keyof CvConfig["tiers"])[]) if (base.tiers[t] !== next.tiers[t]) out.push(`Порог «${TIER_RU[t as Tier].label}»: ${base.tiers[t]} → ${next.tiers[t]}`);
  if (base.calibration !== next.calibration) out.push(`Калибровка шкалы: ${base.calibration} → ${next.calibration}`);
  if (base.weightFloorShare !== next.weightFloorShare) out.push(`Нижняя граница веса: ${base.weightFloorShare} → ${next.weightFloorShare}`);
  if (JSON.stringify(base.tierCaps) !== JSON.stringify(next.tierCaps)) out.push("Изменены ограничения по слабым доменам");
  for (const k of Object.keys(next.evidenceC) as (keyof CvConfig["evidenceC"])[]) if (base.evidenceC[k] !== next.evidenceC[k]) out.push(`Коэффициент доказательств «${k}»: ${base.evidenceC[k]} → ${next.evidenceC[k]}`);
  for (const k of Object.keys(next.absentP) as (keyof CvConfig["absentP"])[]) if (base.absentP[k] !== next.absentP[k]) out.push(`P при «отсутствует» и доказательстве «${k}»: ${base.absentP[k] ?? "по умолчанию"} → ${next.absentP[k] ?? "по умолчанию"}`);
  return out;
}

export function MethodologyStudio({
  id, initial, baseline, baselineLabel, status, mode = "edit", children,
}: { id: string; initial: CvConfig; baseline: CvConfig; baselineLabel: string; status: string; mode?: "edit" | "review"; children?: React.ReactNode }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<CvConfig>(initial);
  const [tab, setTab] = useState<Tab>("domains");
  const [bench, setBench] = useState(BENCHMARKS[0].id);
  const [filter, setFilter] = useState({ domain: "", q: "" });
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const editable = mode === "edit" && status === "draft";

  const validation = useMemo(() => validateConfig(cfg), [cfg]);
  const diff = useMemo(() => diffConfig(baseline, cfg), [baseline, cfg]);
  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(initial), [cfg, initial]);
  const sims = useMemo(
    () => BENCHMARKS.map((b) => ({ b, before: assess(b.build(baseline), baseline), after: assess(b.build(cfg), cfg) })),
    [baseline, cfg],
  );
  const shifted = sims.filter((s) => (s.before.composite != null && s.after.composite != null && Math.abs(s.after.composite - s.before.composite) > 5) || s.before.tier !== s.after.tier).length;
  const selected = sims.find((s) => s.b.id === bench) ?? sims[0];

  const upd = (fn: (c: CvConfig) => CvConfig) => setCfg((c) => fn(structuredClone(c)));
  const setItem = (code: string, patch: Partial<RiskItem>) => upd((c) => { const it = c.items.find((i) => i.code === code); if (it) Object.assign(it, patch); return c; });
  const baseItem = (code: string) => baseline.items.find((i) => i.code === code);
  const sumBase = cfg.domains.reduce((s, d) => s + d.base, 0);

  function save() {
    start(async () => {
      const r = await cvSaveDraft(id, cfg);
      setMsg(r.ok ? { ok: true, text: "Черновик сохранён" } : { ok: false, text: r.error ?? "Ошибка" });
      if (r.ok) router.refresh();
    });
  }
  function submit() {
    start(async () => {
      const r = await cvSubmit(id, cfg, summary);
      setMsg(r.ok ? { ok: true, text: "Отправлено аналитикам на утверждение" } : { ok: false, text: r.error ?? "Ошибка" });
      if (r.ok) router.refresh();
    });
  }
  function remove() {
    if (!confirm("Удалить этот черновик?")) return;
    start(async () => {
      const r = await cvDeleteDraft(id);
      if (r.ok) router.push("/admin/methodology");
      else setMsg({ ok: false, text: r.error ?? "Ошибка" });
    });
  }

  const itemsShown = cfg.items.filter((i) => (!filter.domain || i.domain === filter.domain) && (!filter.q || `${i.code} ${i.title}`.toLowerCase().includes(filter.q.toLowerCase())));

  return (
    <div className="cv-studio">
      <div>
        <nav className="adm-tabs" aria-label="Разделы методологии">
          {TABS.map(([k, label]) => <button key={k} type="button" className={`adm-tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)} style={{ background: "none", border: 0, borderBottom: "2px solid transparent", cursor: "pointer" }}>{label}</button>)}
        </nav>

        {tab === "domains" ? (
          <section className="adm-card">
            <h3>Базовые веса девяти областей</h3>
            <p className="adm-lead">Вес показывает, насколько область влияет на итог. Сумма должна быть 100%. Затем веса сдвигаются поправками по стадии и типу проекта.</p>
            <div className="cv-sum" aria-label="Распределение весов">
              {cfg.domains.map((d, i) => <i key={d.code} style={{ width: `${(d.base / sumBase) * 100}%`, background: DOMAIN_COLORS[i] }} title={`${d.code}: ${(d.base * 100).toFixed(1)}%`}>{d.base >= 0.05 ? d.code : ""}</i>)}
            </div>
            <table className="adm-table">
              <thead><tr><th>Область</th><th className="num">Было</th><th className="num">Вес, %</th><th>Пунктов</th></tr></thead>
              <tbody>
                {cfg.domains.map((d) => {
                  const b = baseline.domains.find((x) => x.code === d.code);
                  const ch = b && Math.abs(b.base - d.base) > 1e-9;
                  return (
                    <tr key={d.code} className={ch ? "cv-changed" : ""}>
                      <td><b>{d.code}</b> {d.ru}</td>
                      <td className="num">{b ? (b.base * 100).toFixed(1) : "—"}</td>
                      <td className="num"><input className="adm-cell cv-num" type="number" step="0.5" min={0} max={50} disabled={!editable} value={Math.round(d.base * 1000) / 10} onChange={(e) => upd((c) => { c.domains.find((x) => x.code === d.code)!.base = Number(e.target.value) / 100; return c; })} /></td>
                      <td>{cfg.items.filter((i) => i.domain === d.code).length}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td><b>Сумма</b></td><td /><td className={`num ${Math.abs(sumBase - 1) > 1e-6 ? "adm-zero" : ""}`}><b>{(sumBase * 100).toFixed(1)}%</b></td><td>
                {editable && Math.abs(sumBase - 1) > 1e-6 ? <button type="button" className="adm-btn adm-btn--line adm-btn--sm" onClick={() => upd((c) => { const s = c.domains.reduce((a, d) => a + d.base, 0); c.domains.forEach((d) => { d.base = d.base / s; }); return c; })}>Нормировать до 100%</button> : null}
              </td></tr></tfoot>
            </table>
          </section>
        ) : null}

        {tab === "items" ? (
          <section className="adm-card">
            <h3>Пункты риска: {cfg.items.length}</h3>
            <p className="adm-lead">P: вероятность, S: тяжесть, O: непрозрачность (1–5). Вес влияет только внутри области. Стоп-условия привязаны к пунктам и здесь не правятся.</p>
            <div className="adm-toolbar">
              <input type="search" placeholder="Поиск по коду или тексту…" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
              <select value={filter.domain} onChange={(e) => setFilter((f) => ({ ...f, domain: e.target.value }))}><option value="">Все области</option>{cfg.domains.map((d) => <option key={d.code} value={d.code}>{d.code} {d.ru}</option>)}</select>
              <span className="adm-count">Показано {itemsShown.length}</span>
            </div>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr><th>Код</th><th>Пункт</th><th>P</th><th>S</th><th>O</th><th className="num">Вес</th><th>Условие</th><th>Сбор данных</th></tr></thead>
                <tbody>
                  {itemsShown.map((it) => {
                    const b = baseItem(it.code);
                    const changed = !b || (["P", "S", "O", "weight"] as const).some((k) => b[k] !== it[k]);
                    const sel = (k: "P" | "S" | "O") => (
                      <select className="adm-cell" style={{ width: 58 }} disabled={!editable} value={it[k]} onChange={(e) => setItem(it.code, { [k]: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
                    );
                    return (
                      <tr key={it.code} className={changed ? "cv-changed" : ""}>
                        <td><b>{it.code}</b></td>
                        <td style={{ minWidth: 260 }}>{it.title}{it.branded ? <span className="cv-chip" style={{ marginLeft: 6 }}>бренд</span> : null}</td>
                        <td>{sel("P")}</td><td>{sel("S")}</td><td>{sel("O")}</td>
                        <td className="num"><input className="adm-cell cv-num" type="number" step="0.1" min={0.1} max={3} disabled={!editable} value={it.weight} onChange={(e) => setItem(it.code, { weight: Number(e.target.value) })} /></td>
                        <td>{it.gate ? <span className="cv-chip bad">{it.gate}</span> : it.cap ? <span className="cv-chip warn">≤{it.cap.max} {it.cap.domain}</span> : "—"}</td>
                        <td><span className={`cv-chip ${it.auto === "data" ? "ok" : it.auto === "ai" ? "warn" : ""}`}>{it.auto === "data" ? "данные" : it.auto === "ai" ? "ИИ + аналитик" : "вручную"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "mods" ? GROUPS.map((g) => (
          <section className="adm-card" key={g.key}>
            <h3>{g.title}</h3>
            <p className="adm-lead">{g.hint} Значения в процентных пунктах веса; сумма по строке должна быть 0, иначе итоговые веса пересчитываются.</p>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr><th>{g.title}</th>{cfg.domains.map((d) => <th key={d.code} className="num">{d.code}</th>)}<th className="num">Σ</th></tr></thead>
                <tbody>
                  {Object.entries(cfg[g.key]).map(([k, m]) => {
                    const net = cfg.domains.reduce((s, d) => s + ((m as Mod)[d.code] ?? 0), 0);
                    return (
                      <tr key={k}>
                        <td style={{ minWidth: 190 }}>{g.labels[k] ?? k}</td>
                        {cfg.domains.map((d) => {
                          const b = ((baseline[g.key] as Record<string, Mod>)[k] ?? {})[d.code] ?? 0;
                          const v = (m as Mod)[d.code] ?? 0;
                          return <td key={d.code} className={v !== b ? "cv-changed" : ""}><input className="adm-cell" style={{ width: 58, textAlign: "right" }} type="number" step="1" disabled={!editable} value={v} onChange={(e) => upd((c) => { ((c[g.key] as Record<string, Mod>)[k] ??= {})[d.code as DomainCode] = Number(e.target.value); return c; })} /></td>;
                        })}
                        <td className={`num ${net !== 0 ? "adm-zero" : ""}`}>{net}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )) : null}

        {tab === "scale" ? (
          <>
            <section className="adm-card">
              <h3>Уровни</h3>
              <p className="adm-lead">Нижняя граница каждого уровня, в баллах. Ниже «Повышенного риска» проект получает «Не рекомендуется».</p>
              <TierLadder low="REJECT" high="PLATINUM" />
              <div className="adm-grid" style={{ marginTop: 14 }}>
                {(Object.keys(cfg.tiers) as (keyof CvConfig["tiers"])[]).map((t) => (
                  <div className="adm-field c3" key={t}><label>{TIER_RU[t as Tier].label}: от</label><input type="number" min={1} max={100} disabled={!editable} value={cfg.tiers[t]} onChange={(e) => upd((c) => { c.tiers[t] = Number(e.target.value); return c; })} /></div>
                ))}
              </div>
            </section>
            <section className="adm-card">
              <h3>Калибровка шкалы</h3>
              <div className="adm-grid">
                <div className="adm-field c6"><label>Нормализация баллов домена</label>
                  <select disabled={!editable} value={cfg.calibration} onChange={(e) => upd((c) => { c.calibration = e.target.value as CvConfig["calibration"]; return c; })}>
                    <option value="stretched">Растянутая: от лучшего до худшего случая области (рекомендуется)</option>
                    <option value="atlas">Как в Atlas v2.1: деление на 37,5</option>
                  </select>
                  <span className="adm-hint">Растянутая шкала делает достижимыми и «Платину», и «Не рекомендуется».</span>
                </div>
                <div className="adm-field c6"><label>Нижняя граница веса после поправок, % от базового</label>
                  <input type="number" min={-1} max={90} step={5} disabled={!editable} value={cfg.weightFloorShare < 0 ? -1 : Math.round(cfg.weightFloorShare * 100)} onChange={(e) => upd((c) => { const v = Number(e.target.value); c.weightFloorShare = v < 0 ? -1 : v / 100; return c; })} />
                  <span className="adm-hint">−1: без границы, как в Atlas (вес может уйти в минус).</span>
                </div>
              </div>
            </section>
            <section className="adm-card">
              <h3>Ограничения по слабым областям</h3>
              <p className="adm-lead">Если область набрала меньше порога, итоговый уровень не может быть выше указанного. Защищает от усреднения одной провальной области.</p>
              <table className="adm-table">
                <thead><tr><th>Область</th><th>Если ниже, баллов</th><th>Итог не выше</th><th /></tr></thead>
                <tbody>
                  {cfg.tierCaps.map((r, i) => (
                    <tr key={i}>
                      <td><select className="adm-cell" disabled={!editable} value={r.domain} onChange={(e) => upd((c) => { c.tierCaps[i].domain = e.target.value as DomainCode; return c; })}>{cfg.domains.map((d) => <option key={d.code} value={d.code}>{d.code} {d.ru}</option>)}</select></td>
                      <td><input className="adm-cell" style={{ width: 80 }} type="number" min={1} max={100} disabled={!editable} value={r.below} onChange={(e) => upd((c) => { c.tierCaps[i].below = Number(e.target.value); return c; })} /></td>
                      <td><select className="adm-cell" disabled={!editable} value={r.max} onChange={(e) => upd((c) => { c.tierCaps[i].max = e.target.value as Tier; return c; })}>{TIER_ORDER.filter((t) => t !== "PLATINUM").map((t) => <option key={t} value={t}>{TIER_RU[t].label}</option>)}</select></td>
                      <td>{editable ? <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => upd((c) => { c.tierCaps.splice(i, 1); return c; })}>✕</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {editable ? <p style={{ marginTop: 10 }}><button type="button" className="adm-btn adm-btn--line adm-btn--sm" onClick={() => upd((c) => { c.tierCaps.push({ domain: "D3", below: 50, max: "BRONZE" }); return c; })}>+ Добавить ограничение</button></p> : null}
            </section>
            <section className="adm-card">
              <h3>Доказательства</h3>
              <p className="adm-lead">Коэффициент риска по надёжности источника (меньше значит надёжнее) и вероятность риска, когда застройщик заявляет, что его нет.</p>
              <table className="adm-table">
                <thead><tr><th>Источник</th><th className="num">Коэффициент C</th><th className="num">P при «риска нет»</th></tr></thead>
                <tbody>
                  {(Object.keys(cfg.evidenceC) as (keyof CvConfig["evidenceC"])[]).map((k) => (
                    <tr key={k}>
                      <td>{({ registry: "Государственный реестр", contract: "Подписанный договор", independent_report: "Независимый отчёт или выезд", developer: "Материалы застройщика", broker: "Слова брокера", analyst: "Вывод аналитика / покупателя", expired: "Просроченное", missing: "Нет доказательств" } as Record<string, string>)[k]}</td>
                      <td className="num"><input className="adm-cell cv-num" type="number" step="0.05" min={0.5} max={2} disabled={!editable} value={cfg.evidenceC[k]} onChange={(e) => upd((c) => { c.evidenceC[k] = Number(e.target.value); return c; })} /></td>
                      <td className="num">{cfg.absentP[k] === null ? <span className="adm-hint">по умолч. пункта</span> : <input className="adm-cell cv-num" type="number" min={1} max={5} disabled={!editable} value={cfg.absentP[k] ?? 1} onChange={(e) => upd((c) => { c.absentP[k] = Number(e.target.value); return c; })} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        {tab === "quick" ? (
          <section className="adm-card">
            <h3>Быстрая оценка: {cfg.quick.length} вопросов</h3>
            <p className="adm-lead">Каждый ответ задаёт состояние пунктов риска. Источник автозаполнения указывает, откуда ответ можно будет брать без участия человека.</p>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr><th>Область</th><th>Вопрос</th><th>Ответы</th><th>Пункты</th><th>Автозаполнение</th></tr></thead>
                <tbody>
                  {cfg.quick.map((q) => {
                    const codes = [...new Set(q.options.flatMap((o) => o.effects.map((e) => e.item)))];
                    const missing = codes.filter((c) => !cfg.items.some((i) => i.code === c));
                    return (
                      <tr key={q.id}>
                        <td><b>{q.domain}</b></td>
                        <td style={{ minWidth: 280 }}>{q.text}</td>
                        <td>{q.options.length}</td>
                        <td>{codes.join(", ")}{missing.length ? <span className="adm-zero"> нет: {missing.join(", ")}</span> : null}</td>
                        <td>{q.autofill ? <span className="cv-chip ok">{({ catalogue: "каталог", gis: "карты и GIS", registry: "реестры", document: "из договора" } as Record<string, string>)[q.autofill]}</span> : <span className="cv-chip">вручную</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <aside className="cv-rail">
        <section className="adm-card" style={{ margin: 0 }}>
          <h3>Проверка</h3>
          {validation.errors.length === 0 && validation.warnings.length === 0 ? <p className="adm-msg ok">Ошибок нет</p> : null}
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, display: "grid", gap: 4 }}>
            {validation.errors.map((e) => <li key={e} className="adm-zero" style={{ fontWeight: 600 }}>{e}</li>)}
            {validation.warnings.map((w) => <li key={w} style={{ color: "var(--amb)" }}>{w}</li>)}
          </ul>
        </section>

        <section className="adm-card" style={{ margin: 0 }}>
          <h3>Влияние на эталонные проекты</h3>
          <p className="adm-hint" style={{ marginBottom: 8 }}>Сравнение с: {baselineLabel}. {shifted ? <b className={shifted >= 3 ? "adm-zero" : ""}>Сдвинулось более чем на 5 баллов или сменило уровень: {shifted} из {sims.length}.{shifted >= 3 ? " Нужна пакетная переоценка выданных оценок." : ""}</b> : "Заметных сдвигов нет."}</p>
          <table className="adm-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Проект</th><th className="num">Было</th><th className="num">Стало</th></tr></thead>
            <tbody>
              {sims.map((s) => (
                <tr key={s.b.id} onClick={() => setBench(s.b.id)} style={{ cursor: "pointer", background: s.b.id === bench ? "rgba(212,173,90,.16)" : undefined }}>
                  <td>{s.b.ru}</td>
                  <td className="num">{fmt(s.before.composite)}<br /><i style={{ fontStyle: "normal", color: s.before.tier ? TIER_COLOR[s.before.tier] : undefined, fontSize: 10 }}>{s.before.tier ? TIER_RU[s.before.tier].label : "не завершено"}</i></td>
                  <td className="num"><b>{fmt(s.after.composite)}</b><br /><i style={{ fontStyle: "normal", color: s.after.tier ? TIER_COLOR[s.after.tier] : undefined, fontSize: 10, fontWeight: 800 }}>{s.after.tier ? TIER_RU[s.after.tier].label : "не завершено"}</i></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-hint" style={{ margin: "10px 0 6px" }}><b>{selected.b.ru}</b>: {selected.b.note}</p>
          {selected.after.status === "rejected" ? <p className="adm-msg err">Стоп-условие: {selected.after.gatesTriggered.join(", ")}</p> : (
            <DualBars rows={cfg.domains.map((d) => ({ label: `${d.code} ${d.ru}`.slice(0, 22), before: selected.before.domainScores[d.code], after: selected.after.domainScores[d.code] }))} />
          )}
          <p className="adm-hint" style={{ marginTop: 6 }}>Серая полоса: было, золотая: стало.</p>
        </section>

        <section className="adm-card" style={{ margin: 0 }}>
          <h3>Изменения: {diff.length}</h3>
          {diff.length === 0 ? <p className="adm-hint">Отличий от базовой версии нет.</p> : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, display: "grid", gap: 3, maxHeight: 240, overflow: "auto" }}>{diff.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
        </section>

        {mode === "review" ? children : (
          <section className="adm-card" style={{ margin: 0 }}>
            <h3>{editable ? "Утверждение" : `Статус: ${status}`}</h3>
            {editable ? (
              <>
                <div className="adm-field"><label>Что изменилось и зачем (для аналитиков)</label><textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Например: растянута шкала, добавлены ограничения по слабым областям" style={{ minHeight: 80 }} /></div>
                <p className="adm-hint" style={{ margin: "8px 0" }}>Версию опубликуют два независимых аналитика. После публикации она неизменяема, а её отпечаток появится на сайте.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="adm-btn adm-btn--line" disabled={busy || !dirty} onClick={save}>Сохранить черновик</button>
                  <button type="button" className="adm-btn" disabled={busy || !validation.ok || summary.trim().length < 20} onClick={submit}>Отправить на утверждение</button>
                  <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={busy} onClick={remove}>Удалить</button>
                </div>
              </>
            ) : <p className="adm-hint">Версия закрыта для правок. Чтобы изменить методологию, создайте новый черновик.</p>}
            {msg ? <p className={`adm-msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 8 }}>{msg.text}</p> : null}
          </section>
        )}
      </aside>
    </div>
  );
}
