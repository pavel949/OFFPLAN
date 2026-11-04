import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { DISCLAIMER, REPRESENTATIVE as R } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: `${R.name}: уполномоченный представитель в Таиланде — Ignatev Estate`,
  description: `${R.role}. Помощь российским инвесторам при покупке недвижимости в Таиланде.`,
  alternates: { canonical: "/protection/representative" },
};

export default function RepresentativePage() {
  return (
    <ProtectionShell
      active="/protection/representative"
      eyebrow="Об уполномоченном представителе"
      title={R.name}
      lead={R.role}
    >
      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-person">
            <div className="ie-avatar" aria-hidden={!R.photo}>
              {R.photo ? <Image src={R.photo} alt={R.name} fill sizes="220px" style={{ objectFit: "cover" }} /> : R.name.charAt(0)}
            </div>
            <div className="ie-prose">
              <h2 style={{ marginTop: 0 }}>Что это значит для инвестора</h2>
              <p>
                {R.name} — {R.role.toLowerCase()} ({R.order}). Это означает, что российский инвестор, столкнувшийся с проблемой при покупке
                недвижимости в Таиланде, может обратиться к человеку, который находится на месте, знает рынок, застройщиков и порядок
                действий, и может по вашему обращению вести переговоры с застройщиком и выстраивать дальнейшие шаги в рамках своих полномочий.
              </p>
              <h3>Чем мы можем помочь</h3>
              <ul>
                <li>Оценить ваш договор, документы и позицию до сделки или при конфликте.</li>
                <li>Подготовить уведомление или претензию застройщику и зафиксировать хронологию событий.</li>
                <li>Провести переговоры о новом графике, компенсации, обмене лота или расторжении.</li>
                <li>Подобрать независимого тайского юриста, когда нужны судебные или иные официальные действия.</li>
                <li>Показать, какие проекты и застройщики прошли независимую проверку реестра.</li>
              </ul>
              {R.bio.length ? (
                <>
                  <h3>Биография</h3>
                  {R.bio.map((b) => <p key={b}>{b}</p>)}
                </>
              ) : null}
              {R.facts.length ? (
                <dl className="ie-dl">
                  {R.facts.map((f) => (
                    <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>
                  ))}
                </dl>
              ) : null}
              <div className="ie-note">{DISCLAIMER}</div>
              <p>
                <Link href="/protection/contact" className="ie-btn ie-btn--gold">Обратиться за помощью</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </ProtectionShell>
  );
}
