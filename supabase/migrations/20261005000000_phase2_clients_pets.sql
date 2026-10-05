-- =====================================================================
-- Phase 2: client profile fields, pets, pet images, and RLS
-- Run AFTER the Phase 1 migration, in the Supabase SQL Editor
-- (or via `supabase db push`).
-- =====================================================================

-- ---------- Client profile fields ----------
alter table public.profiles
  add column if not exists last_name    text not null default '' check (char_length(last_name) <= 60),
  add column if not exists first_name   text not null default '' check (char_length(first_name) <= 60),
  add column if not exists middle_name  text check (middle_name is null or char_length(middle_name) <= 60),
  add column if not exists address      text check (address is null or char_length(address) <= 255),
  add column if not exists birthdate    date check (birthdate is null or birthdate >= date '1900-01-01'),
  -- Set once the client has finished (or skipped) the "register your pets" step.
  add column if not exists onboarded_at timestamptz;

-- Move existing single-field names into the new columns: the last word becomes the
-- last name and everything before it the first name.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'full_name' and is_generated = 'NEVER'
  ) then
    update public.profiles
    set
      first_name = left(case
        when position(' ' in btrim(full_name)) = 0 then btrim(full_name)
        else btrim(regexp_replace(btrim(full_name), '\s+\S+$', ''))
      end, 60),
      last_name = left(case
        when position(' ' in btrim(full_name)) = 0 then ''
        else substring(btrim(full_name) from '(\S+)$')
      end, 60)
    where first_name = '' and last_name = '';

    alter table public.profiles drop column full_name;
  end if;
end $$;

-- full_name is now derived and read-only (used for display and search).
alter table public.profiles
  add column if not exists full_name text generated always as (
    btrim(first_name || ' ' || coalesce(middle_name || ' ', '') || last_name)
  ) stored;

create index if not exists profiles_last_first_idx on public.profiles (last_name, first_name);

-- Safe date parsing for sign-up metadata (bad input must never abort sign-up).
create or replace function public.try_parse_date(value text)
returns date
language plpgsql
stable
as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return value::date;
exception when others then
  return null;
end;
$$;

-- SECURITY: role is ALWAYS 'CLIENT' and status ALWAYS 'ACTIVE' here (unchanged from Phase 1).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  parsed_birthdate date := public.try_parse_date(meta ->> 'birthdate');
begin
  insert into public.profiles (
    id, email, last_name, first_name, middle_name, address, birthdate,
    contact_number, role, status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(meta ->> 'last_name', '')), 60),
    left(btrim(coalesce(meta ->> 'first_name', '')), 60),
    nullif(left(btrim(coalesce(meta ->> 'middle_name', '')), 60), ''),
    nullif(left(btrim(coalesce(meta ->> 'address', '')), 255), ''),
    case when parsed_birthdate between date '1900-01-01' and current_date then parsed_birthdate end,
    nullif(left(coalesce(meta ->> 'contact_number', ''), 20), ''),
    'CLIENT',
    'ACTIVE'
  );
  return new;
end;
$$;

-- Staff and Senior Vets may view all profiles (needed to search/view clients).
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff"
  on public.profiles
  for select
  to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

-- Editable columns for a user's own profile. role, status, email, id, timestamps
-- and the derived full_name stay read-only.
revoke update on public.profiles from authenticated;
grant update (last_name, first_name, middle_name, address, birthdate, contact_number, onboarded_at)
  on public.profiles to authenticated;

