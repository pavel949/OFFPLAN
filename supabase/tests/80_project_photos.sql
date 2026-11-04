-- Storage policy for developer photo uploads: only a user who can submit evidence for the project may upload under "<project_id>/".
create or replace function pg_temp.photo_expect_error(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'expected access failure: %',q;
end $$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into storage.objects(bucket_id,name) values ('project-photos','00000000-0000-0000-0000-0000000000d1/a.jpg');
select pg_temp.photo_expect_error($$insert into storage.objects(bucket_id,name) values ('project-photos','00000000-0000-0000-0000-0000000000ff/a.jpg')$$);
select pg_temp.photo_expect_error($$insert into storage.objects(bucket_id,name) values ('project-photos','not-a-uuid/a.jpg')$$);
select pg_temp.photo_expect_error($$insert into storage.objects(bucket_id,name) values ('project-photos','a.jpg')$$);
select pg_temp.photo_expect_error($$insert into storage.objects(bucket_id,name) values ('other-bucket','00000000-0000-0000-0000-0000000000d1/a.jpg')$$);
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
select pg_temp.photo_expect_error($$insert into storage.objects(bucket_id,name) values ('project-photos','00000000-0000-0000-0000-0000000000d1/b.jpg')$$);
reset role;
rollback;
select 'PROJECT PHOTOS OK' as result;
