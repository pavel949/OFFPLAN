import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getAdminSessionOk} from '@/lib/admin-server-auth';
import {createServiceRoleClient} from '@/lib/supabase/service';
import {IMPORT_FIELDS,IMPORT_SECTIONS,DEVELOPER_LABELS,importPage,safeSourceUrl} from '@/lib/developer-import';
export default async function ImportProjectPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{section?:string,page?:string}>}) {
  if(!(await getAdminSessionOk())) return null;
  const {id}=await params;
  if(!/^IE-\d{3}$/.test(id)) notFound();
  const sp=await searchParams;
  const section=sp.section && IMPORT_SECTIONS[sp.section] ? sp.section : 'N02 Projects';
  const page=importPage(sp.page),size=50;
  const db=createServiceRoleClient();
  const {data:p,error}=await db.from('developer_import_projects').select('*').eq('external_id',id).maybeSingle();
  if(error) throw new Error('Не удалось загрузить проект');
  if(!p) notFound();
  const {data:rows,error:re,count}=await db.from('developer_import_records').select('source_row,source_key,data',{count:'exact'}).eq('external_project_id',id).eq('dataset',section).order('source_row').range((page-1)*size,page*size-1);
  if(re) throw new Error('Не удалось загрузить записи источника');
  const cols=[...new Set((rows||[]).flatMap(r=>Object.keys(r.data)))];
  const base=`/admin/imports/${id}?section=${encodeURIComponent(section)}`;
  return <div className="adm-wrap"><Link href="/admin/imports" className="adm-back">← Материалы застройщиков</Link><h1>{p.name}</h1><p>{DEVELOPER_LABELS[p.developer_code]} · {id}</p>
    <section className="adm-card"><p>{p.mapping_note}</p><p>Исторические записи: цена не подтверждает текущее наличие. Ссылки и файлы не публикуются автоматически. Дата загрузки: {new Date(p.imported_at).toLocaleDateString('ru-RU')}.</p><a href={p.source_url} target="_blank" rel="noreferrer">Открыть мастер-каталог ↗</a>{p.catalog_project_id?<p><Link href={`/admin/projects/${p.catalog_project_id}?tab=materials`}>Материалы в карточке проекта →</Link></p>:null}</section>
    <nav className="adm-tabs" aria-label="Материалы проекта">{Object.entries(IMPORT_SECTIONS).filter(([k])=>p.counts[k]).map(([k,label])=><Link className={`adm-tab${section===k?' on':''}`} key={k} href={`/admin/imports/${id}?section=${encodeURIComponent(k)}`}>{label} ({p.counts[k]})</Link>)}</nav>
    <section className="adm-card"><h2>{IMPORT_SECTIONS[section]}</h2><p>Всего записей: {count||0}. Страница {page}.</p><div style={{overflowX:'auto',maxHeight:'70vh'}}><table className="adm-table"><thead><tr>{cols.map(c=><th key={c}>{IMPORT_FIELDS[c] || c}</th>)}</tr></thead><tbody>{rows?.map(r=><tr key={r.source_row}>{cols.map(c=><td key={c} style={{minWidth:130,maxWidth:420,whiteSpace:'normal',overflowWrap:'anywhere'}}>{safeSourceUrl(r.data[c])?<a href={safeSourceUrl(r.data[c])!} target="_blank" rel="noreferrer">Открыть источник ↗</a>:r.data[c]==null?'—':String(r.data[c])}</td>)}</tr>)}</tbody></table></div><p>{page>1?<Link href={`${base}&page=${page-1}`}>← Предыдущая</Link>:null}{' '}{page*size<(count||0)?<Link href={`${base}&page=${page+1}`}>Следующая →</Link>:null}</p></section>
  </div>;
}
