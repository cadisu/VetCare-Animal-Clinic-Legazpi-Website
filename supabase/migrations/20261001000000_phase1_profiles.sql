-- =====================================================================
-- Phase 1: application profiles, roles, account status, and RLS
-- Run in the Supabase SQL Editor (or via `supabase db push`).
-- =====================================================================

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('CLIENT', 'STAFF', 'SENIOR_VET');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('ACTIVE', 'INACTIVE');
exception when duplicate_object then null; end $$;

-- ---------- Profiles table (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete restrict,
  full_name      text not null default '' check (char_length(full_name) <= 120),
  email          text not null check (char_length(email) <= 254),
  contact_number text check (contact_number is null or char_length(contact_number) <= 20),
  role           public.user_role not null default 'CLIENT',
  status         public.account_status not null default 'ACTIVE',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user profile linked to Supabase Auth. role/status are never writable by end users.';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- ---------- updated_at maintenance ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Auto-create a profile for every new auth user ----------
-- SECURITY: role is ALWAYS 'CLIENT' and status ALWAYS 'ACTIVE' here.
-- Any "role" value sent in sign-up metadata is deliberately ignored, so public
-- registration can never create STAFF or SENIOR_VET accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, contact_number, role, status)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'contact_number', ''), 20), ''),
    'CLIENT',
    'ACTIVE'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper used by later phases' RLS policies ----------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and status = 'ACTIVE';
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Users may update ONLY their own row, and only while ACTIVE.
-- Which columns are editable is restricted by the column grants below.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and status = 'ACTIVE')
  with check (id = auth.uid());

-- No INSERT or DELETE policies: rows are created by the trigger above and are
-- never deleted by end users (accounts are deactivated, not destroyed).

-- ---------- Privileges (defence in depth on top of RLS) ----------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- role, status, email, id and timestamps are NOT updatable by end users:
grant update (full_name, contact_number) on public.profiles to authenticated;
