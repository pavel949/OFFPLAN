import { PageIntro } from "@/components/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getQuickQuestions } from "@/app/actions/quick-assessment";
import { QuickAssessment } from "@/components/clearview/QuickAssessment";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";

export const metadata: Metadata = {
  title: "Быстрая проверка проекта: вопросы и документы до покупки — Ignatev Estate",
  description: "Пятнадцать вопросов о проекте: возможные стоп-условия, неизвестные сведения и документы, которые стоит запросить до покупки.",
  alternates: { canonical: "/quick-assessment" },
};

export default async function QuickAssessmentPage() {
  const questions = await getQuickQuestions();
  return (
    <div className="ie-page">
      <SiteHeader />
      <PageIntro eyebrow="ClearView · самопроверка" title="Что стоит проверить до покупки" description="15 вопросов о проекте помогут составить список документов. Ответы не становятся рейтингом: неизвестные сведения и подтверждённые факты остаются разными вещами." breadcrumbs={<><Link href="/">Каталог</Link><span>/</span><Link href="/methodology">Методология</Link></>} />
      <section className="ie-section"><div className="ie-wrap" style={{ maxWidth: 900 }}><QuickAssessment questions={questions} /></div></section>
      <SiteFooter />
    </div>
  );
}
