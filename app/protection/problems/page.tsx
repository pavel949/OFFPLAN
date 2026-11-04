import type { Metadata } from "next";
import Link from "next/link";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { PAINS } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: "Острые проблемы инвесторов при покупке новостроек — Ignatev Estate",
  description: "Просрочки, возврат денег, права на землю, гарантии доходности, договор, мошенничество: что проверить до покупки и что делать при конфликте.",
  alternates: { canonical: "/protection/problems" },
};

export default function ProblemsPage() {
  return (
    <ProtectionShell
      active="/protection/problems"
      eyebrow="Чек-лист инвестора"
      title="Острые проблемы при покупке новостроек"
      lead="Двенадцать ситуаций, из которых чаще всего вырастают конфликты. Для каждой: как она проявляется, что проверить до покупки и что делать, если проблема уже возникла."
    >
      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-pains">
            {PAINS.map((p, i) => (
              <details key={p.id} className="ie-pain" open={i === 0}>
                <summary>
                  <h3>{p.title}</h3>
                  <span aria-hidden="true">+</span>
                </summary>
                <div className="ie-pain-body">
                  <p>{p.lead}</p>
                  <div className="ie-cols">
                    <div>
                      <h4>Как проявляется</h4>
                      <ul>{p.signs.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                    <div>
                      <h4>До покупки</h4>
                      <ul>{p.before.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                    <div>
                      <h4>Если проблема возникла</h4>
                      <ul>{p.conflict.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <div className="ie-help" style={{ marginTop: 24 }}>
            Материал справочный и не заменяет консультацию тайского юриста: нормы права и практика меняются, условия зависят от вашего
            договора. <Link href="/protection/contact">Обратитесь к нам</Link>, если нужна помощь с вашей ситуацией.
          </div>
        </div>
      </section>
    </ProtectionShell>
  );
}
