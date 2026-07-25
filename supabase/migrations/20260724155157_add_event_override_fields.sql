-- Canvas-linked cards may be customized in Aldama. Keep a small allow-listed
-- set of field names so synchronization can preserve only intentional edits.
alter table public.events
  add column override_fields text[] not null default '{}'::text[];

alter table public.events
  add constraint events_override_fields_allowed
  check (
    override_fields <@ array[
      'title',
      'subject',
      'event_type',
      'starts_at',
      'due_at'
    ]::text[]
  );

comment on column public.events.override_fields is
  'Aldama-edited Canvas fields that synchronization must preserve';
