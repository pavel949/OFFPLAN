import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { responseDuration } from "@/lib/leads/partner";

type Metrics = { project_id: string; project_name: string; views: number; interests: number; leads: number; responded: number; median_response_minutes: number | null };
export default async function PartnerAnalyticsPage() {
  const db = await createSupabaseServerClient();
  if (!db) return <p className="pt-warn">Показатели временно недоступны.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: profile } = await db.from("profiles").select("role,org_id").eq("id",user.id).maybeSingle();
  if (profile?.role !== "partner" || !profile.org_id) return <p className="pt-warn">Для просмотра показателей нужен доступ к компании.</p>;
  const { data, error } = await db.rpc("partner_showcase_metrics");
  return <div>
    <div className="pt-hero"><div><h1>Результаты витрины</h1><p>Последние 30 дней, только проекты вашей компании. Период рассчитывается на момент загрузки.</p></div></div>
    {error ? <p className="pt-warn">Не удалось загрузить показатели. Это не означает отсутствие просмотров или заявок.</p> : !data?.length ? <p className="adm-hint">Добавьте проект: его показатели появятся здесь.</p> : <div style={{overflowX:"auto"}}><table className="adm-table"><thead><tr><th>Проект</th><th>Просмотры</th><th>Открытия формы</th><th>Заявки</th><th>Ответ отмечен</th><th>Медиана до отметки ответа</th></tr></thead><tbody>{(data as Metrics[]).map(row => <tr key={row.project_id}><td><Link href={`/partner/projects/${row.project_id}`}>{row.project_name}</Link></td><td>{row.views}</td><td>{row.interests}</td><td><Link href={`/partner/leads?project=${row.project_id}`}>{row.leads}</Link></td><td>{row.responded} из {row.leads}</td><td>{responseDuration(row.median_response_minutes)}</td></tr>)}</tbody></table></div>}
    <section className="adm-hint" style={{marginTop:24}}><h2>Как читать показатели</h2>
      <p>Просмотры — полученные события открытия страницы проекта. Открытия формы — нажатия двух общих кнопок запроса на странице проекта (не формы отдельных юнитов или каталога), сигнал интереса, а не отправленные заявки. Открытия формы записываются с момента запуска этого счётчика, без восстановления истории. Повторные действия учитываются; это не уникальные люди. Блокировщики, ошибки сети и автоматический трафик влияют на счётчики. Ноль означает отсутствие записанных событий, а не доказанное отсутствие посетителей.</p>
      <p>Заявки — сохранённые обращения по проекту за 30 дней, независимо от доставки уведомления. Конверсию не показываем: события и заявки не связаны с уникальными посетителями.</p>
      <p>Ответ — явная отметка ответственного «Я ответил покупателю сейчас». Медиана считается от создания заявки до первой отметки только для обращений этого периода с отметкой; заявки без неё не входят. Это время регистрации ответа, не подтверждение доставки или прочтения. Старые ответы не восстанавливаются из статусов.</p>
      <p>Доставка email и webhook пока не подтверждается в кабинете. Проверяйте новые обращения в <Link href="/partner/leads">списке заявок</Link>.</p>
    </section>
  </div>;
}
