"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { runQuickAssessment } from "@/app/actions/quick-assessment";
import { type Stage } from "@/lib/clearview/engine";
import type { PublicQuickResult, Respondent } from "@/lib/clearview/quick";

type Q = { id: string; text: string; help?: string; options: { id: string; label: string }[] };
const STAGES: [Stage, string][] = [["prelaunch", "Ещё не начали строить"], ["early", "Стройка началась"], ["mid", "Середина стройки"], ["late", "Почти готов"], ["completed", "Сдан"]];
const IMPACT: Record<string, string> = { high: "В первую очередь", medium: "Запросить подтверждение", low: "Уточнить" };

export function QuickAssessment({ questions }: { questions: Q[] }) {
  const [step, setStep] = useState<number | "result">(-1);
  const [respondent, setRespondent] = useState<Respondent>("buyer");
  const [stage, setStage] = useState<Stage>("mid");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublicQuickResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const choosing = useRef(false);

  const total = questions.length;
  const idx = typeof step === "number" ? step : total;

  function finish(a: Record<string, string>) {
    start(async () => {
      try {
        const r = await runQuickAssessment({ respondent, stage, answers: a });
        if (r.ok) { setResult(r.result); setStep("result"); setErr(null); } else setErr(r.error);
      } catch {
        setErr("Не удалось получить результат. Попробуйте ещё раз.");
      } finally { choosing.current = false; }
    });
  }
  function choose(q: Q, optionId: string) {
    if (choosing.current || busy) return;
    const next = { ...answers, [q.id]: optionId };
    setAnswers(next);
    if (idx + 1 >= total) { choosing.current = true; finish(next); }
    else setStep(idx + 1);
  }
  function skip() {
    const q = questions[idx];
    const unknown = q.options.find((o) => o.id === "unknown");
    const next = { ...answers };
    if (unknown) next[q.id] = "unknown"; else delete next[q.id];
    setAnswers(next);
    if (idx + 1 >= total) finish(next);
    else setStep(idx + 1);
  }
  function restart() { setAnswers({}); setResult(null); setErr(null); setStep(-1); }

  if (step === -1) {
    return (
      <div className="cv-wiz">
        <h2>Быстрая проверка проекта</h2>
        <p className="cv-lead">{total} коротких вопросов: что известно с ваших слов и какие документы нужно запросить. Занимает около трёх минут, регистрация не нужна.</p>
        <fieldset><legend>Кто отвечает?</legend>
          <div className="cv-opts cv-opts--row">
            {([["buyer", "Покупатель или консультант", "Данные из брошюры, от агента или из договора"], ["developer", "Застройщик", "Данные о собственном проекте"]] as const).map(([k, t, d]) => (
              <button key={k} type="button" className={`cv-opt${respondent === k ? " on" : ""}`} onClick={() => setRespondent(k)}><b>{t}</b><small>{d}</small></button>
            ))}
          </div>
        </fieldset>
        <fieldset><legend>Стадия проекта</legend>
          <div className="cv-chips">{STAGES.map(([k, t]) => <button key={k} type="button" className={`cv-chip2${stage === k ? " on" : ""}`} onClick={() => setStage(k)}>{t}</button>)}</div>
        </fieldset>
        <button type="button" className="ie-btn ie-btn--gold" onClick={() => setStep(0)}>Начать</button>
        <p className="cv-note">Это предварительная самооценка. Она не является оценкой ClearView и не заменяет проверку документов.</p>
      </div>
    );
  }

  if (step === "result" && result) return <Result r={result} respondent={respondent} onRestart={restart} onFix={() => { const i = questions.findIndex((q) => !answers[q.id] || answers[q.id] === "unknown"); setStep(i >= 0 ? i : 0); }} />;

  const q = questions[Math.min(idx, total - 1)];
  return (
    <div className="cv-wiz">
      <div className="cv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx}><b style={{ width: `${(idx / total) * 100}%` }} /></div>
      <p className="cv-step-n">Вопрос {idx + 1} из {total}</p>
      <h2>{q.text}</h2>
      {q.help ? <p className="cv-lead">{q.help}</p> : null}
      <div className="cv-opts">
        {q.options.map((o) => <button key={o.id} type="button" className={`cv-opt${answers[q.id] === o.id ? " on" : ""}`} disabled={busy} onClick={() => choose(q, o.id)}><b>{o.label}</b></button>)}
      </div>
      <div className="cv-nav">
        <button type="button" className="ie-btn ie-btn--line" disabled={busy} onClick={() => setStep(idx === 0 ? -1 : idx - 1)}>Назад</button>
        {!q.options.some((o) => o.id === "unknown") ? <button type="button" className="ie-btn ie-btn--line" disabled={busy} onClick={skip}>Пропустить</button> : null}
        {busy ? <span className="cv-note">Считаем…</span> : null}
        {err ? <span className="cv-err">{err}</span> : null}
      </div>
    </div>
  );
}

