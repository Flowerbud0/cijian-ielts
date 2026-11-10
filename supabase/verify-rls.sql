-- Run in SQL Editor as postgres. All test identities/events are rolled back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102');
insert into public.learning_events(user_id,id,kind,word_id,value,occurred_at,day_key) values
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','note','test','"A"',1,'2026-11-10'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000202','note','test','"B"',1,'2026-11-10');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.learning_events) <> 1 then raise exception 'Account A isolation failed'; end if;
 if (select value from public.learning_events) <> '"A"'::jsonb then raise exception 'Wrong owner visible'; end if;
 insert into public.learning_events(user_id,id,kind,word_id,value,occurred_at,day_key) values ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000203','note','test','"own"',1,'2026-11-10');
 begin
  insert into public.learning_events(user_id,id,kind,word_id,value,occurred_at,day_key) values ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000204','note','test','"forbidden"',1,'2026-11-10');
  raise exception 'Cross-account insert was allowed';
 exception when insufficient_privilege then null; end;
 if has_table_privilege(current_user,'public.learning_events','UPDATE') or has_table_privilege(current_user,'public.learning_events','DELETE') then raise exception 'Mutable event permissions'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.learning_events) <> 1 then raise exception 'Account B isolation failed'; end if;
 if (select value from public.learning_events) <> '"B"'::jsonb then raise exception 'Account B sees wrong owner'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform count(*) from public.learning_events;
  raise exception 'Anonymous read was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: own read/write, A/B isolation, cross-owner insert denied, anonymous denied, immutable events; test data rolled back' as result;
