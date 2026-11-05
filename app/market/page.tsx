export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { CatalogueShell } from "@/components/catalogue/CatalogueShell";
import { getProjects } from "@/lib/catalog";

export const metadata = { title: "Проекты, источники и вопросы перед покупкой — Ignatev Estate" };

export default async function MarketPage() {
  const projects = await getProjects();
  return <Suspense fallback={<p role="status">Загружаем каталог…</p>}><CatalogueShell projects={projects} /></Suspense>;
}