function Result({ r, respondent, onRestart, onFix }: { r: PublicQuickResult; respondent: Respondent; onRestart: () => void; onFix: () => void }) {
  return (
    <div className="cv-res">
      <div className="cv-wiz cv-res-top">
        <p className="cv-step-n">Предварительная самопроверка</p>
        <h2>{r.blocked ? "Есть заявленные стоп-условия" : "Список вопросов для проверки"}</h2>
        <p className="cv-lead">Это ответы {respondent === "developer" ? "застройщика" : "покупателя или консультанта"}, не проверенные платформой. Рейтинг проекта не присваивается. {r.blocked ? "Разберите стоп-условия с независимым юристом до сделки." : "Даже положительные ответы нужно подтвердить документами."}</p>
      </div>

      {r.flags.length ? (
        <div className="cv-wiz cv-flags">
          <h3>Стоп-условия</h3>
          <ul>{r.flags.map((f) => <li key={f.gate}><b>{f.gate}</b> {f.text}</li>)}</ul>
        </div>
      ) : null}

      {r.unresolvedGates.length ? <div className="cv-wiz"><h3>Стоп-условия, которые ещё не проверены</h3><ul>{r.unresolvedGates.map(f => <li key={f.gate}>{f.text}</li>)}</ul><p className="cv-note">Нет данных не означает, что условие сработало или исключено.</p></div> : null}
      <div className="cv-wiz"><h3>Что известно по областям</h3>
        <div style={{ display: "grid", gap: 10 }}>{r.domains.map(d => <div key={d.code} className="cv-row"><span>{d.ru}</span><span>{d.status === "risk_reported" ? "Есть риск по ответам" : d.status === "needs_verification" ? "Нужны документы" : "Не оценивалось в этой анкете"}</span></div>)}</div>
      </div>

      {r.nextSteps.length ? (
        <div className="cv-wiz"><h3>Что проверить в первую очередь</h3>
          <ol className="cv-steps">{r.nextSteps.map((s) => <li key={s.text}><span>{s.text}</span><em className={`cv-imp cv-imp--${s.impact}`}>{IMPACT[s.impact]}</em></li>)}</ol>
        </div>
      ) : null}

      <div className="cv-wiz">
        <h3>Полнота ответов</h3>
        <div className="cv-progress"><b style={{ width: `${(r.answered / r.total) * 100}%` }} /></div>
        <p className="cv-lead">Содержательных ответов: {r.answered} из {r.total}. Ответы «не знаю» не учитываются. Это не доля проверенных документов.</p>
        {r.coverage !== "high" ? <button type="button" className="ie-btn ie-btn--line" onClick={onFix}>Дополнить ответы</button> : null}
      </div>

      <div className="cv-wiz cv-cta">
        {respondent === "developer" ? (
          <><h3>Обсудить проверку документов</h3><p className="cv-lead">Уточните доступность проверки, состав документов и условия. Самопроверка не оформляет заказ и не выдаёт значок.</p>
            <Link className="ie-btn ie-btn--gold" href="/protection/contact">Обсудить проверку</Link></>
        ) : (
          <><h3>Нужна проверка конкретного проекта?</h3><p className="cv-lead">Напишите нам название проекта: мы подскажем, есть ли по нему независимая оценка и какие документы запросить.</p>
            <Link className="ie-btn ie-btn--gold" href="/protection/contact">Запросить проверку</Link></>
        )}
        <Link className="ie-btn ie-btn--line" href="/methodology" style={{ marginLeft: 10 }}>Как устроена методология</Link>
      </div>

      <p className="cv-note">{r.note}</p>
      <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="ie-btn ie-btn--line" onClick={onRestart}>Пройти заново</button>
        <button type="button" className="ie-btn ie-btn--line" onClick={() => window.print()}>Распечатать</button>
      </p>
    </div>
  );
}
