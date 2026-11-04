import type { Metadata } from "next";
import Link from "next/link";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { CONFLICT_STEPS, DISCLAIMER, LEVELS } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: "Как работает защита прав инвесторов — Ignatev Estate",
  description: "Уровни защиты от выбора проекта до конфликта и порядок действий при просрочках и невыполнении обязательств застройщиком.",
  alternates: { canonical: "/protection/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <ProtectionShell
      active="/protection/how-it-works"
      eyebrow="Как это работает"
      title="Что мы делаем до сделки и при конфликте"
      lead="Защита начинается до первого платежа: проверка проекта, договора и графика платежей. Если конфликт всё же возник, действуем по понятному порядку."
    >
      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">До сделки</div>
              <h2>Пять уровней защиты</h2>
            </div>
          </div>
          <div className="ie-ladder">
            {LEVELS.map((l) => (
              <Link key={l.n} href={l.href} className="ie-level">
                <span className="ie-level-n">{l.n}</span>
                <div>
                  <h3>{l.title}</h3>
                  <p>{l.text}</p>
                </div>
                <small>{l.where} →</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap ie-split">
          <div>
            <div className="ie-section-head">
              <div>
                <div className="ie-eyebrow">Просрочка или невыполнение обязательств</div>
                <h2>Как мы действуем при конфликте</h2>
              </div>
            </div>
            <ol className="ie-steps2">
              {CONFLICT_STEPS.map((s) => (
                <li key={s.t}>
                  <b>{s.t}</b>
                  <span>{s.d}</span>
                </li>
              ))}
            </ol>
          </div>
          <aside className="ie-card">
            <h3 className="ie-h3">Что важно знать</h3>
            <ul className="ie-bul">
              <li>Срок давности и порядок уведомлений зависят от договора и права, поэтому не откладывайте обращение.</li>
              <li>Все претензии и соглашения лучше оформлять письменно: устные обещания застройщика доказать трудно.</li>
              <li>Мы объясняем варианты и берём на себя переговоры по вашему поручению, но решение всегда за вами.</li>
              <li>Судебные и арбитражные действия в Таиланде ведут тайские юристы, мы помогаем подобрать независимого специалиста.</li>
              <li>О составе и условиях помощи мы договариваемся заранее и письменно.</li>
            </ul>
            <Link className="ie-btn ie-btn--gold" href="/protection/contact">Обратиться за помощью</Link>
          </aside>
        </div>
      </section>

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap">
          <p className="ie-small" style={{ maxWidth: 900 }}>{DISCLAIMER}</p>
        </div>
      </section>
    </ProtectionShell>
  );
}
