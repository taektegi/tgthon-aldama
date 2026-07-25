-- Authenticated server actions use the caller's session, so Canvas connection and
-- sync bookkeeping need narrowly scoped grants plus ownership-based RLS policies.
-- The credential remains AES-256-GCM ciphertext; no plaintext token is stored here.

grant select (credential_ciphertext) on table public.sources to authenticated;
grant insert (user_id, type, name, credential_ciphertext)
  on table public.sources to authenticated;
grant update (name, status, credential_ciphertext, last_synced_at, last_sync_error)
  on table public.sources to authenticated;
grant delete on table public.sources to authenticated;

create policy "sources_insert_own"
on public.sources for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "sources_update_own"
on public.sources for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "sources_delete_own"
on public.sources for delete
to authenticated
using ((select auth.uid()) = user_id);

grant insert (user_id, source_id)
  on table public.sync_runs to authenticated;
grant update (status, finished_at, inserted_count, updated_count, error_code, error_message)
  on table public.sync_runs to authenticated;

create policy "sync_runs_insert_own"
on public.sync_runs for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.sources
    where sources.id = sync_runs.source_id
      and sources.user_id = (select auth.uid())
  )
);

create policy "sync_runs_update_own"
on public.sync_runs for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.sources
    where sources.id = sync_runs.source_id
      and sources.user_id = (select auth.uid())
  )
);
