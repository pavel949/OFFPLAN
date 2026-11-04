-- Project sources (links to developer materials): RLS and public visibility contract.

create or replace function pg_temp.src_expect_error(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;

-- earlier suites re-grant everything; restore the state the migration leaves behind
revoke all on public.project_sources from public, anon;
revoke truncate, references, trigger on public.project_sources from authenticated;

begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000006000a1','owner@dev.test'),
 ('00000000-0000-0000-0000-0000006000a2','sales@dev.test'),
 ('00000000-0000-0000-0000-0000006000a3','other@dev.test'),
 ('00000000-0000-0000-0000-0000006000a4','buyer@x.test')
 on conflict do nothing;
insert into public.orgs(id,slug,name_en,name_ru) values
 ('00000000-0000-0000-0000-0000006000b1','src-dev-a','Dev A','Dev A'),
 ('00000000-0000-0000-0000-0000006000b2','src-dev-b','Dev B','Dev B');
insert into public.profiles(id,role,org_id,partner_role) values
 ('00000000-0000-0000-0000-0000006000a1','partner','00000000-0000-0000-0000-0000006000b1','owner'),
 ('00000000-0000-0000-0000-0000006000a2','partner','00000000-0000-0000-0000-0000006000b1','sales'),
 ('00000000-0000-0000-0000-0000006000a3','partner','00000000-0000-0000-0000-0000006000b2','owner'),
 ('00000000-0000-0000-0000-0000006000a4','buyer',null,null)
 on conflict (id) do update set role=excluded.role, org_id=excluded.org_id, partner_role=excluded.partner_role;
insert into public.catalog_projects(id,legacy_id,slug,payload,is_published,moderation_status,org_id) values
 ('00000000-0000-0000-0000-0000006000c1',96001,'src-pub','{"n":"Pub"}',true,'published','00000000-0000-0000-0000-0000006000b1'),
 ('00000000-0000-0000-0000-0000006000c2',96002,'src-draft','{"n":"Draft"}',false,'draft','00000000-0000-0000-0000-0000006000b1');

-- owner can add links to own projects
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000006000a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into public.project_sources(project_id,kind,title,url,visibility)
 values ('00000000-0000-0000-0000-0000006000c1','brochure','Brochure','https://drive.example/b','public'),
        ('00000000-0000-0000-0000-0000006000c1','price_list','Prices','https://drive.example/p','partners'),
        ('00000000-0000-0000-0000-0000006000c1','telegram','Chat','https://t.me/dev','internal'),
        ('00000000-0000-0000-0000-0000006000c2','brochure','Draft brochure','https://drive.example/d','public');
select pg_temp.src_expect_error($$insert into public.project_sources(project_id,kind,title,url) values ('00000000-0000-0000-0000-0000006000c1','brochure','x','javascript:alert(1)')$$,'non-https url accepted');
select pg_temp.src_expect_error($$insert into public.project_sources(project_id,kind,title,url) values ('00000000-0000-0000-0000-0000006000c1','brochure','x','http://plain.example')$$,'http url accepted');
select pg_temp.src_expect_error($$insert into public.project_sources(project_id,kind,title,url) values ('00000000-0000-0000-0000-0000006000c1','bogus','x','https://ok.example')$$,'bad kind accepted');
do $$begin if (select count(*) from public.project_sources)<>4 then raise exception 'owner should see own 4 sources'; end if; end$$;
reset role;

-- sales role: can read, cannot write
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000006000a2',true);
set local role authenticated;
do $$begin if (select count(*) from public.project_sources)<>4 then raise exception 'sales should read org sources'; end if; end$$;
select pg_temp.src_expect_error($$insert into public.project_sources(project_id,kind,title,url) values ('00000000-0000-0000-0000-0000006000c1','other','x','https://ok.example')$$,'sales inserted');
reset role;

-- another developer: sees nothing, writes nothing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000006000a3',true);
set local role authenticated;
do $$begin if exists(select 1 from public.project_sources) then raise exception 'foreign org sees sources'; end if; end$$;
select pg_temp.src_expect_error($$insert into public.project_sources(project_id,kind,title,url) values ('00000000-0000-0000-0000-0000006000c1','other','x','https://ok.example')$$,'foreign org inserted');
update public.project_sources set title='hacked';
do $$begin if exists(select 1 from public.project_sources where title='hacked') then raise exception 'foreign org updated'; end if; end$$;
reset role;

-- buyer: nothing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000006000a4',true);
set local role authenticated;
do $$begin if exists(select 1 from public.project_sources) then raise exception 'buyer sees sources'; end if; end$$;
reset role;

-- owner cannot move a link to another project
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000006000a1',true);
set local role authenticated;
select pg_temp.src_expect_error($$update public.project_sources set project_id='00000000-0000-0000-0000-0000006000c2' where kind='brochure' and title='Brochure'$$,'project moved');
reset role;

-- anonymous: base table closed; public view shows only public links of published projects
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
select pg_temp.src_expect_error($$select * from public.project_sources$$,'anon read base table');
select pg_temp.src_expect_error($$update public.public_project_sources set title='x'$$,'anon update view');
select pg_temp.src_expect_error($$delete from public.public_project_sources$$,'anon delete view');
do $$begin
  if (select count(*) from public.public_project_sources)<>1 then raise exception 'anon should see exactly 1 public link, got %', (select count(*) from public.public_project_sources); end if;
  if (select title from public.public_project_sources)<>'Brochure' then raise exception 'wrong public link'; end if;
end$$;
reset role;
rollback;
select 'PROJECT SOURCES OK' as result;
