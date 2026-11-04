import type { Metadata } from "next";
import Link from "next/link";
import { getQuickQuestions } from "@/app/actions/quick-assessment";
import { QuickAssessment } from "@/components/clearview/QuickAssessment";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";

export const metadata: Metadata = {
  title: "Быстрая проверка проекта: уровень и главные риски за три минуты — Ignatev Estate",
  description: "Четырнадцать вопросов о проекте: предварительный уровень по методологии ClearView, стоп-условия, слабые области и что проверить в первую очередь.",
  alternates: { canonical: "/quick-assessment" },
};

export default async function QuickAssessmentPage() {
  const questions = await getQuickQuestions();
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / <Link href="/methodology">Методология</Link></div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>ClearView</div>
          <h1>Быстрая проверка проекта</h1>
          <p>Предварительный уровень и главные риски по вашим ответам. Это не оценка ClearView, а способ понять, на что смотреть до проверки документов.</p>
        </div>
      </section>
      <section className="ie-section"><div className="ie-wrap" style={{ maxWidth: 900 }}><QuickAssessment questions={questions} /></div></section>
      <SiteFooter />
    </div>
  );
}
