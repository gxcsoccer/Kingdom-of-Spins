-- Kingdom of Spins: parents sign in with Google (auth.users); each parent manages kid profiles and their saves.
create table if not exists public.kid_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nickname text not null check (char_length(nickname) between 1 and 24),
  avatar text,
  pin text check (pin is null or pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);
create index if not exists kid_profiles_parent_idx on public.kid_profiles(parent_id);

create table if not exists public.saves (
  kid_id uuid primary key references public.kid_profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kid_profiles enable row level security;
alter table public.saves enable row level security;

create policy "parents read own kids" on public.kid_profiles for select to authenticated using (parent_id = (select auth.uid()));
create policy "parents create own kids" on public.kid_profiles for insert to authenticated with check (parent_id = (select auth.uid()));
create policy "parents update own kids" on public.kid_profiles for update to authenticated using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
create policy "parents delete own kids" on public.kid_profiles for delete to authenticated using (parent_id = (select auth.uid()));

create policy "parents read own saves" on public.saves for select to authenticated
  using (exists (select 1 from public.kid_profiles k where k.id = kid_id and k.parent_id = (select auth.uid())));
create policy "parents write own saves" on public.saves for insert to authenticated
  with check (exists (select 1 from public.kid_profiles k where k.id = kid_id and k.parent_id = (select auth.uid())));
create policy "parents update own saves" on public.saves for update to authenticated
  using (exists (select 1 from public.kid_profiles k where k.id = kid_id and k.parent_id = (select auth.uid())))
  with check (exists (select 1 from public.kid_profiles k where k.id = kid_id and k.parent_id = (select auth.uid())));
create policy "parents delete own saves" on public.saves for delete to authenticated
  using (exists (select 1 from public.kid_profiles k where k.id = kid_id and k.parent_id = (select auth.uid())));

grant select, insert, update, delete on public.kid_profiles, public.saves to authenticated;
