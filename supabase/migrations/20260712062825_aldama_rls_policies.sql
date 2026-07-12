alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.events enable row level security;
alter table public.sync_runs enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.sources from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.sync_runs from anon, authenticated;

grant select, update (display_name) on table public.profiles to authenticated;
grant select (id, user_id, type, name, status, last_synced_at, last_sync_error, created_at, updated_at)
  on table public.sources to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select on table public.sync_runs to authenticated;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "sources_select_own"
on public.sources for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "events_select_own"
on public.events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "events_insert_own"
on public.events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    source_id is null
    or exists (
      select 1 from public.sources
      where sources.id = events.source_id
        and sources.user_id = (select auth.uid())
    )
  )
);

create policy "events_update_own"
on public.events for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    source_id is null
    or exists (
      select 1 from public.sources
      where sources.id = events.source_id
        and sources.user_id = (select auth.uid())
    )
  )
);

create policy "events_delete_own"
on public.events for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "sync_runs_select_own"
on public.sync_runs for select
to authenticated
using ((select auth.uid()) = user_id);
