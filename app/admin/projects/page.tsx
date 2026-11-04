import Link from "next/link";
import { adminStudioList, type StudioRow } from "@/app/actions/admin-studio";
import { ProjectsTable } from "@/components/admin/ProjectsTable";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

export default async function AdminProjectsPage() {
  if (!hasSupabaseServiceConfig()) {
    return (
      <div className="adm-wrap">
        <div className="adm-head"><h1>Проекты</h1></div>
        <p className="adm-msg err">Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении.</p>
      </div>
    );
  }
  let rows: StudioRow[] = [];
  let err: string | null = null;
  try {
    rows = await adminStudioList();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div>
          <h1>Проекты каталога</h1>
          <p className="adm-sub">Откройте проект, чтобы внести данные: основное, лоты и цены, фото, новости, ссылки. Красные нули показывают, чего не хватает.</p>
        </div>
        <Link href="/admin/projects/new" className="adm-btn">+ Новый проект</Link>
      </div>
      {err ? <p className="adm-msg err">{err}</p> : <ProjectsTable rows={rows} />}
    </div>
  );
}
