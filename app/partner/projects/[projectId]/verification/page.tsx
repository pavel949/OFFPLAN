import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EvidenceForm, MessageForm, StartCaseForm, SubmitCaseForm } from "@/components/registry/forms";
import { effectiveLevel, LEVEL_TEXT, type VerificationLevel } from "@/lib/registry/levels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATUS_RU: Record<string, string> = {
  draft: "Черновик",
  submitted: "Подана, ждёт эксперта",
  in_review: "На проверке у эксперта",
  changes_requested: "Эксперт запросил уточнения",
  approved: "Одобрена",
  rejected: "Отклонена",
  withdrawn: "Отозвана",
};
const ITEM_RU: Record<string, string> = {
  pending: "нужен документ",
  provided: "загружено",
  verified: "проверено",
  failed: "не пройдено",
  na: "не применимо",
};

type Tpl = { key: string; title: { ru: string }; hint: { ru: string } };

export default async function PartnerVerificationPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p className="text-[var(--muted)]">Настройте Supabase</p>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") redirect("/partner");
  const { data: project } = await supabase
    .from("catalog_projects")
    .select("id, slug, org_id, verification_level, verified_at, verification_expires_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.org_id !== prof.org_id) notFound();

  const level = effectiveLevel({
    level: project.verification_level as VerificationLevel,
    verifiedAt: project.verified_at as string | null,
    expiresAt: project.verification_expires_at as string | null,
  });

  const { data: cases } = await supabase
    .from("verification_cases")
    .select("id, target_level, status, public_summary, template_id, submitted_at, decided_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);
  const open = (cases ?? []).find((c) => ["draft", "submitted", "in_review", "changes_requested"].includes(c.status as string));
  const editable = open ? ["draft", "changes_requested"].includes(open.status as string) : false;

  let items: { item_key: string; required: boolean; status: string; evidence: { filename: string }[]; reviewer_note: string }[] = [];
  let tpl: Tpl[] = [];
  let messages: { id: string; author_side: string; body: string; created_at: string }[] = [];
  if (open) {
    const [i, t, m] = await Promise.all([
      supabase.from("verification_items").select("item_key, required, status, evidence, reviewer_note").eq("case_id", open.id),
      supabase.from("verification_checklist_templates").select("items").eq("id", open.template_id).maybeSingle(),
      supabase.from("verification_messages").select("id, author_side, body, created_at").eq("case_id", open.id).order("created_at"),
    ]);
    items = (i.data ?? []) as typeof items;
    tpl = ((t.data?.items as Tpl[]) ?? []);
    messages = (m.data ?? []) as typeof messages;
  }
  const title = (k: string) => tpl.find((x) => x.key === k)?.title.ru ?? k;
  const hint = (k: string) => tpl.find((x) => x.key === k)?.hint.ru ?? "";
  const history = (cases ?? []).filter((c) => !["draft", "submitted", "in_review", "changes_requested"].includes(c.status as string));

  return (
    <div className="max-w-3xl">
      <p className="mb-4">
        <Link href={`/partner/projects/${projectId}`} className="text-sm text-[var(--muted)] underline">← Проект</Link>
      </p>
      <h1 className="serif text-2xl mb-2">Верификация проекта</h1>
      <p className="text-sm mb-1">
        Текущий уровень: <b>{LEVEL_TEXT[level].ruShort}</b> — {LEVEL_TEXT[level].ru}
        {level > 0 && project.verification_expires_at
          ? ` · действует до ${new Date(project.verification_expires_at as string).toLocaleDateString("ru-RU")}`
          : ""}
      </p>
      <p className="text-sm text-[var(--muted)] mb-6">
        Решение принимает независимый эксперт реестра. Стоимость проверки не зависит от результата.{" "}
        <Link className="underline" href="/registry">Методика и правила</Link>
      </p>

      {!open ? (
        <div className="space-y-3 mb-8">
          {level < 1 ? <StartCaseForm projectId={projectId} level={1} label="Начать проверку L1 — документы" /> : null}
          {level >= 1 ? <StartCaseForm projectId={projectId} level={2} label="Начать проверку L2 — независимая юридическая" /> : null}
          {level >= 1 ? <StartCaseForm projectId={projectId} level={1} label="Продлить L1 (повторная проверка)" /> : null}
        </div>
      ) : (
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-1">
            Заявка на L{open.target_level} · {STATUS_RU[open.status as string]}
          </h2>
          <ul className="divide-y divide-[var(--bdr)] mb-4">
            {items.map((i) => (
              <li key={i.item_key} className="py-3">
                <div className="flex justify-between gap-2">
                  <b className="text-sm">{title(i.item_key)}{i.required ? " *" : ""}</b>
                  <span className="text-xs text-[var(--muted)]">{ITEM_RU[i.status]}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mb-1">{hint(i.item_key)}</p>
                {i.evidence?.length ? (
                  <p className="text-xs mb-1">Файлы: {i.evidence.map((e) => e.filename).join(", ")}</p>
                ) : null}
                {i.reviewer_note ? <p className="text-xs" style={{ color: "var(--amb)" }}>Замечание эксперта: {i.reviewer_note}</p> : null}
                {editable && i.status !== "verified" ? <EvidenceForm caseId={open.id as string} itemKey={i.item_key} /> : null}
              </li>
            ))}
          </ul>
          {editable ? <SubmitCaseForm caseId={open.id as string} projectId={projectId} /> : null}

          <h3 className="text-sm font-bold uppercase tracking-wide mt-6 mb-2">Переписка с экспертом</h3>
          <ul className="space-y-2 mb-3">
            {messages.map((m) => (
              <li key={m.id} className="text-sm border rounded p-2">
                <span className="text-xs text-[var(--muted)]">
                  {m.author_side === "reviewer" ? "Эксперт" : "Вы"} · {new Date(m.created_at).toLocaleString("ru-RU")}
                </span>
                <br />
                {m.body}
              </li>
            ))}
          </ul>
          <MessageForm caseId={open.id as string} projectId={projectId} />
        </section>
      )}

      {history.length ? (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2">История</h2>
          <ul className="text-sm space-y-2">
            {history.map((c) => (
              <li key={c.id as string}>
                L{c.target_level} · {STATUS_RU[c.status as string]}
                {c.decided_at ? ` · ${new Date(c.decided_at as string).toLocaleDateString("ru-RU")}` : ""}
                {c.public_summary ? <div className="text-[var(--muted)]">{c.public_summary as string}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
