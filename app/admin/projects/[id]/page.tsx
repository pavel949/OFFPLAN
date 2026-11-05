import Link from "next/link";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import {
  adminListInterests, adminListProjectDocuments, adminListProjectUnits, adminGetProjectPayload,
  adminImportProjectUnits,
} from "@/app/actions/admin-brain";
import { adminAddSource, adminConfirmSource, adminDeleteSource, adminListSources } from "@/app/actions/project-sources";
import { adminDriveImport, adminDriveList, adminSetSourceSync } from "@/app/actions/drive-sync";
import {
  adminStudioGetProject, adminStudioListNews, adminStudioListPhotos, adminStudioReference,
} from "@/app/actions/admin-studio";
import { InfoForm } from "@/components/admin/InfoForm";
import { NewsPanel } from "@/components/admin/NewsPanel";
import { PhotosManager } from "@/components/admin/PhotosManager";
import { UnitsEditor } from "@/components/admin/UnitsEditor";
import { SalesModelEditor } from "@/components/admin/SalesModelEditor";
import { adminGetSalesModel } from "@/app/actions/sales-model";
import { SourcesManager } from "@/components/portal/SourcesManager";
import { UnitImportPanel } from "@/components/portal/UnitImportPanel";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { taxLabel } from "@/lib/taxonomy";
import { InterestsSection } from "../interests-section";
import { ProjectDocsSection } from "../project-docs-section";
import { ProjectPayloadForm } from "../project-payload-form";

const TABS = [
  ["info", "Основное"],
  ["units", "Лоты и цены"],
  ["sales", "Структура и условия"],
  ["photos", "Фото"],
  ["news", "Новости и акции"],
  ["materials", "Материалы"],
  ["advanced", "Дополнительно"],
] as const;

