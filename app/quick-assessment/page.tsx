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
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / <Link href="/methodology">Методология</Link></div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>ClearView</div>
          <h1>Быстрая проверка проекта</h1>
          <p>Отметьте, что вам известно о проекте, и получите список вопросов и документов для проверки. Ответ «не знаю» поможет увидеть пробелы. Это самопроверка по вашим ответам, а не рейтинг или подтверждённая оценка ClearView.</p>
        </div>
      </section>
      <section className="ie-section"><div className="ie-wrap" style={{ maxWidth: 900 }}><QuickAssessment questions={questions} /></div></section>
      <SiteFooter />
    </div>
  );
}
