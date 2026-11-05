import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {readAllPages} from '../lib/paginated-rows.ts';
import {readRecovery,recoveryRecord,photoRecoveryKey} from '../lib/photo-recovery.ts';
const pid='11111111-1111-4111-8111-111111111111';
const batch={projectId:pid,observedAt:'2025-01-01',items:[{path:`${pid}/a.jpg`,caption:'Test'}]};
test('pagination retains projects and preferred covers after 400 images',async()=>{
 const source=Array.from({length:802},(_,i)=>({id:i,cover:i===801,project:i<801?'one':'older-project'}));const ranges=[];
 const rows=await readAllPages((a,b)=>{ranges.push([a,b]);return Promise.resolve({data:source.slice(a,b+1),error:null})});
 assert.equal(rows.length,802);assert.equal(rows.at(-1).cover,true);assert.deepEqual(ranges,[[0,399],[400,799],[800,1199]]);
});
test('pagination fails rather than silently returning an incomplete cover set',async()=>{
 await assert.rejects(readAllPages((a)=>Promise.resolve(a===0?{data:Array(400).fill(1),error:null}:{data:null,error:{message:'read failed'}})),/read failed/);
});
test('recovery records remain project scoped and contain no signed upload token',()=>{
 const stored=JSON.stringify(recoveryRecord(batch));assert.equal(readRecovery(stored,pid).batch.items[0].path,batch.items[0].path);
 assert.throws(()=>readRecovery(stored,'other'));assert.throws(()=>readRecovery('{}',pid));
 assert.notEqual(photoRecoveryKey(pid,'admin'),photoRecoveryKey(pid,'partner'));assert.equal(stored.includes('token'),false);
});
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const code=stripTypeScriptTypes(read('app/actions/photo-recovery.ts').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm,''),{mode:'strip'}).replace(/^export\s+/gm,'');
function fixture({allowed=true,storageError=false}={}) {
 let serviceClients=0;
 const query={select(){return this},eq(){return this},in(){return Promise.resolve({data:[{id:'evidence',fact_key:'photo-a.jpg',status:'pending',details:{url:`https://example.org/${batch.items[0].path}`}}],error:null})}};
 const db={from:()=>query,storage:{from:()=>({list:async()=>({data:[{name:'a.jpg'}],error:storageError?{message:'denied'}:null})})}};
 const reconcile=new Function('getAdminSessionOk','createSupabaseServerClient','createServiceRoleClient','hasSupabaseServiceConfig','preparePhotoEvidence','projectPhotoUrl',code+'\nreturn reconcilePhotoUploads;')(
  async()=>allowed,async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})},rpc:async()=>({data:allowed,error:null})}),()=>{serviceClients++;return db},()=>true,()=>[{fact_key:'photo-a.jpg'}],(_,path)=>`https://example.org/${path}`);
 return {reconcile,clients:()=>serviceClients};
}
test('reconciliation checks admin and partner authority before privileged storage reads',async()=>{
 for(const mode of ['admin','partner']) {const f=fixture({allowed:false});assert.equal((await f.reconcile(batch,mode)).ok,false);assert.equal(f.clients(),0)}
});
test('read-only reconciliation distinguishes existing evidence and uncertain storage',async()=>{
 const good=await fixture().reconcile(batch,'partner');assert.equal(good.items[0].stored,true);assert.equal(good.items[0].evidence[0].status,'pending');
 const uncertain=await fixture({storageError:true}).reconcile(batch,'partner');assert.equal(uncertain.items[0].stored,null);
 assert.doesNotMatch(read('app/actions/photo-recovery.ts'),/\.(insert|update|delete|upload|remove)\(/);
});
test('clients persist recovery before writes and offer only accounted-for journal completion',()=>{
 for(const file of ['components/admin/PhotosManager.tsx','components/portal/PhotoUploader.tsx']) {
  const src=read(file);assert.ok(src.indexOf('saveRecovery({')<src.indexOf('writing = true;'));
  assert.match(src,/if \(!ready \|\| recovery \|\| recoveryError\) return/);
 }
 assert.match(read('components/shared/PhotoUploadRecovery.tsx'),/items.every\(item=>item.stored===true && item.evidence.length>0\)/);
});
