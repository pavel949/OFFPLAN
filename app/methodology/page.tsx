import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import {
  DISCLAIMER, DOMAIN_PUBLIC, EVIDENCE_PUBLIC, GATES_PUBLIC, GOVERNANCE, NOT_PUBLISHED, PRINCIPLES, TIERS_PUBLIC, WHY_CLOSED,
} from "@/lib/clearview/public-content";
import { createAnonClient, hasSupabasePublicConfig } from "@/lib/supabase/anon";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Методология ClearView: как мы оцениваем проекты — Ignatev Estate",
  description: "Что проверяет независимая оценка новостроек: девять областей, десять стоп-условий, стандарты доказательств, уровни, независимость и отпечатки версий правил.",
  alternates: { canonical: "/methodology" },
};

type Ver = { version: string; status: string; config_hash: string | null; published_at: string | null; change_summary: string };
async function versions(): Promise<Ver[]> {
  if (!hasSupabasePublicConfig()) return [];
  try {
    const { data } = await createAnonClient().from("cv_methodology_versions").select("version, status, config_hash, published_at, change_summary").order("published_at", { ascending: false });
    return (data ?? []) as Ver[];
  } catch { return []; }
}

export default async function MethodologyPage() {
  const vers = await versions();
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Методология</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>ClearView</div>
          <h1>Как мы оцениваем проекты</h1>
          <p>Независимая оценка рисков новостроек: что проверяется, что останавливает оценку и почему результату можно доверять.</p>
          <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link className="ie-btn ie-btn--gold" href="/quick-assessment">Пройти быструю проверку</Link><a className="ie-btn ie-btn--line" href="#order">Статус сервиса</a></p>
        </div>
      </section>

      <div className="ie-wrap cv-pub" style={{ paddingTop: 40 }}>
        <section>
          <h2>Принципы</h2>
          <div className="cv-cards">{PRINCIPLES.map((p) => <div className="cv-card" key={p.t}><h3>{p.t}</h3><p>{p.d}</p></div>)}</div>
        </section>

        <section>
          <h2>Как идёт оценка</h2>
          <div className="cv-cards">
            {[["1", "Область применения", "Новостройки жилой недвижимости на Пхукете: кондо, виллы, дома."], ["2", "Стоп-условия", "Десять проверок «да или нет». Любое срабатывание останавливает оценку."], ["3", "Девять областей", "Пункты риска оцениваются по доказательствам; недостаток данных снижает оценку."], ["4", "Итог и ограничения", "Результат складывается из областей. Провал в одной ключевой области не усредняется и ограничивает итог."], ["5", "Обновление", "Автоматический мониторинг пока не запущен. Актуальность разрешений, обременений и документов требует повторной проверки."]].map(([n, t, d]) => (
              <div className="cv-card" key={n}><span className="cv-pill">Шаг {n}</span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </section>

        <section>
          <h2>Девять областей</h2>
          <p className="cv-lead">Области неравнозначны: самые важные для сохранности денег покупателя названы ниже «очень высокой» значимостью. Точные доли мы не публикуем.</p>
          <div className="cv-cards">
            {DOMAIN_PUBLIC.map((d) => (
              <div className="cv-card" key={d.code}>
                <span className="cv-pill">{d.code} · значимость: {d.importance}</span>
                <h3>{d.ru}</h3><p>{d.what}</p>
                <ul>{d.examples.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Десять стоп-условий</h2>
          <p className="cv-lead">Это проверки «да или нет». Если условие сработало и не снято документом, итоговый уровень не рассчитывается.</p>
          <div className="cv-gates">{GATES_PUBLIC.map((g) => <div className="cv-gate" key={g.gate}><b>{g.gate}</b><span>{g.text}</span></div>)}</div>
        </section>

        <section>
          <h2>Уровни</h2>
          <div className="cv-cards">{TIERS_PUBLIC.map((t) => <div className="cv-card" key={t.key}><h3>{t.t}</h3><p>{t.d}</p></div>)}</div>
        </section>

        <section>
          <h2>Что считается доказательством</h2>
          <div className="cv-cards">{EVIDENCE_PUBLIC.map((e) => <div className="cv-card" key={e.t}><span className="cv-pill">{e.w}</span><p style={{ color: "var(--ie-ink)" }}>{e.t}</p></div>)}</div>
        </section>

        <section className="cv-closed">
          <h3>Что открыто, а что нет, и почему</h3>
          <p>{WHY_CLOSED}</p>
          <p><b>Не публикуется:</b></p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{NOT_PUBLISHED.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>

        <section>
          <h2>Требования к независимой оценке</h2>
          <p className="cv-lead">Ниже — требования к будущему процессу полной оценки. Эта страница не подтверждает наличие действующей платной услуги, отдельного юридического лица или подписанного экспертами отчёта по конкретному проекту.</p>
          <ul style={{ paddingLeft: 20, display: "grid", gap: 8, fontSize: 15, lineHeight: 1.6, maxWidth: 820 }}>{GOVERNANCE.map((g) => <li key={g}>{g}</li>)}</ul>
        </section>

        <section>
          <h2>Версии правил и их отпечатки</h2>
          <p className="cv-lead">Отпечаток публикуется в момент выпуска версии и указывается в каждом отчёте. Он доказывает, что формула, по которой оценён проект, не менялась.</p>
          {vers.length === 0 ? <p className="cv-lead">Опубликованные версии не найдены или временно недоступны. Из этого нельзя сделать вывод об утверждении методологии.</p> : (
            <div style={{ display: "grid", gap: 10 }}>
              {vers.map((v) => (
                <div className="cv-card" key={v.version}>
                  <h3>Версия {v.version} {v.status === "published" ? <span className="cv-pill" style={{ marginLeft: 8 }}>действует</span> : null}</h3>
                  <p>{v.published_at ? `Опубликована ${new Date(v.published_at).toLocaleDateString("ru-RU")}. ` : ""}{v.change_summary}</p>
                  <p className="cv-hash">SHA-256: {v.config_hash}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="order">
          <h2>Статус сервиса</h2>
          <p className="cv-lead">Доступна бесплатная быстрая самопроверка. Она использует встроенную версию ClearView 2.2 и ответы пользователя, а не проверенные документы проекта. Публикация версии в студии пока не изменяет эту самопроверку автоматически.</p>
          <p>Заказы, оплата, подписки и автоматический мониторинг ещё не подключены. Кабинет застройщика позволяет размещать проекты и материалы для проверки; оформление платной оценки в нём пока недоступно. Тарифы и условия пилота требуют отдельного подтверждения.</p>
        </section>

        <p className="cv-note">{DISCLAIMER}</p>
      </div>
      <SiteFooter />
    </div>
  );
}
