// Real Next HTTP/server-action workflow against an isolated in-memory API.
// SQL constraints/RLS are exercised separately by supabase/tests/run.sh.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
await import('./sales-e2e-mock.mjs');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--turbopack','--hostname','127.0.0.1','-p','3031'],{cwd:root,env:{...process.env,ADMIN_SECRET:'offplan-local-e2e-test-only',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4040',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-key',SUPABASE_SERVICE_ROLE_KEY:'local-test-service',RESEND_API_KEY:'',LEAD_NOTIFY_EMAIL:'',TURNSTILE_SECRET_KEY:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:''},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
const base='http://127.0.0.1:3031',pid='00000000-0000-4000-8000-000000990001',route=`/admin/projects/${pid}?tab=sales`;
try{
 for(let i=0;i<80;i++){try{await fetch(base+'/admin');break;}catch{await new Promise(r=>setTimeout(r,500));}}
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+3600000})).toString('base64url');const token=payload+'.'+createHmac('sha256','offplan-local-e2e-test-only').update(payload).digest('base64url');const cookie='ie_admin='+token;
 const initial=await fetch(base+route,{headers:{cookie}});const html=await initial.text();assert.equal(initial.status,200);assert.ok(html.includes('Структура и условия продажи'),'admin form renders');console.log('PASS: authenticated form and fixture loaded');
 const systemResponse=await fetch(base+'/design-system'); const systemHtml=await systemResponse.text();
 assert.equal(systemResponse.status,200); assert.ok(systemHtml.includes('noindex'));
 assert.ok(systemHtml.includes('Демонстрационные состояния')); assert.ok(systemHtml.includes('ui-disclosure'));
 assert.ok(systemHtml.includes('<summary>')); assert.ok(systemHtml.includes('<dl')); assert.ok(systemHtml.includes('<dt>'));
 console.log('PASS: database-independent design reference renders semantic disclosures and labeled examples');
 function actionId(name,path='admin/projects/[id]'){const file=root+`/.next/server/app/${path}/page/server-reference-manifest.json`;const manifest=JSON.parse(fs.readFileSync(file));const found=Object.entries(manifest.node).find(([,v])=>v.exportedName===name);assert.ok(found,name+' action exists');return found[0];}
 async function action(name,args,path=route,auth=true){const r=await fetch(base+path,{method:'POST',headers:{'Next-Action':actionId(name),'Content-Type':'text/plain;charset=UTF-8',Accept:'text/x-component',Origin:base,...(auth?{cookie}:{})},body:JSON.stringify(args)});const t=await r.text();if(!t.includes('"ok":true'))console.log(name+' response: '+t.slice(0,500));return t;}
 const rows=await (await fetch('http://127.0.0.1:4040/rest/v1/project_sales_models')).json();const model=rows[0].model;model.fees[0].amount=86;
 const denied=await action('adminSaveSalesModel',[pid,1,model],route,false);assert.ok(denied.includes('"ok":false'));console.log('PASS: unauthenticated save rejected');
 assert.ok((await action('adminSaveSalesModel',[pid,1,model])).includes('"revision":2'));console.log('PASS: actual save action persisted revision 2');
 const reload=await (await fetch(base+route,{headers:{cookie}})).text();assert.ok(reload.includes('86'));console.log('PASS: saved fee restored on page reload');
 const until=new Date(Date.now()+7*86400000).toISOString().slice(0,10);assert.ok((await action('adminPublishSalesModel',[pid,2,until])).includes('"ok":true'));console.log('PASS: publication action saved revision pointer');
 const publicRoute='/project/e2e-sales-test-999';const publicR=await fetch(base+publicRoute);const publicHtml=await publicR.text();assert.equal(publicR.status,200);assert.ok(publicHtml.includes('A101'));assert.ok(publicHtml.includes('Test CAM'));assert.ok(!publicHtml.includes('Local fixture'));console.log('PASS: public page renders sanitized offer and costs');
 assert.equal((publicHtml.match(/id="basic-assessment"/g)||[]).length,1,'one buyer evidence review');
 assert.ok(publicHtml.includes('Что подтверждено и чего не хватает'));
 assert.ok(publicHtml.includes('Источник') || publicHtml.includes('нужно запросить документы'));
 assert.ok(publicHtml.includes('Это обращение, не оформление заказа или оплаты'));
 assert.ok(publicHtml.includes('Налоги, точный состав работ'));
 assert.ok(publicHtml.includes('Статус реестра'));
 console.log('PASS: buyer review and inquiry-only VDD render once, distinct from registry status');
 
 const fd=new FormData();for(const [k,v] of Object.entries({name:'Local E2E',email:'e2e@example.invalid',phone:'',message:'Isolated test',projectId:'999',projectName:'Forged name',locale:'ru',consent:'on',offerId:model.offers[0].id,salesRevision:'2'}))fd.set(k,v);
 // Next 15.5.29 prefixes nested FormData entries with _<part>_ (matching its bundled client encoder).
 const encoded=new FormData();for(const [k,v] of fd)encoded.set('_1_'+k,v);encoded.set('0',JSON.stringify([{ok:false},'$K1']));const leadRes=await fetch(base+publicRoute,{method:'POST',headers:{'Next-Action':actionId('submitLead','project/[slug]'),Accept:'text/x-component',Origin:base},body:encoded});const leadText=await leadRes.text();assert.ok(leadText.includes('"ok":true'),leadText.slice(0,500));
 const leads=await (await fetch('http://127.0.0.1:4040/rest/v1/leads')).json();assert.equal(leads.length,1);assert.equal(leads[0].sales_selection.price,1000000);assert.equal(leads[0].sales_selection.fees[0].amount,4300);assert.equal(leads[0].project_name,'E2E Sales Test');console.log('PASS: actual lead action stores trusted offer, price and computed costs');
 const leadPage=await (await fetch(base+'/admin/leads/'+leads[0].id,{headers:{cookie}})).text();assert.ok(leadPage.includes('Выбранный юнит и условия'));console.log('PASS: sales selection visible in admin lead');
 assert.ok((await action('adminWithdrawSalesModel',[pid])).includes('"ok":true'));const withdrawn=await fetch(base+publicRoute);const withdrawnHtml=await withdrawn.text();assert.ok(!withdrawnHtml.includes('Test A101 Freehold'));console.log('PASS: withdrawal removes offer from public page');
 console.log('HTTP_E2E_ALL_PASSED');
}catch(e){console.error('FAIL',e.message);console.error(logs.slice(-6000));process.exitCode=1;}finally{child.kill('SIGTERM');setTimeout(()=>process.exit(process.exitCode??0),500);}
