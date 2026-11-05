export const dynamic = "force-dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { HomeExperience } from "@/components/ie/HomeExperience";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { ActionLink, SectionHeading, Surface } from "@/components/ui";
import { getProjects } from "@/lib/catalog";
import { getHomeFeed } from "@/lib/home-feed";
import { GUIDE } from "@/lib/guide-content";
import { projectSlug } from "@/lib/slug";

export default async function Home() {
  const [projects, feed] = await Promise.all([getProjects(), getHomeFeed()]);
  const byId = new Map(projects.map(p => [p.id, p]));
  const news = feed.updates.filter(u => byId.has(u.projectId)).slice(0, 3);
  return <div className="ie-page">
    <SiteHeader />
    <Suspense fallback={<div className="ui-home-loading" role="status">Загружаем каталог…</div>}><HomeExperience projects={projects} feed={feed} /></Suspense>
    <section className="ie-section ui-home-next" aria-label="Следующие шаги перед покупкой"><div className="ui-container">
      <SectionHeading eyebrow="Перед решением" title="Что нужно знать перед покупкой" description="Кто строит, где находится объект, что входит в цену, как проходит сделка и какие расходы возникнут после неё." />
      <div className="ui-grid">
        <Surface><p className="ui-eyebrow">01 · Сравнить</p><h3>Где и у кого покупать</h3><p>Сравните районы, изучите историю застройщика и сведения о его проектах.</p><div className="ui-cluster"><Link href="/locations">Районы Пхукета →</Link><Link href="/developers">Застройщики →</Link></div></Surface>
        <Surface><p className="ui-eyebrow">02 · Проверить</p><h3>Какие сведения подтверждены</h3><p>Проверьте источник и дату каждого важного сведения. Отметка о проверке факта не означает проверку всего проекта.</p><div className="ui-cluster"><Link href="/quick-assessment">Составить вопросы →</Link><Link href="/methodology">Как устроена проверка →</Link></div></Surface>
        <Surface><p className="ui-eyebrow">03 · Уточнить</p><h3>Как купить и что учесть после</h3><p>Уточните форму владения, график платежей и расходы на содержание. Запрос условий не является бронированием и не требует оплаты.</p><div className="ui-cluster"><Link href="/guide/kak-kupit-nedvizhimost-na-phukete">Порядок покупки →</Link><Link href="/countries/thailand#law">Владение и расходы →</Link></div></Surface>
      </div>
    </div></section>
    {news.length ? <section className="ie-section ui-home-updates"><div className="ui-container"><SectionHeading eyebrow="Из источников" title="Обновления проектов" description="Опубликованные материалы о проектах. Указанная дата не подтверждает текущую готовность объекта; источник нужно проверить в карточке." /><div className="ui-grid">{news.map(u => <Surface key={u.id}><time dateTime={u.at}>{new Date(u.at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</time><h3><Link href={`/project/${projectSlug(byId.get(u.projectId)!)}`}>{u.titleRu}</Link></h3><p>{byId.get(u.projectId)!.n}</p></Surface>)}</div></div></section> : null}
    <section className="ie-section ui-home-guides"><div className="ui-container"><SectionHeading eyebrow="Коротко о главном" title="Первый раз покупаете на Пхукете?"><ActionLink href="/guide" variant="secondary">Все материалы</ActionLink></SectionHeading><div className="ui-grid">{GUIDE.slice(0,3).map(a => <Surface key={a.slug}><p className="ui-eyebrow">{a.group}</p><h3><Link href={`/guide/${a.slug}`}>{a.title}</Link></h3><p>{a.lead}</p></Surface>)}</div></div></section>
    <section className="ie-section ui-home-help"><div className="ui-container"><Surface><SectionHeading title="Нужна помощь по сделке?" description="Вопросы до покупки или спор с застройщиком: разберитесь, какое сопровождение вам подходит."><ActionLink href="/protection" variant="secondary">Помощь покупателю</ActionLink></SectionHeading><p className="ie-small">Объём работы и условия обсуждаются отдельно. Размещение проекта в каталоге не означает независимую проверку или гарантию результата.</p></Surface></div></section>
    <SiteFooter />
  </div>;
}
