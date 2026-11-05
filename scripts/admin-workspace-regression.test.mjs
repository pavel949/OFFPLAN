import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN_GROUPS, PROJECT_EDITING, adminRouteActive, projectEditingHelp, projectIsPublished, requireAdminQuery } from '../lib/admin-workspace.ts';
import { parseDeveloperInput } from '../lib/developer-directory.ts';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('navigation preserves all existing routes with one unique guide route', () => {
 const paths = ADMIN_GROUPS.flatMap(group => group.items.map(item => item.href));
 assert.equal(paths.length, 16); assert.equal(new Set(paths).size,16);
 for (const path of ['/admin','/admin/projects','/admin/leads','/admin/developers','/admin/moderation','/admin/catalog','/admin/guide']) assert.ok(paths.includes(path));
});
test('active link requires an exact path segment and handles nested projects', () => {
 assert.ok(adminRouteActive('/admin/projects/uuid','/admin/projects'));
 assert.ok(adminRouteActive('/admin','/admin'));
 assert.equal(adminRouteActive('/admin/projects','/admin'),false);
 assert.equal(adminRouteActive('/admin/projects-extra','/admin/projects'),false);
});
test('every project tab describes its editing and publishing effect', () => {
 assert.equal(PROJECT_EDITING.length,7);
 for(const item of PROJECT_EDITING) {assert.ok(item.effect); assert.ok(item.caution);assert.equal(projectEditingHelp(item.key).key,item.key);}
 assert.equal(projectEditingHelp('missing').key,'info');
 assert.match(projectEditingHelp('units').caution,/версии условий/);
});
test('publication badge follows both DB visibility conditions', () => {
 for(const flag of [true,false]) for(const status of ['draft','published','rejected']) assert.equal(projectIsPublished({is_published:flag,moderation_status:status}),flag && status==='published');
});
test('failed reference queries cannot be treated as empty lists', () => {
 assert.doesNotThrow(()=>requireAdminQuery({error:null},'Unavailable'));
 assert.throws(()=>requireAdminQuery({error:{message:'private internal error'}},'Unavailable'),/^Error: Unavailable$/);
 const source=read('app/actions/admin-studio.ts');
 assert.match(source,/requireAdminQuery\(d,/);assert.match(source,/requireAdminQuery\(r,/);
 assert.match(source,/\[u, ph, so, up\]/);
 assert.doesNotMatch(read('app/admin/projects/[id]/page.tsx'),/\.catch\(\(\) => \[\]\)/);
});
const form = changes => {const fd=new FormData();for(const [key,value] of Object.entries({name_en:' Example Developer ',name_ru:'',website:'https://example.com',revision:'0',...changes}))fd.set(key,value);return fd;};
test('developer create trims input and defaults RU name without inviting anyone',()=>{
 const result=parseDeveloperInput(form({}));assert.equal(result.ok,true);assert.equal(result.value.name_en,'Example Developer');assert.equal(result.value.name_ru,'Example Developer');assert.equal(result.value.id,null);
});
test('developer validation rejects invalid identifiers, revisions, URLs and short names',()=>{
 for(const change of [{name_en:'x'},{website:'javascript:alert(1)'},{website:'https://user:password@example.com'},{id:'wrong'},{org_id:'wrong'},{revision:'-1'},{id:'00000000-0000-4000-8000-000000000001',revision:'0'}])assert.equal(parseDeveloperInput(form(change)).ok,false);
});
test('directory SQL keeps ownership and publication unchanged, requires service role and revision',()=>{
 const sql=read('supabase/migrations/20261105190000_admin_developer_directory.sql');
 assert.match(sql,/security invoker/);assert.match(sql,/revision conflict/);assert.match(sql,/where developer_id=p_id/);
 assert.match(sql,/from public,anon,authenticated/);
 const projects=sql.split('update public.catalog_projects set')[1].split('end if;')[0];
 assert.doesNotMatch(projects,/org_id\s*=|is_published\s*=|moderation_status\s*=/);
 assert.match(read('app/actions/developer-directory.ts'),/getAdminSessionOk/);
 assert.match(read('app/admin/developers/developer-directory.tsx'),/state.id \?\? developer\?\.id/);
});

test('developer fields survive form reset and repeat-save uses returned identity',()=>{
 const form=read('app/admin/developers/developer-directory.tsx');
 for(const key of ['name_en','name_ru','website','org_id']) assert.ok(form.includes(`value={fields.${key}}`));
 assert.match(form,/state.revision \?\? developer\?\.admin_revision/);
});
