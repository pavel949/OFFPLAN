"use server";
import {getAdminSessionOk} from '@/lib/admin-server-auth';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createServiceRoleClient,hasSupabaseServiceConfig} from '@/lib/supabase/service';
import {preparePhotoEvidence,type PhotoUploadBatch} from '@/lib/photo-upload';
import {projectPhotoUrl} from '@/lib/project-evidence';
import type {RecoveredPhoto} from '@/lib/photo-recovery';

/** Read-only reconciliation: never retry a write based on a lost HTTP response. */
export async function reconcilePhotoUploads(batch:PhotoUploadBatch,mode:'admin'|'partner'):Promise<{ok:boolean;error?:string;items?:RecoveredPhoto[]}> {
  try {
    // Validate paths before using a service client. Recheck current authority, not stored browser state.
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const rows=preparePhotoEvidence(batch,url);
    if(mode==='admin') {
      if(!await getAdminSessionOk()) return {ok:false,error:'Нужен вход администратора'};
    } else {
      const client=await createSupabaseServerClient();
      if(!client) return {ok:false,error:'Нет подключения к базе'};
      const {data:{user}}=await client.auth.getUser();
      if(!user) return {ok:false,error:'Войдите'};
      const {data:allowed,error}=await client.rpc('can_submit_project_evidence',{p_project:batch.projectId});
      if(error || !allowed) return {ok:false,error:'Нет прав на материалы этого проекта'};
    }
    if(!hasSupabaseServiceConfig()) return {ok:false,error:'Серверная проверка хранилища недоступна. Не повторяйте загрузку без проверки'};
    const db=createServiceRoleClient();
    const {data:evidence,error}=await db.from('project_evidence').select('id,fact_key,status,details').eq('project_id',batch.projectId).eq('kind','photo').in('fact_key',rows.map(r=>r.fact_key));
    if(error) return {ok:false,error:'Не удалось проверить записи материалов. Не повторяйте загрузку'};
    const items:RecoveredPhoto[]=[];
    for(let i=0;i<batch.items.length;i++) {
      const item=batch.items[i];
      const filename=item.path.split('/')[1];
      const storage=await db.storage.from('project-photos').list(batch.projectId,{search:filename,limit:100});
      const publicUrl=projectPhotoUrl(url,item.path);
      items.push({path:item.path,url:publicUrl,stored:storage.error?null:(storage.data??[]).some(x=>x.name===filename),evidence:(evidence??[]).filter(x=>x.fact_key===rows[i].fact_key && (x.details as {url?:string})?.url===publicUrl).map(x=>({id:x.id,status:x.status}))});
    }
    return {ok:true,items};
  } catch(e) {return {ok:false,error:e instanceof Error?e.message:'Проверка прервана. Не повторяйте загрузку'};}
}
