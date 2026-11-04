import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectsList } from "@/components/partner/ProjectsList";
import { listOrgProjects } from "@/lib/partner-projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerProjectsPage() {
  const db = await createSupabaseServerClient();
  if (!db) return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await db.from("profiles").select("org_id, partner_role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id) return <div className="pt-warn">Ваша учётная запись ещё не привязана к компании. <Link href="/protection/contact" style={{ textDecoration: "underline" }}>Напишите нам</Link>, и мы подключим вас.</div>;
  const isOwner = prof.partner_role !== "sales";
  return (
    <>
      <div className="pt-hero">
        <div><h1>Мои проекты</h1><p>Изменения в карточке проходят проверку команды IE. Цены, лоты и новости публикуются сразу, фото после быстрой проверки.</p></div>
        {isOwner ? <Link className="adm-btn" href="/partner/projects/new">+ Добавить проект</Link> : null}
      </div>
      <ProjectsList projects={await listOrgProjects(db, prof.org_id)} isOwner={isOwner} />
    </>
  );
}
