// Isolated regression checks. No network, database, credentials or customer data.
// Run with Node 24: node --test scripts/entry-save-regression.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { saveUnitRows } from '../lib/unit-editor-save.ts';

test('acknowledged new rows retain IDs and are not inserted on the next save-all', async () => {
  const rows = [{ key: 'new-a', dirty: true }, { key: 'new-b', dirty: true }];
  let inserts = 0;
  const save = async () => ({ ok: true, id: `saved-${++inserts}` });
  const acknowledge = (row, result) => Object.assign(row, result, { dirty: false });
  assert.equal((await saveUnitRows(rows.filter(r => r.dirty), save, acknowledge)).ok, true);
  await saveUnitRows(rows.filter(r => r.dirty), save, acknowledge);
  assert.equal(inserts, 2);
  assert.deepEqual(rows.map(r => r.id), ['saved-1', 'saved-2']);
});

test('partial failure retains successful IDs and retries only unsaved rows', async () => {
  const rows = [{ key: 'a', dirty: true }, { key: 'b', dirty: true }, { key: 'c', dirty: true }];
  const calls = [];
  let fail = true;
  const save = async row => {
    calls.push(row.key);
    return row.key === 'b' && fail ? { ok: false, error: 'test failure' } : { ok: true, id: row.key };
  };
  const ack = (row, result) => Object.assign(row, result, { dirty: false });
  assert.equal((await saveUnitRows(rows, save, ack)).ok, false);
  assert.deepEqual(calls, ['a', 'b']);
  fail = false;
  await saveUnitRows(rows.filter(r => r.dirty), save, ack);
  assert.deepEqual(calls, ['a', 'b', 'b', 'c']);
});

test('transport ambiguity and missing IDs never acknowledge success', async () => {
  let acknowledgements = 0;
  const ack = () => acknowledgements++;
  assert.equal((await saveUnitRows([1], async () => { throw Error('transport'); }, ack)).ok, false);
  assert.equal((await saveUnitRows([1], async () => ({ ok: true }), ack)).ok, false);
  assert.equal(acknowledgements, 0);
});

// Execute the actual server action implementation with dependencies stubbed.
// This checks action control flow, not Supabase SQL/RLS or React rendering.
const source = readFileSync(new URL('../app/actions/admin-studio.ts', import.meta.url), 'utf8');
const actionCode = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, ''), { mode: 'strip' }).replace(/^export\s+/gm, '');
function fixture(authorized = true) {
  const writes = [];
  const query = {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { price_thb: 100, price_updated_at: '2025-01-01T00:00:00Z' } }),
    update(row) { writes.push(row); return this; },
    insert(row) { writes.push(row); return this; },
    single: async () => ({ data: { id: 'fake-unit' }, error: null }),
    then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
  };
  let clients = 0;
  const action = new Function('getAdminSessionOk', 'hasSupabaseServiceConfig', 'createServiceRoleClient', 'revalidatePath', actionCode + '\nreturn adminStudioSaveUnit;')(
    async () => authorized, () => true, () => { clients++; return { from: () => query }; }, () => {},
  );
  return { action, writes, clients: () => clients };
}
const unit = { label: 'TEST-A', bedrooms: 1, floor: 2, sqm: 45.5, price: 100, status: 'available' };
test('unauthorized writes never create a privileged client', async () => {
  const f = fixture(false);
  assert.equal((await f.action('fake-project', unit)).ok, false);
  assert.equal(f.clients(), 0);
  assert.equal(f.writes.length, 0);
});
test('invalid numeric input fails instead of silently erasing values', async () => {
  for (const invalid of [{ price: NaN }, { sqm: -1 }, { bedrooms: 1.5 }, { floor: Infinity }]) {
    const f = fixture();
    assert.equal((await f.action('fake-project', { ...unit, ...invalid })).ok, false);
    assert.equal(f.writes.length, 0);
  }
});
test('non-price edits preserve the actual old freshness date', async () => {
  const f = fixture();
  const result = await f.action('fake-project', { ...unit, id: 'fake-unit' });
  assert.equal(result.ok, true);
  assert.equal(result.priceUpdatedAt, '2025-01-01T00:00:00Z');
  assert.equal('price_updated_at' in f.writes[0], false);
});
test('new rows and price edits return the persisted freshness date', async () => {
  for (const change of [{}, { id: 'fake-unit', price: 200 }]) {
    const f = fixture();
    const result = await f.action('fake-project', { ...unit, ...change });
    assert.equal(result.ok, true);
    assert.equal(result.priceUpdatedAt, f.writes[0].price_updated_at);
    assert.ok(result.priceUpdatedAt);
  }
});

