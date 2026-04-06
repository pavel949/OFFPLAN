"use client";

import { useActionState, useEffect, useState } from "react";
import { submitLead, type SubmitLeadState } from "@/app/actions/leads";
import "./lead-modal.css";

const initial: SubmitLeadState = { ok: false };

export function LeadModal({
  open,
  onClose,
  lang,
  projectId,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  lang: "en" | "ru";
  projectId: number | null;
  projectName: string | null;
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
