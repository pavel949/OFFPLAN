import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadUnified } from "@/lib/leads/unified";
import { LeadEditForm } from "./lead-edit-form";
import { LeadAiPanel } from "./lead-ai-panel";

const statusRu = {
  new: "Новый",
  contacted: "В работе",
  qualified: "Квалифицирован",
  closed: "Закрыт",
  lost: "Не целевой",
} as const;

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadUnified(id);
  if (!lead) notFound();

  return (
    <div>
      <p className="mb-4">
        <Link
          href="/admin/leads"
          className="text-sm text-[var(--txt2)] hover:text-[var(--ink)]"
        >
          ← К списку лидов
        </Link>
      </p>
      <h1 className="serif text-2xl mb-1">{lead.name}</h1>
      <p className="text-[var(--txt2)] text-sm mb-6">
        Заявка от{" "}
        {new Date(lead.createdAt).toLocaleString("ru-RU", {
          dateStyle: "full",
          timeStyle: "short",
        })}
      </p>

      <dl className="lead-detail-grid">
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${lead.email}`} className="font-semibold">
              {lead.email}
            </a>
          </dd>
        </div>
        {lead.phone ? (
          <div>
            <dt>Телефон</dt>
            <dd>
              <a href={`tel:${lead.phone}`}>{lead.phone}</a>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Проект</dt>
          <dd>{lead.projectName ?? "—"}</dd>
        </div>
        {lead.projectId != null ? (
          <div>
            <dt>ID проекта в каталоге</dt>
            <dd>#{lead.projectId}</dd>
          </div>
        ) : null}
        <div>
          <dt>Язык интерфейса</dt>
          <dd>{lead.locale === "ru" ? "Русский" : "English"}</dd>
        </div>
        <div>
          <dt>Сообщение клиента</dt>
          <dd className="whitespace-pre-wrap">{lead.message || "—"}</dd>
        </div>
      </dl>

      <h2 className="serif text-lg mb-2">Обработка</h2>
      <LeadEditForm
        leadId={lead.id}
        initialStatus={lead.status}
        initialNotes={lead.notes}
        statusLabels={statusRu}
      />

      <LeadAiPanel
        leadText={`${lead.message}\n\nNotes: ${lead.notes}`}
      />
    </div>
  );
}
