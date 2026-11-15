import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createPartnerProjectFromWizard } from "@/app/actions/project-evidence";
import { getRegionMeta } from "@/lib/locations";
import { ProjectWizardForm } from "@/components/portal/ProjectWizardForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewProject() {
  const db = await createSupabaseServerClient();
  if (!db) redirect("/partner");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await db
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  const { data: org } = prof?.org_id
    ? await db.from("orgs").select("name_ru, name_en").eq("id", prof.org_id).maybeSingle()
    : { data: null };

  const regions = await getRegionMeta();
  const zones = Object.values(regions).filter((r) => r.level === "district").map((r) => r.zone).sort();
  return (
    <div>
      <h1 className="serif text-2xl mb-1">Новый проект</h1>
      <p className="text-sm text-[var(--muted,#666)] mb-6 max-w-2xl">
        Заполните основные сведения за 2–3 минуты. Проект сохранится как черновик: потом вы добавите
        ссылки на материалы, прайс-лист и отправите проект на проверку команде IE.
      </p>
      <ProjectWizardForm creationId={randomUUID()}
        action={createPartnerProjectFromWizard}
        zones={zones.length ? zones : undefined}
        developerName={org?.name_ru || org?.name_en || ""}
      />
    </div>
  );
}

