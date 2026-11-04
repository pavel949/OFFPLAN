import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectsList } from "@/components/partner/ProjectsList";
import { listOrgProjects } from "@/lib/partner-projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerDashboardPage() {
  const db = await createSupabaseServerClient();
  if (!db) return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: prof } = await db.from("profiles").select("role, org_id, full_name, partner_role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id) {
    return (
      <>
        <div className="pt-hero"><div><h1>Добро пожаловать</h1><p>{user.email}</p></div></div>
        <div className="pt-warn">Ваша учётная запись ещё не привязана к компании. Напишите нам, и мы подключим вас за один рабочий день.</div>
        <Link className="adm-btn" href="/protection/contact">Написать команде</Link>
      </>
    );
  }

  const projects = await listOrgProjects(db, prof.org_id);
  const expired = projects.filter((p) => p.expiredPrices);
  const isOwner = prof.partner_role !== "sales";

  return (
    <>
      <div className="pt-hero">
        <div>
          <h1>Здравствуйте{prof.full_name ? `, ${prof.full_name.split(" ")[0]}` : ""}</h1>
          <p>Держите данные проектов актуальными: покупатели видят только подтверждённые цены и свежие фото.</p>
        </div>
        {isOwner ? <Link className="adm-btn" href="/partner/projects/new">+ Добавить проект</Link> : null}
      </div>

      {expired.length ? (
        <div className="pt-warn">
          <b>Цены устарели в проектах: {expired.map((p) => p.name).join(", ")}.</b> Цены старше 30 дней скрыты в каталоге. Откройте проект, вкладку «Лоты и цены», и подтвердите актуальность.
        </div>
      ) : null}

      <ProjectsList projects={projects} isOwner={isOwner} />

      <div className="pt-tiles">
        <Link className="pt-tile" href="/partner/leads"><b>Заявки покупателей</b><span>Кто интересуется вашими проектами и что просит.</span></Link>
        <Link className="pt-tile" href="/partner/deals"><b>Сделки и комиссии</b><span>Статус сделок по вашим проектам.</span></Link>
        <Link className="pt-tile" href="/partner/corrections"><b>Попросить исправить карточку</b><span>Если на сайте неверные данные, сообщите команде.</span></Link>
        <Link className="pt-tile" href="/protection/contact"><b>Связаться с командой</b><span>Вопросы по кабинету, данным и публикации.</span></Link>
      </div>
    </>
  );
}
