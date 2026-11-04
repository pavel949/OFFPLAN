import type { Metadata } from "next";
import { ProtectionForm } from "@/components/ie/ProtectionForm";
import { ProtectionShell } from "@/components/ie/ProtectionShell";
import { DISCLAIMER, DOCS_TO_PREPARE, REPRESENTATIVE } from "@/lib/protection-content";

export const metadata: Metadata = {
  title: "Обратиться за помощью: защита прав инвесторов — Ignatev Estate",
  description: "Просрочка, возврат денег, спор с застройщиком или проверка договора до покупки: оставьте обращение.",
  alternates: { canonical: "/protection/contact" },
};

export default function ContactPage() {
  return (
    <ProtectionShell
      active="/protection/contact"
      eyebrow="Обращение"
      title="Опишите ситуацию, мы свяжемся с вами"
      lead="Можно обратиться до покупки (проверить договор и застройщика) или при конфликте (просрочка, возврат денег, несоответствие объекта)."
    >
      <section className="ie-section">
        <div className="ie-wrap ie-split">
          <ProtectionForm />
          <div style={{ display: "grid", gap: 16 }}>
            <div className="ie-card">
              <h3 className="ie-h3">Подготовьте документы</h3>
              <ul className="ie-bul">
                {DOCS_TO_PREPARE.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
            <div className="ie-card">
              <h3 className="ie-h3">Контакты</h3>
              <p className="ie-small" style={{ marginTop: 0 }}>
                {REPRESENTATIVE.company}
                <br />
                Телефон / WhatsApp:{" "}
                <a href={`tel:${REPRESENTATIVE.phone.replace(/\s/g, "")}`} className="ie-ulink">{REPRESENTATIVE.phone}</a>
              </p>
            </div>
            <p className="ie-small">{DISCLAIMER}</p>
          </div>
        </div>
      </section>
    </ProtectionShell>
  );
}
