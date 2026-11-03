"use client";
import { useState } from "react";
import Link from "next/link";
import {
  operatingCostTotals,
  type ProjectEvidence,
} from "@/lib/project-evidence";
import type { PublicProjectFacts } from "@/lib/project-facts-query";
import { projectSlug } from "@/lib/slug";
const stages: Record<string, string> = {
  prelaunch: "До старта продаж",
  launch: "Старт продаж",
  selling: "Продажи идут",
  last_units: "Последние лоты",
  sold_out: "Продано",
};
export function ProjectFacts({
  data,
  lang,
}: {
  data: PublicProjectFacts;
  lang: "ru" | "en";
}) {
  const [sqm, setSqm] = useState("");
  const ru = lang === "ru";
  const costs = data.facts.filter((x) => x.kind === "operating_cost");
  const amenities = data.facts.filter((x) => x.kind === "amenity");
  const sales = data.facts.find((x) => x.kind === "sales");
  const totals = operatingCostTotals(costs, sqm.trim() ? Number(sqm) : null);
  const source = (f: ProjectEvidence) => (
    <small className="block text-[var(--muted)]">
      <a href={f.source_url} target="_blank" rel="noopener noreferrer">
        {ru ? "Источник" : "Source"}
      </a>{" "}
      · {f.observed_at}
    </small>
  );
  return (
    <section className="space-y-6 py-5">
      {data.error ? (
        <p role="status">
          {ru
            ? "Часть данных временно недоступна."
            : "Some data is temporarily unavailable."}
        </p>
      ) : null}
      <div>
        <h2 className="text-xl">
          {ru ? "Продажи и остатки" : "Sales and inventory"}
        </h2>
        {sales ? (
          <p>
            {ru
              ? stages[String(sales.details.stage)]
              : String(sales.details.stage)}
            {typeof sales.details.starts_at === "string"
              ? ` · ${sales.details.starts_at}`
              : ""}
            {source(sales)}
          </p>
        ) : (
          <p>
            {ru
              ? "Стадия продаж не подтверждена."
              : "Sales stage has not been confirmed."}
          </p>
        )}
        {data.inventory ? (
          <>
            <p>
              {ru ? "Внесённые лоты" : "Recorded units"}:{" "}
              {data.inventory.recorded} · {ru ? "свободно" : "available"}{" "}
              {data.inventory.available} · {ru ? "бронь" : "reserved"}{" "}
              {data.inventory.reserved} · {ru ? "продано" : "sold"}{" "}
              {data.inventory.sold}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {ru
                ? "Это только внесённые в систему лоты, а не полный объём проекта. Доля проданных не рассчитывается без подтверждённого полного реестра."
                : "These counts cover recorded units, not necessarily the entire project."}
            </p>
          </>
        ) : (
          <p>
            {ru
              ? "Застройщик ещё не предоставил инвентарь. Остатки неизвестны."
              : "The developer has not supplied inventory. Availability is unknown."}
          </p>
        )}
      </div>
      <div>
        <h2 className="text-xl">
          {ru ? "Инфраструктура и преимущества" : "Amenities and features"}
        </h2>
        {amenities.length ? (
          <ul>
            {amenities.map((f) => (
              <li key={f.id}>
                <b>{f.title}</b> — {String(f.details.description ?? "")}
                {source(f)}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {ru
              ? "Подтверждённая спецификация пока не предоставлена."
              : "A confirmed specification has not been supplied."}
          </p>
        )}
      </div>
      <div>
        <h2 className="text-xl">
          {ru ? "Расходы владения" : "Ownership costs"}
        </h2>
        {costs.length ? (
          <>
            <label>
              {ru ? "Площадь выбранного лота, м²" : "Selected unit area, sqm"}
              <input
                className="admin-inp"
                type="number"
                min="0.01"
                step="0.01"
                value={sqm}
                onChange={(e) => setSqm(e.target.value)}
              />
            </label>
            <ul>
              {costs.map((f) => (
                <li key={f.id}>
                  {f.title}: {Number(f.details.amount).toLocaleString()}{" "}
                  {String(f.details.currency)} / {String(f.details.basis)} /{" "}
                  {String(f.details.period)}
                  {source(f)}
                </li>
              ))}
            </ul>
            {totals.map((t) => (
              <p key={t.currency}>
                {t.needsArea
                  ? ru
                    ? "Для расчёта укажите площадь."
                    : "Enter an area to calculate."
                  : `${ru ? "Известные ежегодные расходы" : "Known annual costs"}: ${t.annual.toLocaleString()} ${t.currency} · ${ru ? "Разовые" : "One-off"}: ${t.once.toLocaleString()} ${t.currency}`}
              </p>
            ))}
            <p className="text-sm">
              {ru
                ? "Сумма включает только перечисленные подтверждённые статьи. Электричество, вода, налоги, страхование и другие непредоставленные расходы в неё не входят."
                : "Totals include listed confirmed items only. Unspecified utilities, taxes, insurance and other costs are excluded."}
            </p>
          </>
        ) : (
          <p>
            {ru
              ? "Тарифы эксплуатации не предоставлены. Нулевые расходы не предполагаются."
              : "Operating rates have not been supplied. Costs are unknown, not zero."}
          </p>
        )}
      </div>
      <div>
        <h2 className="text-xl">
          {ru ? "Другие проекты застройщика" : "Other developer projects"}
        </h2>
        {data.developerProjects.length ? (
          <ul>
            {data.developerProjects.map((x) => (
              <li key={x.legacy_id}>
                <Link
                  className="underline"
                  href={`/project/${projectSlug({ n: x.payload.n, id: x.legacy_id })}`}
                >
                  {x.payload.n}
                </Link>{" "}
                · {x.payload.stK}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {ru
              ? "Других опубликованных проектов с подтверждённой связью с этим застройщиком нет."
              : "No other published projects are linked to this developer."}
          </p>
        )}
      </div>
    </section>
  );
}
