// Isolated control-flow checks on actual action code; no network/storage/database writes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root = new URL('../',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const code = stripTypeScriptTypes(read('app/actions/admin-studio.ts').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm,''),{mode:'strip'}).replace(/^export\s+/gm,'');
const pid='11111111-1111-4111-8111-111111111111';
function fixture({invalid=false,unit=true,failAt=0}={}) {
 const calls=[]; let n=0; let table;
 const q={select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='project_units'&&!unit?null:{id:pid}}),insert(row){calls.push(['insert',row]);return this},single:async()=>({data:{id:`photo-${++n}`},error:null})};
 const db={from(t){table=t;return q},rpc:async()=>({error:failAt===n?{message:'test failure'}:null}),storage:{from(){return {createSignedUploadUrl:async path=>{calls.push(['sign',path]);return {data:{token:'fake'},error:null}}}}}};
 const prepare=input=>{if(invalid)throw Error('invalid metadata');return input.items.map(x=>({project_id:pid,kind:'photo',details:x.details??{},title:x.caption}))};
 const actions=new Function('getAdminSessionOk','hasSupabaseServiceConfig','createServiceRoleClient','revalidatePath','preparePhotoEvidence',code+'\nreturn {adminStudioSignUploads,adminStudioRegisterPhotos,adminStudioPhotoDecision};')(async()=>true,()=>true,()=>db,()=>{},prepare);
 return {actions,calls};
}
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';
test('invalid metadata is rejected before signed slots or evidence writes',async()=>{
 const f=fixture({invalid:true});
 assert.equal((await f.actions.adminStudioSignUploads(pid,1,['jpg'],[{caption:'test'}],'2026-01-01')).ok,false);
 assert.equal((await f.actions.adminStudioRegisterPhotos(pid,[{path:`${pid}/a.jpg`,caption:'test'}],'2026-01-01')).ok,false);
 assert.deepEqual(f.calls,[]);
});
test('foreign unit is rejected before storage signing',async()=>{
 const f=fixture({unit:false});
 assert.equal((await f.actions.adminStudioSignUploads(pid,1,['jpg'],[{caption:'test',details:{unit_id:'other'}}],'2026-01-01')).ok,false);
 assert.deepEqual(f.calls,[]);
});
test('admin registration retains classification, cover, order and unit metadata',async()=>{
 const f=fixture(); const details={media_kind:'unit_plan',unit_id:'unit',cover:false,sort_order:3};
 assert.equal((await f.actions.adminStudioRegisterPhotos(pid,[{path:`${pid}/a.jpg`,caption:'test',details}],'2026-01-01')).ok,true);
 assert.deepEqual(f.calls[0][1].details,details);
});
test('partial approval reports the number actually published',async()=>{
 const f=fixture({failAt:2});
 const result=await f.actions.adminStudioRegisterPhotos(pid,[{path:`${pid}/a.jpg`,caption:'A'},{path:`${pid}/b.jpg`,caption:'B'}],'2026-01-01');
 assert.equal(result.ok,false); assert.equal(result.saved,1); assert.match(result.error,/1 из 2/);
});
test('both clients guard same-tick double submit and block ambiguous write replay',()=>{
 for(const path of ['components/admin/PhotosManager.tsx','components/portal/PhotoUploader.tsx']) {
  const source=read(path);
  assert.match(source,/if \(active.current \|\| blocked\) return/);
  assert.match(source,/if \(writing\) setBlocked\(true\)/);
  assert.match(source,/photoUploadFailure\(uploaded,/);
  assert.match(source,/setUploadedPaths/);
 }
 const source=read('components/portal/PhotoUploader.tsx');
 assert.ok(source.indexOf('await preflightUploadedPhotos')<source.indexOf('.upload('));
});
test('moderation displays semantic metadata and project cache is invalidated',()=>{
 const source=read('components/admin/PhotosManager.tsx');
 for(const field of ['cover','sort_order','unit_id','type_label']) assert.ok(source.includes(`p.details.${field}`));
 assert.match(read('app/actions/admin-studio.ts'),/revalidatePath\("\/project", "layout"\)/);
});
