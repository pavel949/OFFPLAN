import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { PageIntro } from "@/components/ui";
import { CLEARVIEW_SERVICES } from "@/lib/clearview/services";

export const metadata: Metadata = {
  title: "Услуги покупателям и застройщикам · ClearView — Ignatev Estate",
  description: "Подбор недвижимости, проверка по заказу застройщика и аудит покупателя: состав работы, стоимость и текущая доступность.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return <div className="ie-page">
    <SiteHeader />
    <PageIntro eyebrow="OFFPLAN · ClearView" title="От выбора проекта к проверке решения" description="Платформа помогает сравнивать предложения, видеть источники и задавать вопросы до покупки. Подбор недвижимости, проверка застройщика и аудит покупателя — три разных направления работы." breadcrumbs={<><Link href="/">Каталог</Link><span>/</span><span>Услуги</span></>} />
    <div className="ie-wrap cv-pub" style={{ paddingTop: 40 }}>
      <section><h2>Кому и чем мы помогаем</h2><div className="cv-cards">
        {CLEARVIEW_SERVICES.map(service => <article className="cv-card" key={service.id} id={service.id}>
          <span className="cv-pill">{service.audience}</span><h3>{service.title}</h3>
          <p><b>{service.price}</b></p><p>{service.description}</p><p>{service.output}</p>
          {"monitoring" in service ? <><h4>Дальнейшее сопровождение</h4><p>{service.monitoring}</p></> : null}
          <p className="cv-note">{service.status}</p><Link className="ie-btn ie-btn--line" href={service.href}>{service.action}</Link>
        </article>)}
      </div></section>
      <section><h2>Кто присваивает рейтинг</h2><p>ClearView — собственная методология платформы. Оценку и итоговое решение принимает команда Ignatev Estate. AV Group — партнёр рейтинга ClearView. Это обозначение не означает, что AV Group проверила или подписала каждый отчёт.</p><p>В отчёте по конкретному проекту должны быть названы фактические исполнители, заказчик, источники, дата и ограничения. Размещение в каталоге, передача документов и оплата услуги не означают присвоения рейтинга.</p><Link className="ie-btn ie-btn--gold" href="/methodology#calculation">Что проверяем и как считаем</Link></section>
      <section><h2>Что покупатель видит бесплатно</h2><p>Каталог, публичные источники и даты, сведения о предложениях при наличии опубликованных условий, список недостающих документов и быструю самопроверку. Неизвестные сведения не выдаются за подтверждённые факты, а ответы анкеты — за рейтинг.</p><p>Платный отчёт, публикация его резюме и регулярное сопровождение требуют отдельного согласования. Эта страница не оформляет заказ, не принимает оплату и не гарантирует доступность услуги или срок её выполнения.</p></section>
    </div><SiteFooter />
  </div>;
}
