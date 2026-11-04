import type { Metadata } from "next";
import Link from "next/link";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { StatusCard } from "@/components/ie/StatusCard";
import { DISCLAIMER, LEVELS } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: "Защита прав российских инвесторов за рубежом — Ignatev Estate",
  description:
    "Как российский инвестор защищает деньги при покупке новостроек в Таиланде: проверка до сделки, контроль стройки и помощь при просрочках и конфликтах.",
  alternates: { canonical: "/protection" },
};

export default function ProtectionPage() {
  return (
    <ProtectionShell
      active="/protection"
      eyebrow="Защита прав российских инвесторов за рубежом"
      title="Покупка новостройки — это не только выбор квартиры"
      lead="Деньги вы вносите заранее, а получаете объект через годы и в другой стране. Мы создали платформу, чтобы смотреть, выбирать и проверять проекты в одном месте, и чтобы вы знали, к кому обратиться, если что-то пошло не так."
    >
      <section className="ie-section" style={{ paddingBottom: 0 }}>
        <div className="ie-wrap">
          <StatusCard />
        </div>
      </section>

      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Почему мы это создали</div>
              <h2>Информации много, независимой проверки мало</h2>
            </div>
          </div>
          <div className="ie-prose" style={{ maxWidth: 900 }}>
            <p>
              Российские покупатели выбирают новостройки по рекламе застройщиков и по рассказам посредников, которые получают комиссию
              с продажи. Проверенных данных мало: цены и наличие меняются, этапы стройки не подтверждены, договор на чужом языке, а
              когда сроки срываются, непонятно, к кому идти.
            </p>
            <p>
              Поэтому мы собрали в одном месте проверяемую информацию о проектах и застройщиках: уровни проверки, свежие цены и
              наличие, фотоотчёты со строек, расходы владения. А рядом дали помощь: чек-листы, разбор типичных проблем и обращение, если
              возник конфликт или просрочка.
            </p>
            <div className="ie-note">
              <b>Наш принцип:</b> объекты стоит смотреть и выбирать здесь, где данные обновляются и проверяются, а при вопросах и
              конфликтах обращаться к нам: мы знаем рынок, застройщиков и порядок действий. Реестр проверки отделён от брокерской
              деятельности, условия вознаграждения раскрываются.
            </div>
          </div>
        </div>
      </section>

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Пять уровней защиты</div>
              <h2>От знания до действий при конфликте</h2>
            </div>
            <p>Чем раньше вы подключаете защиту, тем дешевле она обходится. Лучший момент: до первого платежа.</p>
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

      <section className="ie-section ie-section--dark">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Куда идти</div>
              <h2>Что делать прямо сейчас</h2>
            </div>
          </div>
          <div className="ie-know">
            <Link href="/protection/problems" style={{ minHeight: 160 }}>
              <span className="k">Покупаете</span>
              <h3>Узнайте, где чаще всего теряют деньги</h3>
              <p>Двенадцать острых проблем и что проверить до подписания.</p>
              <span className="more">Читать →</span>
            </Link>
            <Link href="/protection/how-it-works" style={{ minHeight: 160 }}>
              <span className="k">Просрочка или спор</span>
              <h3>Как мы действуем при конфликте</h3>
              <p>Пошаговый порядок: документы, уведомление, переговоры, эскалация.</p>
              <span className="more">Читать →</span>
            </Link>
            <Link href="/protection/contact" style={{ minHeight: 160 }}>
              <span className="k">Нужна помощь</span>
              <h3>Оставить обращение</h3>
              <p>Опишите ситуацию и подготовьте документы: мы свяжемся с вами.</p>
              <span className="more">Обратиться →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="ie-section">
        <div className="ie-wrap">
          <p className="ie-small" style={{ maxWidth: 900 }}>{DISCLAIMER}</p>
        </div>
      </section>
    </ProtectionShell>
  );
}
