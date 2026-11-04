"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitLead, type SubmitLeadState } from "@/app/actions/leads";
import "./lead-modal.css";

const initial: SubmitLeadState = { ok: false };
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: { sitekey: string }) => string;
  remove: (id: string) => void;
};

export function TurnstileWidget() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    const mount = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (cancelled || !api || !ref.current) return;
      widgetId = api.render(ref.current, { sitekey: TURNSTILE_SITE_KEY });
    };
    if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
      mount();
    } else {
      let script = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (widgetId && api) api.remove(widgetId);
    };
  }, []);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} />;
}

export function LeadModal({
  open,
  onClose,
  lang,
  projectId,
  projectName,
  offerId,
  salesRevision,
  unitLabel,
}: {
  open: boolean;
  onClose: () => void;
  lang: "en" | "ru";
  projectId: number | null;
  projectName: string | null;
  offerId?: string;
  salesRevision?: number;
  unitLabel?: string;
}) {
  const ru = lang === "ru";
  const [utmJson, setUtmJson] = useState("");
  const [state, formAction] = useActionState(submitLead, initial);

  useEffect(() => {
    if (state.ok) {
      const t = window.setTimeout(() => {
        onClose();
      }, 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.ok, onClose]);

  useEffect(() => {
    if (!open) return;
    const sp = new URLSearchParams(window.location.search);
    const o: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = sp.get(k);
      if (v) o[k] = v;
    }
    setUtmJson(Object.keys(o).length ? JSON.stringify(o) : "");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lead-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="lead-modal"
        role="dialog"
        aria-modal
        aria-labelledby="lead-modal-title"
      >
        <button
          type="button"
          className="lead-modal-x"
          onClick={onClose}
          aria-label={ru ? "Закрыть" : "Close"}
        >
          ✕
        </button>
        <h2 id="lead-modal-title" className="lead-modal-title">
          {ru ? "Заявка на новостройку" : "Off-plan inquiry"}
        </h2>
        <p className="lead-modal-sub">
          {ru
            ? "Оставьте контакты — мы свяжемся и подберём варианты под ваш запрос."
            : "Leave your details — we will contact you with tailored options."}
        </p>
        {projectName ? (
          <p className="lead-modal-proj">
            <span className="lead-modal-proj-l">
              {ru ? "Проект:" : "Project:"}
            </span>{" "}
            <strong>{projectName}</strong>
          </p>
        ) : null}
        {unitLabel ? <p>{ru?"Выбранный юнит":"Selected unit"}: <strong>{unitLabel}</strong></p>:null}

        {state.ok ? (
          <p className="lead-modal-ok">
            {ru
              ? "✓ Заявка отправлена. Мы свяжемся с вами в ближайшее время."
              : "✓ Thank you. We will reach out shortly."}
          </p>
        ) : (
          <form action={formAction} className="lead-modal-form">
            <input type="hidden" name="locale" value={lang} />
            <input
              type="hidden"
              name="projectId"
              value={projectId ?? ""}
            />
            <input type="hidden" name="projectName" value={projectName ?? ""} />
            {offerId ? <><input type="hidden" name="offerId" value={offerId}/><input type="hidden" name="salesRevision" value={salesRevision ?? ""}/></>:null}
            <input type="hidden" name="utm_json" value={utmJson} />
            <input
              type="text"
              name="_hp"
              tabIndex={-1}
              autoComplete="off"
              className="lead-modal-hp"
              aria-hidden
            />

            <label className="lead-modal-field">
              <span>{ru ? "Имя" : "Name"} *</span>
              <input name="name" required maxLength={120} autoComplete="name" />
            </label>
            <label className="lead-modal-field">
              <span>Email *</span>
              <input
                name="email"
                type="email"
                required
                maxLength={200}
                autoComplete="email"
              />
            </label>
            <label className="lead-modal-field">
              <span>{ru ? "Телефон / WhatsApp" : "Phone / WhatsApp"}</span>
              <input
                name="phone"
                type="tel"
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <label className="lead-modal-field">
              <span>{ru ? "Комментарий" : "Message"}</span>
              <textarea name="message" rows={4} maxLength={4000} />
            </label>

            <label className="lead-modal-consent">
              <input type="checkbox" name="consent" required />
              <span>
                {ru
                  ? "Я согласен(на) на обработку персональных данных в соответствии с "
                  : "I consent to the processing of my personal data as described in the "}
                <Link href="/privacy" target="_blank" rel="noopener">
                  {ru ? "политикой конфиденциальности" : "privacy policy"}
                </Link>
                {" *"}
              </span>
            </label>
            <TurnstileWidget />

            {state.error ? (
              <p className="lead-modal-err">{state.error}</p>
            ) : null}

            <div className="lead-modal-actions">
              <button type="button" className="lead-modal-btn ghost" onClick={onClose}>
                {ru ? "Отмена" : "Cancel"}
              </button>
              <button type="submit" className="lead-modal-btn primary">
                {ru ? "Отправить" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
