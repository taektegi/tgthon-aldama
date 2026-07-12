create index sources_user_id_idx on public.sources (user_id);
create index events_user_id_idx on public.events (user_id);
create index events_source_id_idx on public.events (source_id);
create index sync_runs_user_id_idx on public.sync_runs (user_id);
create index sync_runs_source_id_idx on public.sync_runs (source_id);

create unique index events_source_external_uid_key
on public.events (source_id, external_uid)
where external_uid is not null;

create index events_user_pending_due_at_idx
on public.events (user_id, due_at)
where is_completed = false and due_at is not null;

create index sync_runs_source_started_at_idx
on public.sync_runs (source_id, started_at desc);
