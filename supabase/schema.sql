-- Run once in your own Supabase SQL editor. No passwords or service keys in the website.
begin;
create table if not exists public.learning_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 kind text not null check (kind in ('review','spelling','bookmark','note','settings')),
 word_id text not null check (length(word_id)<=160),
 value jsonb not null check (octet_length(value::text)<=20000),
 occurred_at bigint not null check (occurred_at>=0),
 day_key text not null check (day_key ~ '^\d{4}-\d{2}-\d{2}$'),
 created_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.learning_events enable row level security;
revoke all on public.learning_events from anon, authenticated;
grant select,insert on public.learning_events to authenticated;
drop policy if exists own_event_select on public.learning_events;
create policy own_event_select on public.learning_events for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists own_event_insert on public.learning_events;
create policy own_event_insert on public.learning_events for insert to authenticated with check ((select auth.uid())=user_id);
-- Immutable event log: no UPDATE/DELETE rights. Bookmark removal and changed notes create new events.
commit;