-- ---------- Pets ----------
do $$ begin
  create type public.pet_species as enum ('DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pet_gender as enum ('MALE', 'FEMALE');
exception when duplicate_object then null; end $$;

create table if not exists public.pets (
  id             uuid primary key default gen_random_uuid(),
  -- Human-friendly identifier shown as PET-000123.
  pet_number     bigint generated always as identity unique,
  owner_id       uuid not null references public.profiles (id) on delete restrict,
  name           text not null check (char_length(btrim(name)) between 1 and 60),
  species        public.pet_species not null,
  species_other  text check (species_other is null or char_length(btrim(species_other)) between 1 and 40),
  breed          text not null check (char_length(btrim(breed)) between 1 and 80),
  gender         public.pet_gender not null,
  birth_date     date check (birth_date is null or birth_date >= date '1980-01-01'),
  color_markings text not null check (char_length(btrim(color_markings)) between 1 and 200),
  image_path     text check (image_path is null or char_length(image_path) <= 255),
  is_archived    boolean not null default false,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint pets_species_other_matches check ((species = 'OTHER') = (species_other is not null))
);

comment on table public.pets is
  'Pets registered by clients. One client (profiles.role = CLIENT) -> many pets. Archived instead of deleted to keep medical history.';
comment on column public.pets.created_at is 'Registration date.';

create index if not exists pets_owner_idx on public.pets (owner_id);
create index if not exists pets_name_idx on public.pets (lower(name));

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- Pets may only belong to CLIENT accounts.
create or replace function public.ensure_pet_owner_is_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.owner_id and role = 'CLIENT') then
    raise exception 'Pet owner must be a client account';
  end if;
  return new;
end;
$$;

drop trigger if exists pets_owner_is_client on public.pets;
create trigger pets_owner_is_client
  before insert or update of owner_id on public.pets
  for each row execute function public.ensure_pet_owner_is_client();

-- archived_at is maintained by the database, never by the client.
create or replace function public.set_pet_archived_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_archived and not old.is_archived then
    new.archived_at = now();
  elsif not new.is_archived then
    new.archived_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists pets_set_archived_at on public.pets;
create trigger pets_set_archived_at
  before update of is_archived on public.pets
  for each row execute function public.set_pet_archived_at();

alter table public.pets enable row level security;

-- Clients see only their own pets; Staff and Senior Vets see all pets.
drop policy if exists "pets_select" on public.pets;
create policy "pets_select"
  on public.pets
  for select
  to authenticated
  using (
    (owner_id = auth.uid() and public.current_user_role() = 'CLIENT')
    or public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

-- Active clients may register pets only for themselves.
drop policy if exists "pets_insert_own" on public.pets;
create policy "pets_insert_own"
  on public.pets
  for insert
  to authenticated
  with check (owner_id = auth.uid() and public.current_user_role() = 'CLIENT' and not is_archived);

-- Active clients may edit/archive their own, non-archived pets. Staff/Senior Vet
-- editing (weight, protected info) comes in later phases.
drop policy if exists "pets_update_own" on public.pets;
create policy "pets_update_own"
  on public.pets
  for update
  to authenticated
  using (owner_id = auth.uid() and public.current_user_role() = 'CLIENT' and not is_archived)
  with check (owner_id = auth.uid());

-- No DELETE policy: pets are archived, never deleted.

revoke all on public.pets from anon, authenticated;
grant select on public.pets to authenticated;
grant insert (owner_id, name, species, species_other, breed, gender, birth_date, color_markings, image_path)
  on public.pets to authenticated;
grant update (name, species, species_other, breed, gender, birth_date, color_markings, image_path, is_archived)
  on public.pets to authenticated;

-- ---------- Pet images (private Storage bucket) ----------
-- Objects are stored as "<owner_id>/<random>.<ext>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-images', 'pet-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pet_images_select" on storage.objects;
create policy "pet_images_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pet-images'
    and (
      ((storage.foldername(name))[1] = auth.uid()::text and public.current_user_role() = 'CLIENT')
      or public.current_user_role() in ('STAFF', 'SENIOR_VET')
    )
  );

drop policy if exists "pet_images_insert_own" on storage.objects;
create policy "pet_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pet-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'CLIENT'
  );

drop policy if exists "pet_images_delete_own" on storage.objects;
create policy "pet_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pet-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'CLIENT'
  );
