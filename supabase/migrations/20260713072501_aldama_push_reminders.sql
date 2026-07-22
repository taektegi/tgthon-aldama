alter table public.events add column reminder_sent_at timestamptz;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;

grant select, insert, delete on table public.push_subscriptions to authenticated;

create policy "push_subscriptions_select_own"
on public.push_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions for delete
to authenticated
using ((select auth.uid()) = user_id);
