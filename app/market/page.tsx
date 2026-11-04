export const dynamic = "force-dynamic";
import fs from "fs";
import path from "path";
import { Suspense } from "react";
import { CatalogueShell } from "@/components/catalogue/CatalogueShell";
import {
  getCatalogHeadlineFromDb,
  getCatalogMeta,
  getProjects,
  getPublicRatingMethodology,
} from "@/lib/catalog";

function loadTabHtml(name: string): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), `content/html-tabs/${name}.html`),
      "utf8",
    );
  } catch {
    return `<p class="text-sm opacity-70">Tab “${name}” could not be loaded.</p>`;
  }
}

export const metadata = {
  title: "Аналитика рынка и калькулятор — Ignatev Estate",
};

export default async function MarketPage() {
  const [projects, methodology, headline] = await Promise.all([
    getProjects(),
    getPublicRatingMethodology(),
    getCatalogHeadlineFromDb(),
  ]);
  const baseMeta = getCatalogMeta(projects);
  const meta = headline
    ? {
        ...baseMeta,
        totalValueBnTHB: headline.totalValueBnTHB,
        quarterLabel: headline.quarterLabel,
      }
    : baseMeta;
  const zones = [...new Set(projects.map((p) => p.zone))].sort();
  const htmlTabs = {
    analytics: loadTabHtml("analytics"),
    risk: loadTabHtml("risk"),
    devs: loadTabHtml("devs"),
    services: loadTabHtml("services"),
    calcBenchmarks: loadTabHtml("calc-benchmarks"),
  };

  return (
    <Suspense
      fallback={
        <div
          className="layout"
          style={{ paddingTop: 80, paddingLeft: 14, color: "var(--ink)" }}
        >
          Loading…
        </div>
      }
    >
      <CatalogueShell
        projects={projects}
        meta={meta}
        zones={zones}
        htmlTabs={htmlTabs}
        methodologyRu={methodology?.ru}
        methodologyEn={methodology?.en}
      />
    </Suspense>
  );
}
