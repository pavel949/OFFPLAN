import { Disclosure } from "@/components/ui";
import Link from "next/link";
import { basicProjectAssessment, type BasicAssessmentInput } from "@/lib/basic-project-assessment";
import { VENDOR_DUE_DILIGENCE } from "@/lib/vendor-due-diligence";

/** Accept only the server's public project facts. No legacy score or payment fields. */
export function ProjectAssessment({ input, lang = "ru" }: { input: BasicAssessmentInput; lang?: "ru" | "en" }) {
  const r = basicProjectAssessment(input);
  const t = (ru: string, en: string) => lang === "ru" ? ru : en;
  return <section className="ie-card" id="basic-assessment" aria-labelledby="basic-assessment-title">
    <p className="ie-eyebrow">{t("Для покупателя · базовая проверка", "For buyers · basic review")}</p>
    <h2 className="ie-h2" id="basic-assessment-title">{t("Что подтверждено и чего не хватает", "Evidence and open questions")}</h2>
    <p><b>{r.status === "unavailable" ? t("Данные проверки временно недоступны", "Review data is temporarily unavailable") : r.conclusion[lang]}</b></p>
    {r.status === "unavailable" ? <p className="ie-small">{t("Часть сведений не загрузилась. Это не означает, что документы отсутствуют. Повторите попытку позже.", "Some information could not be loaded. This does not mean documents are missing. Please try again later.")}</p> : null}
    <Disclosure title={t("Факты с отметкой о проверке", "Facts with a recorded review")} count={r.reviewedFacts.length}>
    {r.reviewedFacts.length ? <ul className="ie-links">{r.reviewedFacts.map(f => <li key={f.id}>
      <a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow">{f.title}</a>
      <small>{t("Источник от", "Source dated")} {f.observed_at.slice(0, 10)} · {t("проверка отмечена", "review recorded")} {f.reviewed_at!.slice(0, 10)}</small>
    </li>)}</ul> : <p className="ie-small">{t("Публичные факты с корректной датой проверки пока не представлены.", "No public facts with a valid review date are available yet.")}</p>}

    </Disclosure>
    <p className="ie-small">{t("Отметка относится только к конкретному факту на указанную дату. Она не означает проверку всего проекта, актуальность на сегодня или независимое юридическое заключение.", "A review entry covers only that fact on the recorded date. It does not establish whole-project verification, current validity or an independent legal opinion.")}</p>
    {r.unreviewedFacts.length ? <details><summary>{t("Опубликовано без подтверждённой даты проверки", "Published without a valid review date")} · {r.unreviewedFacts.length}</summary><ul>{r.unreviewedFacts.map(f => <li key={f.id}><a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow">{f.title}</a></li>)}</ul></details> : null}
    <h3>{t("Документы и вопросы перед сделкой", "Documents and questions before purchase")}</h3>
    <p className="ie-small">{t("Ниже указано, что не подтверждено публичными данными платформы. Это не утверждение об отсутствии документов у застройщика и не выявленное нарушение.", "These are gaps in the platform’s public evidence, not claims that the developer lacks documents or has committed a violation.")}</p>
    {r.topics.map(topic => <Disclosure key={topic.id} title={<><b>{topic.title[lang]}</b><br /><span>{r.status === "unavailable" ? t("статус документов недоступен", "document status unavailable") : topic.sources.length ? t("есть ссылка, содержание не подтверждено", "source linked, contents not verified") : t("нужно запросить документы", "documents need to be requested")}</span></>}>
      <p>{topic.question[lang]}</p><p className="ie-small">{topic.why[lang]}</p>
      {topic.sources.length ? <ul>{topic.sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a></li>)}</ul> : null}
    </Disclosure>)}
    <hr />
    <h3>{t("Отдельно: независимая проверка по заказу застройщика", "Separately: developer-commissioned independent review")}</h3>
    <p>{t("Vendor due diligence — подробное исследование проекта с раскрытием документов. Застройщик оплачивает работу, а не положительный результат.", "Vendor due diligence is a detailed examination of the project and its disclosed documents. The developer pays for the work, not a favorable outcome.")}</p>
    <p><b>{VENDOR_DUE_DILIGENCE.priceTHB.toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")} THB</b> · {t("Налоги, точный состав работ, расходы третьих лиц и сроки согласуются до заказа.", "Taxes, detailed scope, third-party costs and timing must be agreed before an order.")}</p>
    <p className="ie-small">{t("В этом разделе независимый отчёт по проекту не подключён. Заказ, оплата или готовность раскрыть документы сами по себе не являются проверкой. Публичный отчёт должен указывать заказчика, проверяющего, дату, охват, выводы и ограничения, включая нерешённые вопросы.", "This section is not connected to a project-specific independent report. An order, payment or willingness to disclose documents is not verification. A public report must identify the commissioning party, reviewer, date, scope, findings and limitations, including unresolved questions.")}</p>
    <Link href="/protection/contact" className="ie-btn ie-btn--line">{t("Обсудить состав проверки", "Discuss the review scope")}</Link>
    <p className="ie-small">{t("Это обращение, не оформление заказа или оплаты. Проверка не является гарантией завершения строительства, доходности или рекомендацией покупать.", "This is an inquiry, not an order or payment. Review does not guarantee completion or returns and is not a recommendation to buy.")}</p>
  </section>;
}
