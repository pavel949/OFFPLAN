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

test('info save returns canonical developer and region IDs for repeat saves', async () => {
  const developerId = '00000000-0000-4000-8000-000000000001';
  const regionId = '00000000-0000-4000-8000-000000000002';
  const inserts = [];
  const db = { from(table) {
    return {
      select() { return this; }, eq() { return this; },
      update() { return this; }, insert(row) { inserts.push({ table, row }); return this; },
      maybeSingle: async () => ({ data: table === 'catalog_projects' ? { slug: 'test', payload: {}, jurisdiction_code: 'TH' }
        : table === 'regions' ? { jurisdiction_code: 'TH', name: { en: 'Test District' } }
        : { code: 'TEST', name_en: 'Test Developer' } }),
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
    };
  }};
  const save = new Function('getAdminSessionOk', 'hasSupabaseServiceConfig', 'createServiceRoleClient', 'revalidatePath', 'parseStudioForm', 'catalogProjectSchema', 'mergeStudioFields', 'insertCatalogAuditLog', actionCode + '\nreturn adminStudioSaveInfo;')(
    async () => true, () => true, () => db, () => {}, () => ({ ok: true, fields: {} }),
    { parse: value => value }, () => ({}), async () => {},
  );
  const fd = new FormData();
  fd.set('developer_id', developerId);
  fd.set('region_id', regionId);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await save('fake-project', { ok: false }, fd);
    assert.deepEqual(result, { ok: true, developerId, regionId });
    fd.set('developer_id', result.developerId);
    fd.set('region_id', result.regionId);
  }
  assert.equal(inserts.length, 0);
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
