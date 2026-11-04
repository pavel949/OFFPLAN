import { getAdminSessionOk } from "@/lib/admin-server-auth";
import Link from "next/link";
import { adminCreateProjectFromWizard } from "@/app/actions/project-evidence";
import { getRegionMeta } from "@/lib/locations";
import { ProjectWizardForm } from "@/components/portal/ProjectWizardForm";
import { hasSupabaseServiceConfig, createServiceRoleClient } from "@/lib/supabase/service";

export default async function AdminNewProjectPage() {
  if (!(await getAdminSessionOk())) return null;
  if (!hasSupabaseServiceConfig()) {
    return <p className="text-[var(--red)] text-sm">Задайте SUPABASE_SERVICE_ROLE_KEY.</p>;
  }
  const { data } = await createServiceRoleClient()
    .from("orgs")
    .select("id, name_ru")
    .eq("kind", "developer")
    .order("name_ru");
  const regions = await getRegionMeta();
  const zones = Object.values(regions).filter((r) => r.level === "district").map((r) => r.zone).sort();
  const orgs = (data ?? []).map((o) => ({ id: o.id as string, name: o.name_ru as string }));
  return (
    <div>
      <p className="mb-4">
        <Link href="/admin/projects" className="text-sm underline">← Все проекты</Link>
      </p>
      <h1 className="serif text-2xl mb-1">Новый проект</h1>
      <p className="text-sm text-[var(--txt2)] mb-6 max-w-2xl">
        Форма для оператора. Рейтинг, риск и рекомендации после создания правятся в карточке проекта.
      </p>
      <ProjectWizardForm action={adminCreateProjectFromWizard} orgs={orgs} zones={zones.length ? zones : undefined} adminMode />
    </div>
  );
}
