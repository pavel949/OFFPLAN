import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChangesForm,
  ClaimForm,
  DecideForm,
  EvidenceLink,
  MessageForm,
  RecuseForm,
  ReviewItemForm,
  RevokeForm,
} from "@/components/registry/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ITEM_RU: Record<string, string> = {
  pending: "ожидает",
  provided: "документы загружены",
  verified: "проверено",
  failed: "не пройдено",
  na: "не применимо",
};

type Tpl = { key: string; title: { ru: string }; hint: { ru: string } };
type Item = {
  item_key: string;
  required: boolean;
  status: string;
  evidence: { path: string; filename: string }[];
  reviewer_note: string;
  verified_by: string | null;
};

export default async function ReviewCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p style={{ padding: 24 }}>Supabase не настроен</p>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/registry/login");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = prof?.role as string | undefined;
  if (!role || !["reviewer", "admin", "editor"].includes(role)) {
    return <p style={{ padding: 24 }}>Нет доступа.</p>;
  }
  const isReviewer = role === "reviewer";

  const { data: c } = await supabase
    .from("verification_cases")
    .select(
      "id, project_id, target_level, status, template_id, assigned_reviewer, public_summary, catalog_projects(slug, verification_level, payload), orgs(name_ru)",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (!c) notFound();
  const cp = c.catalog_projects as unknown as { slug: string; verification_level: number; payload: { n?: string } | null } | null;
  const org = c.orgs as unknown as { name_ru: string } | null;

  const [i, t, m, conflict] = await Promise.all([
    supabase.from("verification_items").select("item_key, required, status, evidence, reviewer_note, verified_by").eq("case_id", caseId),
    supabase.from("verification_checklist_templates").select("items").eq("id", c.template_id).maybeSingle(),
    supabase.from("verification_messages").select("id, author_side, body, created_at").eq("case_id", caseId).order("created_at"),
    isReviewer ? supabase.rpc("reviewer_conflicted", { p_case: caseId, p_reviewer: user.id }) : Promise.resolve({ data: false }),
  ]);
  const items = (i.data ?? []) as unknown as Item[];
  const tpl = ((t.data?.items as Tpl[]) ?? []);
  const title = (k: string) => tpl.find((x) => x.key === k)?.title.ru ?? k;
  const hint = (k: string) => tpl.find((x) => x.key === k)?.hint.ru ?? "";
  const messages = (m.data ?? []) as { id: string; author_side: string; body: string; created_at: string }[];

  const conflicted = conflict.data === true;
  const mine = c.assigned_reviewer === user.id;
  const iVerifiedSomething = items.some((x) => x.verified_by === user.id);
  const inReview = c.status === "in_review";
  const open = ["submitted", "in_review", "changes_requested"].includes(c.status as string);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      <p className="mb-4">
        <Link href="/registry/review" className="text-sm underline">← Очередь</Link>
      </p>
      <h1 className="serif text-2xl mb-1">{cp?.payload?.n ?? cp?.slug}</h1>
      <p className="text-sm mb-4" style={{ opacity: 0.8 }}>
        {org?.name_ru} · заявка на L{c.target_level} · статус: <b>{c.status as string}</b>
        {cp ? ` · текущий уровень проекта: L${cp.verification_level}` : ""}
      </p>

      {conflicted ? (
        <p className="text-sm mb-4 p-3 rounded" style={{ border: "1px solid var(--red)", color: "var(--red)" }}>
          Конфликт интересов: вы не можете вести это дело. Передайте его другому эксперту.
        </p>
      ) : null}

      {isReviewer && !conflicted && c.status === "submitted" ? <div className="mb-4"><ClaimForm caseId={caseId} /></div> : null}

      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Чек-лист</h2>
      <ul className="divide-y mb-6" style={{ borderColor: "var(--bdr)" }}>
        {items.map((it) => (
          <li key={it.item_key} className="py-3">
            <div className="flex justify-between gap-2">
              <b className="text-sm">{title(it.item_key)}{it.required ? " *" : ""}</b>
              <span className="text-xs" style={{ opacity: 0.7 }}>{ITEM_RU[it.status]}</span>
            </div>
            <p className="text-xs mb-1" style={{ opacity: 0.7 }}>{hint(it.item_key)}</p>
            <p className="text-sm mb-1">
              {it.evidence?.length
                ? it.evidence.map((e, k) => (
                    <span key={k} style={{ marginRight: 10 }}>
                      <EvidenceLink caseId={caseId} path={e.path} filename={e.filename} />
                    </span>
                  ))
                : <span style={{ opacity: 0.6 }}>файлов нет</span>}
            </p>
            {it.reviewer_note ? <p className="text-xs">Комментарий: {it.reviewer_note}</p> : null}
            {isReviewer && inReview && mine && !conflicted ? <ReviewItemForm caseId={caseId} itemKey={it.item_key} current={it.status} /> : null}
          </li>
        ))}
      </ul>

      {isReviewer && open && !conflicted ? (
        <section className="space-y-6 mb-8">
          {inReview && mine ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-1">Запросить уточнения</h3>
              <ChangesForm caseId={caseId} />
            </div>
          ) : null}
          {inReview ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-1">Решение</h3>
              {mine || iVerifiedSomething ? (
                <p className="text-sm" style={{ opacity: 0.75 }}>
                  Итоговое решение принимает другой эксперт (правило «четырёх глаз»). Передайте дело коллеге.
                </p>
              ) : (
                <DecideForm caseId={caseId} />
              )}
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-1">Самоотвод</h3>
            <RecuseForm caseId={caseId} />
          </div>
        </section>
      ) : null}

      {isReviewer && cp && cp.verification_level > 0 ? (
        <section className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-1">Отзыв верификации проекта</h3>
          <RevokeForm projectId={c.project_id as string} />
        </section>
      ) : null}

      {c.public_summary ? (
        <p className="text-sm mb-6"><b>Публичное обоснование:</b> {c.public_summary as string}</p>
      ) : null}

      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Переписка с застройщиком</h2>
      <ul className="space-y-2 mb-3">
        {messages.map((x) => (
          <li key={x.id} className="text-sm border rounded p-2">
            <span className="text-xs" style={{ opacity: 0.65 }}>
              {x.author_side === "reviewer" ? "Эксперт" : "Застройщик"} · {new Date(x.created_at).toLocaleString("ru-RU")}
            </span>
            <br />
            {x.body}
          </li>
        ))}
      </ul>
      {isReviewer && !conflicted && open ? <MessageForm caseId={caseId} /> : null}
    </main>
  );
}
