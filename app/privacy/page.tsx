import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Ignatev Estate",
  description: "Как Ignatev Estate собирает и обрабатывает персональные данные.",
  alternates: { canonical: "/privacy" },
};

/**
 * TEMPLATE — must be reviewed by counsel (PDPA Thailand, GDPR for EU/UK visitors, RU residents)
 * before launch. Controller identity comes from env so no placeholder text ships by accident:
 *   NEXT_PUBLIC_LEGAL_ENTITY, NEXT_PUBLIC_LEGAL_EMAIL
 */
export default function PrivacyPage() {
  const entity = process.env.NEXT_PUBLIC_LEGAL_ENTITY || "Ignatev Estate";
  const email = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "";
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", lineHeight: 1.6 }}>
      <p>
        <Link href="/">← Каталог</Link>
      </p>
      <h1 className="serif" style={{ fontSize: "2rem", margin: "16px 0" }}>
        Политика конфиденциальности
      </h1>
      <p style={{ opacity: 0.7 }}>Версия {CONSENT_VERSION}</p>

      <h2>1. Оператор персональных данных</h2>
      <p>
        {entity}
        {email ? <> · <a href={`mailto:${email}`}>{email}</a></> : null}
      </p>

      <h2>2. Какие данные мы собираем</h2>
      <ul>
        <li>Форма заявки: имя, email, телефон / WhatsApp, сообщение, проект, по которому вы обращаетесь, UTM-метки, язык, время и версия вашего согласия.</li>
        <li>Личный кабинет (по желанию): email для входа, избранное и подписки на проекты.</li>
        <li>Аналитика (собственная, без рекламных cookie): просмотры страниц, использование фильтров и клики по кнопкам, без имени и email.</li>
      </ul>

      <h2>3. Цели и правовые основания</h2>
      <ul>
        <li>Ответ на вашу заявку и подбор подходящих проектов — ваше согласие / действия до заключения договора.</li>
        <li>Передача заявки застройщику или агенту выбранного проекта — ваше согласие.</li>
        <li>Работа и улучшение сервиса — законный интерес.</li>
      </ul>

      <h2>4. Получатели данных</h2>
      <p>
        Застройщики и агенты проекта, по которому вы обратились, а также обработчики, обеспечивающие
        работу сервиса (хостинг, база данных, доставка почты, капча). Данные могут передаваться за
        пределы вашей страны; при необходимости применяются надлежащие гарантии защиты.
      </p>

      <h2>5. Сроки хранения</h2>
      <p>Заявки хранятся, пока идёт процесс продажи, затем удаляются или обезличиваются в течение 24 месяцев, если закон не требует иного срока.</p>

      <h2>6. Ваши права</h2>
      <p>
        Вы вправе запросить доступ к данным, их исправление, удаление, ограничение обработки,
        переносимость и в любой момент отозвать согласие{email ? <>, написав на <a href={`mailto:${email}`}>{email}</a></> : null}.
        Вы также можете обратиться с жалобой в орган по защите персональных данных.
      </p>

      <h2>7. Информационный характер материалов</h2>
      <p>
        Рейтинги, уровни риска и заметки в каталоге носят информационный характер, основаны на открытых
        источниках и нашей методологии и не являются инвестиционной, юридической или налоговой
        рекомендацией. Перед покупкой проверьте все данные у застройщика.
      </p>

      <hr style={{ margin: "32px 0", opacity: 0.2 }} />
      <h2>English summary</h2>
      <h3>1. Controller</h3>
      <p>
        {entity}
        {email ? <> · <a href={`mailto:${email}`}>{email}</a></> : null}
      </p>

      <h3>2. Data we collect</h3>
      <ul>
        <li>Enquiry form: name, email, phone/WhatsApp, message, the project you enquired about, UTM parameters, language, time and version of your consent.</li>
        <li>Account (optional): email address used for sign-in, saved favourites and project subscriptions.</li>
        <li>Product analytics (first-party, no advertising cookies): page views, catalogue filter usage and clicks on calls-to-action, without your name or email.</li>
      </ul>

      <h3>3. Purposes and legal basis</h3>
      <ul>
        <li>Responding to your enquiry and matching you with suitable projects — your consent / steps prior to a contract.</li>
        <li>Forwarding your enquiry to the developer or agent of the project you selected — your consent.</li>
        <li>Operating and improving the service — legitimate interest.</li>
      </ul>

      <h3>4. Recipients</h3>
      <p>
        Developers/agents of the project you enquired about, and processors that host or deliver
        our service (hosting, database, email delivery, captcha). Data may be transferred outside
        your country; we rely on appropriate safeguards where required.
      </p>

      <h3>5. Retention</h3>
      <p>Enquiries are kept while the sales process is active and then deleted or anonymised within 24 months unless the law requires longer.</p>

      <h3>6. Your rights</h3>
      <p>
        You may request access, correction, deletion, restriction, portability, and withdraw consent at any
        time{email ? <> by writing to <a href={`mailto:${email}`}>{email}</a></> : null}. You may also lodge
        a complaint with your data-protection authority.
      </p>

      <h3>7. Editorial content notice</h3>
      <p>
        Ratings, risk tiers and notes in the catalogue are informational, based on public sources
        and our methodology, and are not investment, legal or tax advice. Verify all data with the
        developer before purchase.
      </p>

    </main>
  );
}
