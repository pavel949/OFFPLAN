import Image from "next/image";
import Link from "next/link";
import { ActionLink } from "./index";

function ArrowIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14" /></svg>;
}

/** Uses only a published catalogue cover. Never supplies a stock substitute. */
export function DiscoveryHero({ image, projectName, href, render, location }: { image: string; projectName: string; href: string; render: boolean; location: string }) {
  return <section className="ui-discovery ui-enter" aria-labelledby="discovery-title">
    <div className="ui-discovery-copy">
      <p className="ui-eyebrow">Новостройки Пхукета</p>
      <h2 id="discovery-title">Выберите проект.<br /><em>Проверьте детали.</em></h2>
      <p>Новостройки, документы и условия покупки. Изучайте не только архитектуру — смотрите, что стоит за предложением.</p>
      <div className="ui-cluster"><ActionLink href="#home-search">Подобрать проект <span aria-hidden="true"><ArrowIcon /></span></ActionLink><Link className="ui-text-link" href="/quick-assessment">Что проверить до покупки</Link></div>

    </div>
    <Link href={href} className="ui-discovery-image" aria-label={`Изучить ${projectName}`}>
      <Image src={image} alt={projectName} fill sizes="(max-width: 800px) 100vw, 58vw" priority unoptimized referrerPolicy="no-referrer" />
      <span className="ui-image-kind">{render ? "Визуализация застройщика" : "Материал застройщика"}</span>
      <div className="ui-image-caption"><div><small>Из каталога · {location}</small><strong>{projectName}</strong></div><span aria-hidden="true"><ArrowIcon /></span></div>
    </Link>
  </section>;
}
