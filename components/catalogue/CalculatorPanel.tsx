"use client";

import { useMemo, useState } from "react";
import { computeStrCalc, costBarSegments } from "@/lib/str-calc";
import { fmtTHB } from "@/lib/format";

export function CalculatorPanel({
  lang,
  benchmarksHtml,
}: {
  lang: "en" | "ru";
  benchmarksHtml: string;
}) {
  const ru = lang === "ru";
  const [price, setPrice] = useState(10_000_000);
  const [sqm, setSqm] = useState(45);
  const [adr, setAdr] = useState(3500);
  const [occ, setOcc] = useState(68);
  const [mgmt, setMgmt] = useState(40);
  const [cam, setCam] = useState(80);
  const [app, setApp] = useState(6);

  const r = useMemo(
    () =>
      computeStrCalc({
        price,
        sqm,
        adr,
        occPct: occ,
        mgmtPct: mgmt,
        camPerSqmMonth: cam,
        appreciationPct: app,
      }),
    [price, sqm, adr, occ, mgmt, cam, app],
  );

  const bar = costBarSegments(r);
  const totalFlex =
    bar.mgmt + bar.cam + bar.tax + bar.net > 0
      ? bar.mgmt + bar.cam + bar.tax + bar.net
      : 1;

  return (
    <div className="content" style={{ padding: 14 }}>
      <div className="sh">
        <span className="i-en">🧮 Investment Calculator</span>
        <span className="i-ru">🧮 Инвестиционный калькулятор</span>
      </div>
      <p className="ss">
        <span className="i-en">
          Net yield & payback period based on real Phuket STR operating costs ·
          Adjust all inputs for your scenario
        </span>
        <span className="i-ru">
          Чистая доходность и срок окупаемости с учётом реальных операционных
          расходов Пхукета · Меняйте параметры под ваш сценарий
        </span>
      </p>

      <div className="calc-grid">
        <div className="calc-panel">
          <div className="calc-title">
            <span className="i-en">Property Parameters</span>
            <span className="i-ru">Параметры объекта</span>
          </div>

          <SliderRow
            labelEn="Purchase Price (฿)"
            labelRu="Цена покупки (฿)"
            value={price}
            min={2_000_000}
            max={100_000_000}
            step={500_000}
            display={fmtTHB(price)}
            onChange={setPrice}
          />
          <SliderRow
            labelEn="Unit Size (sqm)"
            labelRu="Площадь (м²)"
            value={sqm}
            min={25}
            max={300}
            step={5}
            display={String(sqm)}
            onChange={setSqm}
          />
          <SliderRow
            labelEn="Average Daily Rate (฿ / night)"
            labelRu="Средняя цена ночи (฿)"
            value={adr}
            min={1000}
            max={20000}
            step={250}
            display={fmtTHB(adr)}
            onChange={setAdr}
          />
          <SliderRow
            labelEn="Occupancy Rate"
            labelRu="Заполняемость"
            value={occ}
            min={40}
            max={90}
            step={1}
            display={`${occ}%`}
            onChange={setOcc}
          />
          <SliderRow
            labelEn="Management Fee (% of gross)"
            labelRu="Комиссия управляющего (%)"
            value={mgmt}
            min={15}
            max={60}
            step={1}
            display={`${mgmt}%`}
            onChange={setMgmt}
          />
          <SliderRow
            labelEn="CAM Fee (฿/sqm/month)"
            labelRu="Общие расходы (฿/м²/мес)"
            value={cam}
            min={40}
            max={150}
            step={5}
            display={String(cam)}
            onChange={setCam}
          />
          <SliderRow
            labelEn="Annual Appreciation"
            labelRu="Прирост стоимости в год"
            value={app}
            min={0}
            max={15}
            step={0.5}
            display={`${app}%`}
            onChange={setApp}
          />
        </div>

        <div className="calc-panel">
          <div className="calc-title">
            <span className="i-en">Results · Year 1</span>
            <span className="i-ru">Результаты · Год 1</span>
          </div>
          <div className="calc-result-grid">
            <div className="cr highlight">
              <div className="cr-v">{r.netYieldPct.toFixed(1)}%</div>
              <div className="cr-l">
                <span className="i-en">Net Yield</span>
                <span className="i-ru">Чистая доходность</span>
              </div>
            </div>
            <div className="cr highlight">
              <div className="cr-v">{r.grossYieldPct.toFixed(1)}%</div>
              <div className="cr-l">
                <span className="i-en">Gross Yield</span>
                <span className="i-ru">Валовая доходность</span>
              </div>
            </div>
            <div className="cr">
              <div className="cr-v">{fmtTHB(r.grossIncome)}</div>
              <div className="cr-l">
                <span className="i-en">Gross Income / yr</span>
                <span className="i-ru">Валовой доход / год</span>
              </div>
            </div>
            <div className="cr">
              <div className="cr-v">{fmtTHB(r.netIncome)}</div>
              <div className="cr-l">
                <span className="i-en">Net Income / yr</span>
                <span className="i-ru">Чистый доход / год</span>
              </div>
            </div>
            <div className="cr">
              <div className="cr-v">{fmtTHB(r.camAnnual)}</div>
              <div className="cr-l">
                <span className="i-en">CAM / yr</span>
                <span className="i-ru">Расходы / год</span>
              </div>
            </div>
            <div className="cr">
              <div className="cr-v">{fmtTHB(r.tax)}</div>
              <div className="cr-l">
                <span className="i-en">Rental Tax 12.5%</span>
                <span className="i-ru">Налог 12,5%</span>
              </div>
            </div>
            <div className="cr">
              <div className="cr-v">
                {r.paybackYears != null && r.paybackYears < 100
                  ? (ru ? r.paybackYears.toFixed(1).replace(".", ",") : r.paybackYears.toFixed(1)) + (ru ? " года" : " yrs")
                  : "—"}
              </div>
              <div className="cr-l">
                <span className="i-en">Payback (yield only)</span>
                <span className="i-ru">Окупаемость (доходность)</span>
              </div>
            </div>
            <div className="cr highlight">
              <div className="cr-v">{fmtTHB(r.exit5)}</div>
              <div className="cr-l">
                <span className="i-en">Exit Value (5yr)</span>
                <span className="i-ru">Стоимость продажи через 5 лет</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, background: "var(--sur2)", borderRadius: "var(--rs)", padding: 10 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--gold)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              <span className="i-en">Cost Breakdown</span>
              <span className="i-ru">Структура расходов</span>
            </div>
            <div
              style={{
                display: "flex",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 8,
                gap: 1,
              }}
            >
              <div
                style={{
                  flex: r.costTotal > 0 ? bar.mgmt / totalFlex : 0,
                  background: "var(--red)",
                }}
              />
              <div
                style={{
                  flex: r.costTotal > 0 ? bar.cam / totalFlex : 0,
                  background: "var(--amb)",
                }}
              />
              <div
                style={{
                  flex: r.costTotal > 0 ? bar.tax / totalFlex : 0,
                  background: "var(--pur)",
                }}
              />
              <div
                style={{
                  flex: r.costTotal > 0 ? bar.net / totalFlex : 0,
                  background: "var(--grn)",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--txt2)",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span>
                {ru ? "Управление" : "Mgmt"}{" "}
                {r.costTotal > 0 ? ((bar.mgmt / totalFlex) * 100).toFixed(0) : 0}
                %
              </span>
              <span>
                CAM{" "}
                {r.costTotal > 0 ? ((bar.cam / totalFlex) * 100).toFixed(0) : 0}
                %
              </span>
              <span>
                {ru ? "Налог" : "Tax"}{" "}
                {r.costTotal > 0 ? ((bar.tax / totalFlex) * 100).toFixed(0) : 0}
                %
              </span>
              <span>
                {ru ? "Чистый" : "Net"}{" "}
                {r.costTotal > 0 ? ((bar.net / totalFlex) * 100).toFixed(0) : 0}
                %
              </span>
            </div>
          </div>

          <div className="calc-note">
            <span className="i-en">
              Net yield = Gross income × (1 − Mgmt%) − CAM − Tax 12.5% on net.
              Occupancy: Phuket market range 55–80% depending on zone and
              management quality. Appreciation: Cherngtalay/Bang Tao avg 8–12%
              last 18mo (Siam Expat 2026).
            </span>
            <span className="i-ru">
              Чистая доходность = валовой доход × (1 − комиссия управляющей
              компании, %) − CAM (эксплуатационные взносы) − налог 12,5%.
              Заполняемость: 55–80% в зависимости от района. Рост цен:
              Чернгталай / Банг-Тао +8–12% за 18 месяцев (Siam Expat, 2026).
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <a
              href="https://wa.me/66922407355?text=Calculation+request"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                background: "var(--ui-action)",
                color: "var(--ui-on-action)",
                padding: 10,
                borderRadius: "var(--rs)",
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              <span className="i-en">📞 Get Real Comparable Data from Ignatev Estate</span>
              <span className="i-ru">📞 Запросить реальные данные у Ignatev Estate</span>
            </a>
          </div>
        </div>
      </div>

      <div dangerouslySetInnerHTML={{ __html: benchmarksHtml }} />

      {ru ? (
        <style>{`[data-lang="ru"] .i-en{display:none!important}`}</style>
      ) : null}
    </div>
  );
}

function SliderRow({
  labelEn,
  labelRu,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  labelEn: string;
  labelRu: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="calc-row">
      <div className="calc-lbl">
        <span className="i-en">{labelEn}</span>
        <span className="i-ru">{labelRu}</span>{" "}
        <span>{display}</span>
      </div>
      <input
        type="range"
        className="calc-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