export default async function AdminProjectEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await getAdminSessionOk())) return null;
  const { id } = await params;
  const wanted = (await searchParams).tab;
  const tab = TABS.some(([k]) => k === wanted) ? wanted! : "info";

  if (!hasSupabaseServiceConfig()) {
    return <p className="adm-msg err">Настройте Supabase (service role).</p>;
  }

  let project;
  try {
    project = await adminStudioGetProject(id);
  } catch {
    notFound();
  }
  const p = project.payload;
  const c = project.counts;
  const badge: Record<string, { n: number | string; cls: string } | null> = {
    info: null,
    units: { n: c.units, cls: c.units ? "ok" : "warn" },
    sales: null,
    photos: { n: c.photos + (c.photosPending ? `+${c.photosPending}` : ""), cls: c.photos ? "ok" : "warn" },
    news: { n: c.news, cls: c.news ? "ok" : "" },
    materials: { n: c.links, cls: c.links ? "ok" : "warn" },
    advanced: null,
  };

  return (
    <div className="adm-wrap">
      <Link href="/admin/projects" className="adm-back">← Все проекты</Link>
      <div className="adm-head">
        <div>
          <h1>{p.n}</h1>
          <p className="adm-sub">
            <span>{p.dev}</span><span>·</span><span>{p.zone}</span><span>·</span><span>{taxLabel("stK", p.stK, "ru", true)}</span>
            <span className={`adm-pill ${project.published ? "ok" : "warn"}`}>{project.published ? "на сайте" : project.status}</span>
            {project.confirmedAt ? <span>данные подтверждены {new Date(project.confirmedAt).toLocaleDateString("ru-RU")}</span> : <span className="adm-zero">данные не подтверждены</span>}
            {project.published ? <Link href={`/project/${project.slug}`} target="_blank">Открыть на сайте ↗</Link> : null}
          </p>
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="adm-hint" style={{ marginBottom: 4 }}>Заполненность: <b>{project.checklist.score}%</b></div>
          <div className={`adm-bar${project.checklist.score === 100 ? " full" : ""}`}><b style={{ width: `${project.checklist.score}%` }} /></div>
        </div>
      </div>

      <nav className="adm-tabs" aria-label="Разделы проекта">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/projects/${id}?tab=${k}`} className={`adm-tab${tab === k ? " on" : ""}`}>
            {label}{badge[k] ? <i className={badge[k]!.cls}>{badge[k]!.n}</i> : null}
          </Link>
        ))}
      </nav>

      {tab === "info" ? <InfoTab project={project} /> : null}
      {tab === "units" ? <UnitsTab id={id} /> : null}
      {tab === "sales" ? <SalesTab id={id} /> : null}
      {tab === "photos" ? <PhotosTab id={id} /> : null}
      {tab === "news" ? <NewsTab id={id} /> : null}
      {tab === "materials" ? <MaterialsTab id={id} /> : null}
      {tab === "advanced" ? <AdvancedTab id={id} /> : null}
    </div>
  );
}

async function InfoTab({ project }: { project: Awaited<ReturnType<typeof adminStudioGetProject>> }) {
  const ref = await adminStudioReference();
  const todo = project.checklist.items.filter((i) => !i.done);
  return (
    <>
      {todo.length ? (
        <section className="adm-card">
          <h3>Что осталось заполнить</h3>
          <ul className="adm-check">
            {todo.map((i) => (
              <li key={i.key}>⬜ <span><Link href={`/admin/projects/${project.id}?tab=${i.tab}`}>{i.label}</Link> <span className="adm-hint">· {i.hint}</span></span></li>
            ))}
          </ul>
        </section>
      ) : null}
      <InfoForm project={project} developers={ref.developers} locations={ref.locations} regions={ref.regions} />
    </>
  );
}

async function UnitsTab({ id }: { id: string }) {
  const units = await adminListProjectUnits(id);
  return (
    <>
      <UnitsEditor projectId={id} initial={units} />
      <details className="adm-card">
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>Загрузить прайс-лист из Excel или CSV</summary>
        <div style={{ marginTop: 14 }}><UnitImportPanel projectId={id} action={adminImportProjectUnits} operator /></div>
      </details>
    </>
  );
}

async function SalesTab({ id }: { id: string }) {
  const data = await adminGetSalesModel(id);
  return <>{data.actor?.startsWith("partner:") && data.publication?.revision!==data.revision ? <div className="adm-card"><h2>Новая версия от застройщика ждёт проверки</h2><p>Версия {data.revision}. Проверьте изменённые цены, наличие, источники и срок действия. Публикация ниже заменит действующие условия только после вашего подтверждения.</p></div> : null}<SalesModelEditor projectId={id} initial={data.model} initialRevision={data.revision} units={data.units} initialPublication={data.publication} /></>;
}

async function PhotosTab({ id }: { id: string }) {
  return <PhotosManager projectId={id} photos={await adminStudioListPhotos(id)} />;
}

async function NewsTab({ id }: { id: string }) {
  const { news, promos } = await adminStudioListNews(id);
  return <NewsPanel projectId={id} news={news} promos={promos} />;
}

async function MaterialsTab({ id }: { id: string }) {
  const { data: imports, error } = await createServiceRoleClient().from("developer_import_projects").select("external_id,name").eq("catalog_project_id",id);
  if (error) throw new Error("Не удалось загрузить материалы мастер-каталога");
  const [sources, docs] = await Promise.all([adminListSources(id).catch(() => []), adminListProjectDocuments(id).catch(() => [])]);
  return (
    <>
      <section className="adm-card">
        <h3>Материалы застройщика (ссылки)</h3>
        {imports?.map(p => <p key={p.external_id}><Link href={`/admin/imports/${p.external_id}`}>Паспорт, исторические цены, лоты и документы {p.name} →</Link></p>)}
        <p className="adm-lead">Сайт проекта, папка с брошюрой и рендерами, прайс-лист, Telegram-канал. Файлы копировать не нужно: достаточно ссылки с доступом по ссылке.</p>
        <SourcesManager
          projectId={id}
          sources={sources}
          api={{ add: adminAddSource, remove: adminDeleteSource, confirm: adminConfirmSource }}
          drive={{ list: adminDriveList, run: adminDriveImport, setSync: adminSetSourceSync }}
        />
      </section>
      <ProjectDocsSection projectId={id} initialDocs={docs} />
    </>
  );
}

async function AdvancedTab({ id }: { id: string }) {
  const [payload, interests] = await Promise.all([adminGetProjectPayload(id), adminListInterests(id).catch(() => ({ interests: [], brokers: [] }))]);
  return (
    <>
      <InterestsSection projectId={id} interests={interests.interests} brokers={interests.brokers} />
      <details className="adm-card">
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>Для специалистов: карточка в JSON</summary>
        <p className="adm-lead" style={{ marginTop: 10 }}>Все поля карточки как есть. Обычно это не нужно: используйте вкладку «Основное».</p>
        <ProjectPayloadForm projectId={id} initialJson={JSON.stringify(payload.payload, null, 2)} />
      </details>
    </>
  );
}
