"use client";

import { useActionState, useState } from "react";
import {
  claimCase,
  decideCase,
  evidenceUrl,
  postMessage,
  recuseCase,
  requestChanges,
  reviewItem,
  revokeVerification,
  startVerification,
  submitVerification,
  uploadEvidence,
  type RegState,
} from "@/app/actions/registry";

const init: RegState = { ok: false };

function Result({ s }: { s: RegState }) {
  if (s.error) return <p className="text-sm text-[var(--red)] mt-1">{s.error}</p>;
  if (s.ok) return <p className="text-sm text-[var(--grn)] mt-1">{s.message ?? "Готово"}</p>;
  return null;
}

type A = (p: RegState, fd: FormData) => Promise<RegState>;

function Form({ action, children, className }: { action: A; children: (pending: boolean, s: RegState) => React.ReactNode; className?: string }) {
  const [s, fa, pending] = useActionState(action, init);
  return (
    <form action={fa} className={className}>
      {children(pending, s)}
      <Result s={s} />
    </form>
  );
}

const btn = "admin-btn py-1 px-3 text-sm";

// ---------------- developer ----------------
export function StartCaseForm({ projectId, level, label }: { projectId: string; level: 1 | 2; label: string }) {
  return (
    <Form action={startVerification}>
      {(p) => (
        <>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="level" value={level} />
          <button className={btn} disabled={p}>{label}</button>
        </>
      )}
    </Form>
  );
}

export function EvidenceForm({ caseId, itemKey }: { caseId: string; itemKey: string }) {
  return (
    <Form action={uploadEvidence} className="flex flex-wrap items-center gap-2">
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="item_key" value={itemKey} />
          <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" required className="text-xs" />
          <button className={btn} disabled={p}>Загрузить</button>
        </>
      )}
    </Form>
  );
}

export function SubmitCaseForm({ caseId, projectId }: { caseId: string; projectId: string }) {
  return (
    <Form action={submitVerification}>
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="project_id" value={projectId} />
          <button className="admin-btn py-2 px-4" disabled={p}>Подать на проверку</button>
        </>
      )}
    </Form>
  );
}

export function MessageForm({ caseId, projectId }: { caseId: string; projectId?: string }) {
  return (
    <Form action={postMessage}>
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
          <textarea name="body" rows={3} maxLength={4000} required className="admin-inp mb-1 w-full" placeholder="Сообщение по заявке" />
          <button className={btn} disabled={p}>Отправить</button>
        </>
      )}
    </Form>
  );
}

// ---------------- reviewer ----------------
export function ClaimForm({ caseId }: { caseId: string }) {
  return (
    <Form action={claimCase}>
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <button className={btn} disabled={p}>Взять в работу</button>
        </>
      )}
    </Form>
  );
}

export function RecuseForm({ caseId }: { caseId: string }) {
  return (
    <Form action={recuseCase} className="flex flex-wrap gap-2 items-end">
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <input name="reason" required minLength={5} placeholder="Причина самоотвода" className="admin-inp mb-0" />
          <button className={btn} disabled={p}>Заявить самоотвод</button>
        </>
      )}
    </Form>
  );
}

export function ReviewItemForm({ caseId, itemKey, current }: { caseId: string; itemKey: string; current: string }) {
  return (
    <Form action={reviewItem} className="flex flex-wrap gap-2 items-end">
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="item_key" value={itemKey} />
          <select name="status" defaultValue={current === "provided" ? "verified" : current} className="border rounded text-sm">
            <option value="verified">Проверено</option>
            <option value="failed">Не пройдено</option>
            <option value="na">Не применимо</option>
            <option value="pending">Сбросить</option>
          </select>
          <input name="note" placeholder="Комментарий" className="admin-inp mb-0 flex-1 min-w-[140px]" />
          <button className={btn} disabled={p}>Сохранить</button>
        </>
      )}
    </Form>
  );
}

export function ChangesForm({ caseId }: { caseId: string }) {
  return (
    <Form action={requestChanges}>
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <textarea name="summary" rows={2} required placeholder="Что нужно уточнить застройщику (виден в журнале)" className="admin-inp mb-1 w-full" />
          <button className={btn} disabled={p}>Запросить уточнения</button>
        </>
      )}
    </Form>
  );
}

export function DecideForm({ caseId }: { caseId: string }) {
  const [decision, setDecision] = useState("approved");
  return (
    <Form action={decideCase}>
      {(p) => (
        <>
          <input type="hidden" name="case_id" value={caseId} />
          <select name="decision" value={decision} onChange={(e) => setDecision(e.target.value)} className="border rounded text-sm mb-1">
            <option value="approved">Подтвердить уровень</option>
            <option value="rejected">Отказать</option>
          </select>
          <textarea
            name="summary"
            rows={3}
            required
            minLength={20}
            placeholder="Публичное обоснование решения (не менее 20 символов) — попадёт в открытый журнал"
            className="admin-inp mb-1 w-full"
          />
          <button className="admin-btn py-2 px-4" disabled={p}>Принять решение</button>
        </>
      )}
    </Form>
  );
}

export function RevokeForm({ projectId }: { projectId: string }) {
  return (
    <Form action={revokeVerification}>
      {(p) => (
        <>
          <input type="hidden" name="project_id" value={projectId} />
          <textarea name="reason" rows={2} required minLength={20} placeholder="Причина отзыва (публикуется в журнале)" className="admin-inp mb-1 w-full" />
          <button className={btn} disabled={p}>Отозвать верификацию</button>
        </>
      )}
    </Form>
  );
}

export function EvidenceLink({ caseId, path, filename }: { caseId: string; path: string; filename: string }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        className="underline text-sm"
        onClick={async () => {
          const r = await evidenceUrl(caseId, path);
          if (r.url) window.open(r.url, "_blank", "noopener");
          else setErr(r.error ?? "Ошибка");
        }}
      >
        {filename}
      </button>
      {err ? <span className="text-xs text-[var(--red)]"> {err}</span> : null}
    </span>
  );
}
