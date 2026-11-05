// Node 24, isolated in-memory fixtures. No live database or network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creationIdFromForm, createOrRecoverProject, publishCreatedProject } from '../lib/project-creation.ts';
const id = '11111111-1111-4111-8111-111111111111';
const input = { id, orgId: null, payload: { id: 1, n: 'Fixture', dev: 'Fixture developer', pN: 0 } };
function fixture() {
  const tables = { catalog_projects: new Map(), moderation_submissions: new Map() };
  const settings = { loseInsertResponse: false, failApproval: false, loseApprovalResponse: false };
  const counts = { projects: 0, submissions: 0, approvals: 0 };
  const db = {
    from(table) {
      let inserted;
      const filters = [];
      const run = async () => {
        if (inserted) {
          if (tables[table].has(inserted.id)) return { error: { code: '23505' }, data: null };
          tables[table].set(inserted.id, { ...inserted });
          counts[table === 'catalog_projects' ? 'projects' : 'submissions']++;
          if (settings.loseInsertResponse) { settings.loseInsertResponse = false; throw Error('response lost'); }
          return { data: { id: inserted.id }, error: null };
        }
        const row = [...tables[table].values()].find(r => filters.every(([key, value]) => r[key] === value));
        return { data: row ?? null, error: null };
      };
      const query = {
        select() { return this; }, eq(k, v) { filters.push([k, v]); return this; }, is(k, v) { return this.eq(k, v); },
        insert(row) { inserted = row; return this; }, maybeSingle: run, single: run,
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      return query;
    },
    async rpc() {
      counts.approvals++;
      if (settings.failApproval) return { error: { message: 'fixture rejection' } };
      const row = tables.catalog_projects.get(id);
      Object.assign(row, { is_published: true, moderation_status: 'published' });
      tables.moderation_submissions.get(id).status = 'approved';
      if (settings.loseApprovalResponse) throw Error('approval response lost');
      return { error: null };
    },
  };
  return { db, tables, settings, counts };
}
test('creation IDs must be UUIDv4 and remain separate from project payload', () => {
  const f = new FormData();
  assert.equal(creationIdFromForm(f), null);
  f.set('creation_id', id); assert.equal(creationIdFromForm(f), id);
  f.set('creation_id', 'not-a-uuid'); assert.equal(creationIdFromForm(f), null);
});
test('repeated and concurrent saves produce one draft', async () => {
  const f = fixture();
  const results = await Promise.all([createOrRecoverProject(f.db, input), createOrRecoverProject(f.db, input)]);
  assert.ok(results.every(r => r.ok && r.projectId === id));
  assert.equal((await createOrRecoverProject(f.db, input)).ok, true);
  assert.equal(f.counts.projects, 1);
  assert.equal(f.tables.catalog_projects.get(id).is_published, false);
});
test('lost insert response is reconciled before reporting failure', async () => {
  const f = fixture(); f.settings.loseInsertResponse = true;
  assert.equal((await createOrRecoverProject(f.db, input)).ok, true);
  assert.equal(f.counts.projects, 1);
});
test('retry does not overwrite a changed draft or reuse another organization', async () => {
  const f = fixture(); await createOrRecoverProject(f.db, input);
  const changed = await createOrRecoverProject(f.db, { ...input, payload: { ...input.payload, n: 'Changed' } });
  assert.equal(changed.ok, false); assert.equal(changed.projectId, id);
  const foreign = await createOrRecoverProject(f.db, { ...input, orgId: 'another-org' });
  assert.equal(foreign.ok, false); assert.equal(foreign.projectId, undefined);
  assert.equal(f.tables.catalog_projects.get(id).payload.n, 'Fixture');
  assert.equal(f.counts.projects, 1);
});
test('approval failure preserves draft and retry reuses the same submission', async () => {
  const f = fixture(); await createOrRecoverProject(f.db, input); f.settings.failApproval = true;
  const failed = await publishCreatedProject(f.db, input);
  assert.equal(failed.ok, false); assert.equal(failed.projectId, id);
  assert.match(failed.error, /Черновик сохранён/);
  f.settings.failApproval = false;
  assert.equal((await publishCreatedProject(f.db, input)).published, true);
  assert.equal(f.counts.projects, 1); assert.equal(f.counts.submissions, 1);
});
test('lost approval response is recovered on repeat without republishing', async () => {
  const f = fixture(); await createOrRecoverProject(f.db, input); f.settings.loseApprovalResponse = true;
  assert.equal((await publishCreatedProject(f.db, input)).ok, false);
  assert.equal((await publishCreatedProject(f.db, input)).published, true);
  assert.equal(f.counts.approvals, 1); assert.equal(f.counts.submissions, 1);
});
test('rejected submissions are not blindly approved again', async () => {
  const f = fixture(); await createOrRecoverProject(f.db, input);
  f.tables.moderation_submissions.set(id, { id, entity_id: id, entity_type: 'project', status: 'rejected' });
  assert.equal((await publishCreatedProject(f.db, input)).ok, false);
  assert.equal(f.counts.approvals, 0);
});
test('form retains entered data and request ID across validation/publication errors', () => {
  const code = readFileSync(new URL('../components/portal/ProjectWizardForm.tsx', import.meta.url), 'utf8');
  assert.ok(code.includes('useState(creationId)'));
  assert.ok(code.includes('value={requestId}'));
  assert.ok(code.includes('value={zoneSel}'));
  assert.ok(!code.includes('zones[0]'));
  assert.ok(!code.includes('year + 2'));
  assert.ok(!code.includes('defaultValue='));
  assert.ok(code.includes('state.projectId'));
});
