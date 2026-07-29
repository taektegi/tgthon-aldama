alter table public.events
  add column d_day_basis text not null default 'due_at';

alter table public.events
  add constraint events_d_day_basis_allowed
  check (d_day_basis in ('due_at', 'starts_at'));

comment on column public.events.d_day_basis is
  'Event timestamp used for D-day, urgency color, and priority grouping';
