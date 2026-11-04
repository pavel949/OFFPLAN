"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { runQuickAssessment } from "@/app/actions/quick-assessment";
import { TIER_RU, type Stage } from "@/lib/clearview/engine";
import type { PublicQuickResult, Respondent } from "@/lib/clearview/quick";
import { LevelBar, Radar, TIER_COLOR, TierLadder } from "./charts";

type Q = { id: string; text: string; help?: string; options: { id: string; label: string }[] };
const STAGES: [Stage, string][] = [["prelaunch", "Ещё не начали строить"], ["early", "Стройка началась"], ["mid", "Середина стройки"], ["late", "Почти готов"], ["completed", "Сдан"]];
const IMPACT: Record<string, string> = { high: "Высокое влияние", medium: "Среднее влияние", low: "Низкое влияние" };

export function QuickAssessment({ questions }: { questions: Q[] }) {
  const [step, setStep] = useState<number | "result">(-1);
  const [respondent, setRespondent] = useState<Respondent>("buyer");
  const [stage, setStage] = useState<Stage>("mid");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublicQuickResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const total = questions.length;
  const idx = typeof step === "number" ? step : total;

  function finish(a: Record<string, string>) {
    start(async () => {
      const r = await runQuickAssessment({ respondent, stage, answers: a });
      if (r.ok) { setResult(r.result); setStep("result"); setErr(null); } else setErr(r.error);
    });
  }
  function choose(q: Q, optionId: string) {
    const next = { ...answers, [q.id]: optionId };
    setAnswers(next);
    window.setTimeout(() => (idx + 1 >= total ? finish(next) : setStep(idx + 1)), 140);
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
  function restart() { setAnswers({}); setResult(null); setStep(-1); }

  if (step === -1) {
    return (
      <div className="cv-wiz">
        <h2>Быстрая проверка проекта</h2>
        <p className="cv-lead">Четырнадцать коротких вопросов: уровень проекта до проверки документов и главные риски. Занимает около трёх минут, регистрация не нужна.</p>
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
        {q.options.map((o) => <button key={o.id} type="button" className={`cv-opt${answers[q.id] === o.id ? " on" : ""}`} onClick={() => choose(q, o.id)}><b>{o.label}</b></button>)}
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
  const same = r.tierRange.low === r.tierRange.high;
  const title = same ? TIER_RU[r.tierRange.high].label : `${TIER_RU[r.tierRange.low].label} – ${TIER_RU[r.tierRange.high].label}`;
  return (
    <div className="cv-res">
      <div className="cv-wiz cv-res-top">
        <p className="cv-step-n">Предварительный уровень по вашим ответам</p>
        <h2 style={{ color: TIER_COLOR[r.tierRange.high] }}>{r.blocked ? "Не рекомендуется: есть стоп-условие" : title}</h2>
        <TierLadder low={r.tierRange.low} high={r.tierRange.high} />
        <p className="cv-lead" style={{ marginTop: 12 }}>
          {r.blocked
            ? "По вашим ответам сработало условие, при котором оценка прекращается. Его нужно проверить в первую очередь."
            : respondent === "developer"
              ? "Это уровень по вашим собственным данным. Без подтверждения документами из реестров и писем третьих лиц проект не поднимается выше «Серебра»."
              : "Сведения без подтверждения документами считаются менее надёжными, поэтому уровень занижен. Независимая проверка покажет реальную картину."}
        </p>
      </div>

      {r.flags.length ? (
        <div className="cv-wiz cv-flags">
          <h3>Стоп-условия</h3>
          <ul>{r.flags.map((f) => <li key={f.gate}><b>{f.gate}</b> {f.text}</li>)}</ul>
        </div>
      ) : null}

      <div className="cv-grid2">
        <div className="cv-wiz"><h3>Области</h3><Radar data={r.domains.map((d) => ({ code: d.code, label: d.ru, level: d.level }))} /></div>
        <div className="cv-wiz"><h3>Уровень по областям</h3>
          <div style={{ display: "grid", gap: 10 }}>{r.domains.map((d) => <div key={d.code} className="cv-row"><span><b>{d.code}</b> {d.ru}</span><LevelBar level={d.level} /></div>)}</div>
        </div>
      </div>

      {r.nextSteps.length ? (
        <div className="cv-wiz"><h3>Что проверить в первую очередь</h3>
          <ol className="cv-steps">{r.nextSteps.map((s) => <li key={s.text}><span>{s.text}</span><em className={`cv-imp cv-imp--${s.impact}`}>{IMPACT[s.impact]}</em></li>)}</ol>
        </div>
      ) : null}

      <div className="cv-wiz">
        <h3>Полнота ответов</h3>
        <div className="cv-progress"><b style={{ width: `${(r.answered / r.total) * 100}%` }} /></div>
        <p className="cv-lead">Вы ответили на {r.answered} из {r.total} вопросов. {r.coverage !== "high" ? "Чем больше ответов, тем уже диапазон." : ""}</p>
        {r.coverage !== "high" ? <button type="button" className="ie-btn ie-btn--line" onClick={onFix}>Дополнить ответы</button> : null}
      </div>

      <div className="cv-wiz cv-cta">
        {respondent === "developer" ? (
          <><h3>Подтвердить уровень независимой оценкой</h3><p className="cv-lead">Оценка ClearView от 49 000 ฿ (без НДС): закрытый отчёт с планом улучшений, публичное резюме и значок.</p>
            <Link className="ie-btn ie-btn--gold" href="/partner/login">Заказать в кабинете застройщика</Link></>
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
