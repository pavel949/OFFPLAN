import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { APPOINTMENT as A, DISCLAIMER, REPRESENTATIVE as R } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: `${R.name}: общественный представитель Уполномоченного в Таиланде — Ignatev Estate`,
  description: `${A.title}. Приказ ${A.order} от ${A.orderDate}. Что это значит для предпринимателей и инвесторов и как проверить статус.`,
  alternates: { canonical: "/protection/representative" },
};

const ROWS: [string, string][] = [
  ["Документ", `Приказ ${A.order} от ${A.orderDate}`],
  ["Кем издан", A.issuedBy],
  ["Назначен", `${A.appointed}, ${A.appointedPost}`],
  ["Должность", A.title],
  ["Территория", A.territory],
  ["Срок", A.term],
  ["Основание", A.legalBasis],
];

export default function RepresentativePage() {
  return (
    <ProtectionShell
      active="/protection/representative"
      eyebrow="Официальный статус"
      title={R.name}
      lead={A.title}
    >
      <section className="ie-section" style={{ paddingBottom: 24 }}>
        <div className="ie-wrap">
          <div className="ie-person">
            <div className="ie-avatar" aria-hidden={!R.photo}>
              {R.photo ? <Image src={R.photo} alt={R.name} fill sizes="220px" style={{ objectFit: "cover" }} /> : "ПИ"}
            </div>
            <div>
              <div className="ie-badges-row" style={{ margin: "0 0 14px" }}>
                <span className="ie-badge ie-badge--dark">Приказ {A.order} · {A.orderDate}</span>
                <span className="ie-badge ie-badge--dark">{A.territory}</span>
                <span className="ie-badge ie-badge--dark">{A.appointedPost}</span>
              </div>
              <p className="ie-lead" style={{ maxWidth: 760 }}>
                {R.name} назначен Уполномоченным по защите прав предпринимателей в городе Москве его общественным представителем в
                Королевстве Таиланд. Назначение оформлено приказом, а информацию о представителе Аппарат Уполномоченного размещает на
                официальном портале Уполномоченного. Ниже: что сказано в приказе, что это значит на практике и как проверить статус самому.
              </p>
              <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="ie-btn ie-btn--ink" href={A.portal} target="_blank" rel="noopener noreferrer">Официальный портал Уполномоченного ↗</a>
                <Link className="ie-btn ie-btn--gold" href="/protection/contact">Обратиться за помощью</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ie-section" style={{ paddingTop: 24 }}>
        <div className="ie-wrap ie-split">
          <article className="ie-doc" aria-labelledby="doc-h">
            <div className="ie-doc-head">
              <span>Документ-основание</span>
              <h2 id="doc-h">Приказ {A.order}</h2>
              <small>{A.orderDate} · о назначении общественного представителя Уполномоченного по защите прав предпринимателей в городе Москве</small>
            </div>
            <dl className="ie-doc-rows">
              {ROWS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="ie-doc-en" lang="en">{A.titleEn}</p>
            {A.orderPdf ? (
              <a className="ie-btn ie-btn--line" href={A.orderPdf} target="_blank" rel="noopener noreferrer">Открыть копию приказа (PDF)</a>
            ) : null}
          </article>

          <div style={{ display: "grid", gap: 16 }}>
            <section className="ie-card">
              <h2 className="ie-h2">Цели назначения (по приказу)</h2>
              <ul className="ie-bul">{A.purposes.map((p) => <li key={p}>{p}</li>)}</ul>
              <h3 className="ie-h3" style={{ marginTop: 18 }}>Права и полномочия</h3>
              <p className="ie-small" style={{ marginTop: 0 }}>{A.powers}</p>
            </section>
          </div>
        </div>
      </section>

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Две роли: важно различать</div>
              <h2>Официальный статус и частные услуги</h2>
            </div>
            <p>Мы разделяем их, чтобы вы всегда понимали, кто и в каком качестве вам помогает.</p>
          </div>
          <div className="ie-roles">
            <div className="ie-role ie-role--official">
              <span className="ie-role-tag">Официальный статус</span>
              <h3>Общественный представитель Уполномоченного</h3>
              <p>
                Помощь в защите прав и законных интересов российских и иностранных предпринимателей и бизнеса, ведущего дела в Таиланде,
                содействие Уполномоченному и развитие общественных институтов защиты прав. Содержание и порядок действий определяет
                Положение об общественных уполномоченных (приказ № 244-П) и Аппарат Уполномоченного.
              </p>
              <ul className="ie-bul">
                <li>Для предпринимателей и компаний, столкнувшихся с проблемой при ведении бизнеса в Таиланде</li>
                <li>В рамках полномочий, предусмотренных Положением</li>
                <li>Решение о возможности и форме действий принимается по существу обращения</li>
              </ul>
            </div>
            <div className="ie-role">
              <span className="ie-role-tag ie-role-tag--private">Частная компания</span>
              <h3>Ignatev Estate: платформа и помощь инвесторам</h3>
              <p>
                Платформа проверенных новостроек, независимый реестр проверки, досье застройщиков, чек-листы, а также помощь покупателям
                при просрочках и конфликтах: оценка документов, претензия, переговоры, подбор независимого юриста.
              </p>
              <ul className="ie-bul">
                <li>Для всех покупателей и инвесторов, в том числе физических лиц</li>
                <li>Это услуги частной компании, а не полномочия Уполномоченного</li>
                <li>Условия помощи оговариваются заранее и письменно</li>
              </ul>
            </div>
          </div>
          <div className="ie-help" style={{ marginTop: 20 }}>
            <b>Если вы предприниматель или компания</b>, укажите это в обращении: мы определим, что относится к полномочиям общественного
            представителя, а что решается силами Ignatev Estate и независимых юристов. Спор физического лица-покупателя сам по себе не
            становится предметом полномочий Уполномоченного, поэтому в таких случаях мы помогаем как частная компания.
          </div>
        </div>
      </section>

      <section className="ie-section ie-section--dark">
        <div className="ie-wrap ie-split">
          <div>
            <div className="ie-section-head">
              <div>
                <div className="ie-eyebrow">Как проверить статус</div>
                <h2>Не верьте на слово</h2>
              </div>
            </div>
            <ol className="ie-steps2 ie-steps2--dark">
              <li><b>Официальный портал</b><span>Информация о представителе размещается на портале Уполномоченного: <a href={A.portal} target="_blank" rel="noopener noreferrer">business-ombudsman.mos.ru</a>.</span></li>
              <li><b>Номер и дата приказа</b><span>Приказ {A.order} от {A.orderDate}. Эти реквизиты можно назвать в Аппарате Уполномоченного.</span></li>
              <li><b>Аппарат Уполномоченного</b><span>Запросите подтверждение назначения по контактам ниже.</span></li>
            </ol>
          </div>
          <div className="ie-card" style={{ alignSelf: "start" }}>
            <h3 className="ie-h3">Контакты Аппарата Уполномоченного</h3>
            <p className="ie-small" style={{ marginTop: 0, color: "#3b4558" }}>
              {A.office.name}
              <br />
              {A.office.address}
              <br />
              Телефон: {A.office.phone}
              <br />
              E-mail: <a href={`mailto:${A.office.email}`} className="ie-ulink">{A.office.email}</a>
            </p>
            <h3 className="ie-h3" style={{ marginTop: 18 }}>Ignatev Estate, Пхукет</h3>
            <p className="ie-small" style={{ marginTop: 0, color: "#3b4558" }}>
              {R.company}
              <br />
              <a href={`tel:${R.phone.replace(/\s/g, "")}`} className="ie-ulink">{R.phone}</a>
            </p>
          </div>
        </div>
      </section>

      {R.bio.length || R.facts.length ? (
        <section className="ie-section">
          <div className="ie-wrap ie-prose">
            <h2>Биография</h2>
            {R.bio.map((b) => <p key={b}>{b}</p>)}
            {R.facts.length ? (
              <dl className="ie-dl">{R.facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap">
          <div className="ie-note" style={{ maxWidth: 900 }}>{DISCLAIMER}</div>
        </div>
      </section>
    </ProtectionShell>
  );
}