function infoFixture(rpcError = null) {
  const projectId = '00000000-0000-4000-8000-000000000003';
  const developerId = '00000000-0000-4000-8000-000000000001';
  const regionId = '00000000-0000-4000-8000-000000000002';
  const calls = [];
  const db = { from(table) {
    return {
      select() { return this; }, eq() { return this; },
      insert() { throw new Error('Nontransactional reference insert'); },
      update() { throw new Error('Nontransactional project update'); },
      maybeSingle: async () => ({ data: table === 'catalog_projects' ? { slug: 'test', payload: {n:'Before'}, updated_at: '2026-11-01T00:00:00Z' }
        : table === 'regions' ? { name: { en: 'Test District' } }
        : { code: 'TEST', name_en: 'Test Developer' } }),
    };
  }, rpc: async (name,args) => { calls.push({name,args}); return {data:rpcError?null:{developerId,regionId},error:rpcError}; }};
  const save = new Function('getAdminSessionOk', 'hasSupabaseServiceConfig', 'createServiceRoleClient', 'revalidatePath', 'parseStudioForm', 'catalogProjectSchema', 'mergeStudioFields', 'slugify', actionCode + '\nreturn adminStudioSaveInfo;')(
    async () => true, () => true, () => db, () => {}, () => ({ ok: true, fields: {} }),
    { parse: value => value }, (_before,_fields,links) => ({n:'After',...links}), value=>value.toLowerCase().replaceAll(' ','-'),
  );
  const fd = new FormData(); fd.set('developer_id',developerId);fd.set('region_id',regionId);
  return {projectId,developerId,regionId,save,fd,calls};
}
test('info save uses one transactional RPC and returns canonical IDs', async () => {
  const f=infoFixture();
  assert.deepEqual(await f.save(f.projectId,{ok:false},f.fd),{ok:true,developerId:f.developerId,regionId:f.regionId});
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'admin_save_project_info');
  assert.deepEqual(f.calls[0].args.p_expected_payload,{n:'Before'});
  assert.deepEqual(f.calls[0].args.p_developer,{id:f.developerId});
});
test('new references are sent together to RPC, never independently inserted', async () => {
  const f=infoFixture();f.fd.set('region_id','__new');f.fd.set('zoneNewEn','New district');f.fd.set('zoneNewParent',f.regionId);
  f.fd.set('developer_id','__new');f.fd.set('devNewName','New developer');
  assert.equal((await f.save(f.projectId,{ok:false},f.fd)).ok,true);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.p_region.name_en,'New district');
  assert.deepEqual(f.calls[0].args.p_developer,{name:'New developer'});
});
test('invalid new developer never creates the otherwise valid new region', async () => {
  const f=infoFixture();f.fd.set('region_id','__new');f.fd.set('zoneNewEn','New district');f.fd.set('zoneNewParent',f.regionId);
  f.fd.set('developer_id','__new');f.fd.set('devNewName','x');
  assert.equal((await f.save(f.projectId,{ok:false},f.fd)).ok,false);assert.equal(f.calls.length,0);
});
test('missing migration and transaction failure never fall back to partial writes', async () => {
  for(const error of [{code:'PGRST202',message:'missing RPC'},{code:'23505',message:'duplicate'},{code:'P0001',message:'project changed'}]) {
    const f=infoFixture(error);const result=await f.save(f.projectId,{ok:false},f.fd);
    assert.equal(result.ok,false);assert.equal(f.calls.length,1);assert(result.error);
  }
});

