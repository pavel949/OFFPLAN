"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitLead, type SubmitLeadState } from "@/app/actions/leads";
import { TurnstileWidget } from "@/components/catalogue/LeadModal";
import { PROBLEM_KINDS } from "@/lib/protection-content";

const initial: SubmitLeadState = { ok: false };

/** Case intake. Goes through the same lead pipeline (rate limit, captcha, consent, CRM). */
export function ProtectionForm() {
  const [state, action, pending] = useActionState(
    async (prev: SubmitLeadState, f: FormData) => {
      const kind = String(f.get("kind") ?? "");
      const who = String(f.get("who") ?? "").trim();
      const text = String(f.get("details") ?? "").trim();
      f.set(
        "message",
        [`[Защита прав] ${kind}`, who ? `Застройщик / проект: ${who}` : "", text].filter(Boolean).join("\n"),
      );
      return submitLead(prev, f);
    },
    initial,
  );

  if (state.ok)
    return (
      <div className="ie-card" role="status">
        <h2 className="ie-h2">Обращение отправлено</h2>
        <p className="ie-lead">Мы получили ваше обращение и свяжемся с вами по указанным контактам. Пожалуйста, подготовьте документы из списка рядом.</p>
      </div>
    );

  return (
    <form action={action} className="ie-form ie-card">
      <input type="hidden" name="locale" value="ru" />
      <input type="hidden" name="projectName" value="Защита прав инвестора" />
      <input type="text" name="_hp" tabIndex={-1} autoComplete="off" aria-hidden className="lead-modal-hp" />
      <h2 className="ie-h2">Обращение</h2>
      <label>
        С чем вы обращаетесь
        <select name="kind" defaultValue={PROBLEM_KINDS[0]} required>
          {PROBLEM_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        Застройщик и проект (если есть)
        <input name="who" maxLength={300} placeholder="Например: Название проекта, Застройщик" />
      </label>
      <label>
        Что произошло
        <textarea name="details" rows={5} maxLength={3500} placeholder="Коротко: что куплено, когда, что обещали, что сейчас, какие суммы внесены" />
      </label>
      <label>
        Имя *
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        Email *
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label>
        Телефон / мессенджер
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>
      <label className="ie-check">
        <input type="checkbox" name="consent" required />
        <span>
          Я согласен(на) на обработку персональных данных в соответствии с{" "}
          <Link href="/privacy" target="_blank">политикой конфиденциальности</Link> *
        </span>
      </label>
      <TurnstileWidget />
      {state.error ? <p role="alert" className="login-err">{state.error}</p> : null}
      <button className="ie-btn ie-btn--gold" disabled={pending}>
        {pending ? "Отправка…" : "Отправить обращение"}
      </button>
      <p className="ie-small">
        Не прикладывайте сканы паспорта и банковских карт. Документы мы запросим отдельно, когда они понадобятся.
      </p>
    </form>
  );
}
