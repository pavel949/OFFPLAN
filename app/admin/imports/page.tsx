import Link from 'next/link';
import { getAdminSessionOk } from '@/lib/admin-server-auth';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { DEVELOPER_LABELS } from '@/lib/developer-import';
export default async function ImportsPage() {
  if (!(await getAdminSessionOk())) return null;
  const {data,error}=await createServiceRoleClient().from('developer_import_projects').select('*').order('external_id');
  if(error) throw new Error('Не удалось загрузить материалы застройщиков');
  return <div className="adm-wrap"><div className="adm-head"><div><h1>Материалы застройщиков</h1><p className="adm-sub">Паспорта, фотографии, документы и датированные предложения из мастер-каталога.</p></div></div>
    <section className="adm-card"><p>Цены и наличие здесь — снимки источников на указанные даты. Они не заменяют текущий прайс и не включают бронирование. Исходные варианты владения, корпуса и замечания сохранены.</p><p>Связано с существующими карточками: {data?.filter(p=>p.catalog_project_id).length} из {data?.length}. Остальные проекты доступны для сверки здесь; публичные карточки с вымышленными параметрами не создавались.</p></section>
    {Object.entries(DEVELOPER_LABELS).map(([code,label])=><section className="adm-card" key={code}><h2>{label}</h2><div style={{overflowX:'auto'}}><table className="adm-table"><thead><tr><th>Проект</th><th>Лоты</th><th>Предложения</th><th>Медиа</th><th>Связь с каталогом</th></tr></thead><tbody>{data?.filter(p=>p.developer_code===code).map(p=><tr key={p.external_id}><td><Link href={`/admin/imports/${p.external_id}`}>{p.name}</Link><div className="adm-hint">{p.external_id}</div></td><td>{p.counts['N04 Physical Units']||0}</td><td>{p.counts['N05 Offers']||0}</td><td>{p.counts['N14 Media Assets']||0}</td><td>{p.catalog_project_id?<Link href={`/admin/projects/${p.catalog_project_id}?tab=materials`}>Открыть карточку</Link>:<span>Требуется сопоставление</span>}</td></tr>)}</tbody></table></div></section>)}
  </div>;
}
