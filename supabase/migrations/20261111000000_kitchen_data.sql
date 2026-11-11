-- Shared data for The Pass: one row per app data key (recipes, staff,
-- each station's shift and count, waste log, prices...). The app mirrors
-- its local storage here and listens for changes from other phones.
create table if not exists public.kitchen_data (
  kitchen_id text not null default 'wandering-vine',
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (kitchen_id, key)
);

alter table public.kitchen_data enable row level security;

-- Only phones signed in with a kitchen account can read or write.
-- (New sign-ups should be turned off in Supabase Auth: the chef adds the
-- kitchen account by hand.)
create policy "kitchen phones read" on public.kitchen_data
  for select to authenticated using (true);
create policy "kitchen phones insert" on public.kitchen_data
  for insert to authenticated with check (true);
create policy "kitchen phones update" on public.kitchen_data
  for update to authenticated using (true) with check (true);
create policy "kitchen phones delete" on public.kitchen_data
  for delete to authenticated using (true);

-- Live updates to every phone.
alter publication supabase_realtime add table public.kitchen_data;