// Client parsing → real server action control flow → mocked stored row.
const { parseUnitNumber } = await import('../lib/unit-number.ts');
test('Russian decimal area reaches the save action without a tenfold change', async () => {
  const f = fixture();
  const result = await f.action('fake-project', { ...unit, sqm: parseUnitNumber('35,5'), price: parseUnitNumber('1 000 000,50') });
  assert.equal(result.ok, true);
  assert.equal(f.writes[0].sqm, 35.5);
  assert.equal(f.writes[0].price_thb, 1000000.5);
});
test('ambiguous comma grouping is rejected before any unit write', async () => {
  const f = fixture();
  assert.equal((await f.action('fake-project', { ...unit, price: parseUnitNumber('1,234') })).ok, false);
  assert.equal(f.writes.length, 0);
});
test('save-all includes invalid blank-label rows so changes are never silently skipped', () => {
  const ui = readFileSync(new URL('../components/admin/UnitsEditor.tsx', import.meta.url), 'utf8');
  assert.match(ui, /function saveAll\(\) \{ persist\(rows\.filter\(\(x\) => x\.dirty\)\); \}/);
  assert.doesNotMatch(ui, /dirty && [xr]\.label\.trim\(\)/);
});


// Import action -> every affected admin/public surface, even after partial commits.
const importSource = readFileSync(new URL('../app/actions/admin-brain.ts', import.meta.url), 'utf8');
const importCode = stripTypeScriptTypes(importSource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, ''), {mode:'strip'}).replace(/^export\s+/gm,'');
function importFixture(result, authorized = true) {
  const paths=[], audits=[];let clients=0;
  const action=new Function('getAdminSessionOk','hasSupabaseServiceConfig','createServiceRoleClient','runUnitImport','insertCatalogAuditLog','revalidatePath',importCode+'\nreturn adminImportProjectUnits;')(
    async()=>authorized,()=>true,()=>{clients++;return {};},async()=>result,async row=>audits.push(row),path=>paths.push(path),
  );
  const fd=new FormData();fd.set('project_id','test-project');fd.set('mode','apply');
  return {run:()=>action({ok:false},fd),paths,audits,clients:()=>clients};
}
test('successful and partially committed imports refresh active editor, list and public pages',async()=>{
 for(const ok of [true,false]) {
  const result={ok,mode:'apply',applied:{inserted:1,updated:0},...(ok?{}:{error:'Later row failed'})};const f=importFixture(result);
  assert.deepEqual(await f.run(),result);
  for(const path of ['/','/admin/projects','/admin/projects/test-project','/admin/projects/test-project/inventory','/project'])assert(f.paths.includes(path));
  assert.equal(f.audits[0].diff.complete,ok);
 }
});
test('preview and unsuccessful imports without acknowledged writes do not refresh or audit',async()=>{
 for(const result of [{ok:true,mode:'preview'},{ok:false,mode:'apply',applied:{inserted:0,updated:0}}]) {
  const f=importFixture(result);await f.run();assert.equal(f.paths.length,0);assert.equal(f.audits.length,0);
 }
});
test('unauthorized import never creates a privileged client',async()=>{
 const f=importFixture({ok:true,mode:'apply'},false);assert.equal((await f.run()).ok,false);assert.equal(f.clients(),0);assert.equal(f.paths.length,0);
});

const {reconcileUnitEditorRows}=await import('../lib/unit-editor-rows.ts');
const editable=(id,price,dirty=false)=>({id,key:id,label:id,price,dirty,baseline:price});
test('server-imported rows become visible without replacing unsaved edits',()=>{
 const local={...editable('a','100',true),price:'local'};
 const result=reconcileUnitEditorRows([local,editable('b','100')],[editable('a','100'),editable('b','200'),editable('new','300')]);
 assert.equal(result[0].price,'local');assert.equal(result[0].conflict,undefined);assert.equal(result[1].price,'200');assert.equal(result[2].id,'new');
});
test('changed or deleted persisted rows flag conflicts while retaining local edits',()=>{
 const local={...editable('a','100',true),price:'local'};
 assert.equal(reconcileUnitEditorRows([local],[editable('a','200')])[0].conflict,'changed');
 const deleted=reconcileUnitEditorRows([local],[])[0];assert.equal(deleted.conflict,'deleted');assert.equal(deleted.price,'local');
});
