import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy — Ignatev Estate",
  description: "How Ignatev Estate collects and processes personal data.",
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
        <Link href="/">← Catalogue</Link>
      </p>
      <h1 className="serif" style={{ fontSize: "2rem", margin: "16px 0" }}>
        Privacy policy / Политика конфиденциальности
      </h1>
      <p style={{ opacity: 0.7 }}>Version {CONSENT_VERSION}</p>

      <h2>1. Controller</h2>
      <p>
        {entity}
        {email ? <> · <a href={`mailto:${email}`}>{email}</a></> : null}
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>Enquiry form: name, email, phone/WhatsApp, message, the project you enquired about, UTM parameters, language, time and version of your consent.</li>
        <li>Account (optional): email address used for sign-in, saved favourites and project subscriptions.</li>
        <li>Product analytics (first-party, no advertising cookies): page views, catalogue filter usage and clicks on calls-to-action, without your name or email.</li>
      </ul>

      <h2>3. Purposes and legal basis</h2>
      <ul>
        <li>Responding to your enquiry and matching you with suitable projects — your consent / steps prior to a contract.</li>
        <li>Forwarding your enquiry to the developer or agent of the project you selected — your consent.</li>
        <li>Operating and improving the service — legitimate interest.</li>
      </ul>

      <h2>4. Recipients</h2>
      <p>
        Developers/agents of the project you enquired about, and processors that host or deliver
        our service (hosting, database, email delivery, captcha). Data may be transferred outside
        your country; we rely on appropriate safeguards where required.
      </p>

      <h2>5. Retention</h2>
      <p>Enquiries are kept while the sales process is active and then deleted or anonymised within 24 months unless the law requires longer.</p>

      <h2>6. Your rights</h2>
      <p>
        You may request access, correction, deletion, restriction, portability, and withdraw consent at any
        time{email ? <> by writing to <a href={`mailto:${email}`}>{email}</a></> : null}. You may also lodge
        a complaint with your data-protection authority.
      </p>

      <h2>7. Editorial content notice</h2>
      <p>
        Ratings, risk tiers and notes in the catalogue are informational, based on public sources
        and our methodology, and are not investment, legal or tax advice. Verify all data with the
        developer before purchase.
      </p>

      <h2>RU. Кратко</h2>
      <p>
        Мы собираем имя, email, телефон и сообщение из формы заявки, передаём заявку застройщику
        или агенту выбранного проекта и обрабатываем её на основании вашего согласия. Согласие можно
        отозвать, а данные — запросить, исправить или удалить{email ? <>, написав на {email}</> : null}.
        Рейтинги и оценки в каталоге носят информационный характер и не являются инвестиционной
        рекомендацией.
      </p>
    </main>
  );
}
