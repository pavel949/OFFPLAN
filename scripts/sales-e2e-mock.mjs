// In-memory PostgREST test double. Never connects to production.
import http from 'node:http';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {emptySalesModel,salesModelBase} from '../lib/sales-model.ts';
const pid='00000000-0000-4000-8000-000000990001',uid='00000000-0000-4000-8000-000000990002';
const today=new Date().toISOString().slice(0,10);
const payload={...JSON.parse(fs.readFileSync(new URL('../data/seed/projects.json',import.meta.url)))[0],id:999,n:'E2E Sales Test',desc:'Isolated local test data only'};
const project={org_id:'00000000-0000-4000-8000-000000990010',id:pid,legacy_id:999,slug:'e2e-sales-test-999',payload,is_published:true,moderation_status:'published',jurisdiction_code:'TH',verification_level:0};
const m=emptySalesModel();m.projectType='condominium';m.countryCode='TH';
m.units=[salesModelBase.shape.units.element.parse({id:uid,kind:'apartment',availability:'available',totalArea:50,source:'Local fixture',sourceDate:today})];
m.fees=[salesModelBase.shape.fees.element.parse({id:randomUUID(),name:'Test CAM',code:'cam',category:'maintenance',treatment:'payable',mandatory:'required',basis:'per_total_area',amount:85,currency:'THB',period:'month',taxTreatment:'included',payer:'buyer'})];
const stepId=randomUUID(),planId=randomUUID();m.paymentPlans=[salesModelBase.shape.paymentPlans.element.parse({id:planId,name:'Test schedule',currency:'THB',financing:'construction_installments',approval:'not_required',annualRate:0,rateMethod:'interest_free',interestIncluded:'included',depositAmount:100000,depositTreatment:'credited_to_price',depositRefund:'conditional',depositCreditStepId:stepId,escrow:'unknown',completeness:'complete',steps:[{id:stepId,name:'Contract',trigger:'contract',basis:'percent_price',value:20},{id:randomUUID(),name:'Handover',trigger:'handover',basis:'balance',value:null}]})];
m.offers=[salesModelBase.shape.offers.element.parse({id:randomUUID(),name:'Test A101 Freehold',unitId:uid,ownership:'freehold',price:1000000,currency:'THB',priceTaxTreatment:'unknown',paymentPlanId:planId,status:'offered',source:'Local fixture',sourceDate:today})];
const owner='00000000-0000-4000-8000-000000990011';
const buyer='00000000-0000-4000-8000-000000990012';
const reviewer='00000000-0000-4000-8000-000000990013';
const users = {
 [owner]: {id:owner,role:'partner',partner_role:'owner',org_id:project.org_id},
 [buyer]: {id:buyer,role:'buyer',org_id:null},
 [reviewer]: {id:reviewer,role:'reviewer',org_id:null},
};
const sessionUser = id => ({id,aud:'authenticated',role:'authenticated',email:`local-${users[id].role}@example.invalid`,app_metadata:{},user_metadata:{}});
const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const issueSession = id => ({
 access_token:`${part({alg:'HS256',typ:'JWT'})}.${part({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})}.local-test-signature`,
 refresh_token:`fresh-${id}`,expires_in:3600,token_type:'bearer',user:sessionUser(id),
});
const codes = new Map([['partner-code',owner],['account-code',buyer],['registry-code',reviewer]]);
let expiredRefreshUsed = false;
const tables={profiles:Object.values(users),catalog_projects:[project],public_catalog_projects:[project],jurisdictions:[{code:'TH',currency:'THB'}],project_units:[{id:uid,project_id:pid,label:'A101',status:'unknown',price_thb:null,currency:'THB'}],project_sales_models:[{project_id:pid,revision:1,model:m,created_at:new Date().toISOString()}],project_sales_publications:[],leads:[]};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const table=url.pathname.split('/').at(-1);const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks).toString();const body=raw?JSON.parse(raw):null;
 res.setHeader('content-type','application/json');
 if(url.pathname==='/auth/v1/token'){
  const grant=url.searchParams.get('grant_type');
  let id;
  if(grant==='pkce' && body?.code_verifier==='local-verifier'){
   id=codes.get(body.auth_code);
   codes.delete(body.auth_code);
  }
  if(grant==='refresh_token' && body?.refresh_token==='expired-local-token' && !expiredRefreshUsed){
   id=owner;
   expiredRefreshUsed=true;
  }
  if(id){res.end(JSON.stringify(issueSession(id)));return;}
  res.writeHead(400);res.end(JSON.stringify({code:'invalid_grant',msg:'Fixture code or refresh token invalid'}));return;
 }
 if(url.pathname==='/auth/v1/user'){
  let id;
  try{id=JSON.parse(Buffer.from(req.headers.authorization?.split('.')[1]??'','base64url')).sub;}catch{}
  if(!users[id]){res.writeHead(401);res.end(JSON.stringify({code:'bad_jwt',msg:'Invalid fixture user'}));return;}
  res.end(JSON.stringify(sessionUser(id)));return;
 }
 if(url.pathname.includes('/rpc/')){res.end(JSON.stringify(table==='consume_rate_limit'?{ok:true,retry_after_ms:0}:null));return;}
 let rows=tables[table]??[];
 const filter=r=>[...url.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(r[k])===v.slice(3));
 if(req.method==='POST'){
  const input=Array.isArray(body)?body:[body];rows=input.map(r=>({...r,id:r.id??randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),status:r.status??'new'}));
  if(table==='project_sales_publications')tables[table]=rows;else tables[table]=[...(tables[table]??[]),...rows];
 } else if(req.method==='PATCH'){rows=rows.filter(filter).map(r=>{Object.assign(r,body);return r;});}
 else if(req.method==='DELETE'){tables[table]=rows.filter(r=>!filter(r));rows=[];}
 else {rows=rows.filter(filter);if(url.searchParams.get('order')==='revision.desc')rows.sort((a,b)=>b.revision-a.revision);const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);rows=rows.slice(offset,offset+limit);}
 res.setHeader('content-range',`0-${Math.max(0,rows.length-1)}/${rows.length}`);
 if(req.method==='HEAD'){res.end();return;}
 const single=String(req.headers.accept).includes('vnd.pgrst.object');res.end(JSON.stringify(single?(rows[0]??null):rows));
}).listen(4040,'127.0.0.1',()=>console.log('Local sales test API ready on 4040'));
