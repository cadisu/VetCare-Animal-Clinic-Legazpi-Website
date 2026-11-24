-- Optional name suffix (Jr., Sr., III) for client registration and profile edits.
-- Run AFTER the Phase 12 migration.

alter table public.profiles
  add column if not exists name_suffix text
  check (name_suffix is null or char_length(btrim(name_suffix)) between 1 and 20);

comment on column public.profiles.name_suffix is
  'Optional name suffix such as Jr., Sr., or III. Included in the derived full_name.';

-- full_name is generated, so the expression is replaced by dropping and recreating it.
alter table public.profiles drop column if exists full_name;

alter table public.profiles
  add column full_name text generated always as (
    btrim(
      first_name
      || ' '
      || coalesce(middle_name || ' ', '')
      || last_name
      || coalesce(' ' || name_suffix, '')
    )
  ) stored;

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
    id, email, last_name, first_name, middle_name, name_suffix, address, birthdate,
    contact_number, role, status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(meta ->> 'last_name', '')), 60),
    left(btrim(coalesce(meta ->> 'first_name', '')), 60),
    nullif(left(btrim(coalesce(meta ->> 'middle_name', '')), 60), ''),
    nullif(left(btrim(coalesce(meta ->> 'name_suffix', '')), 20), ''),
    nullif(left(btrim(coalesce(meta ->> 'address', '')), 255), ''),
    case when parsed_birthdate between date '1900-01-01' and current_date then parsed_birthdate end,
    nullif(left(coalesce(meta ->> 'contact_number', ''), 20), ''),
    'CLIENT',
    'ACTIVE'
  );
  return new;
end;
$$;

grant update (name_suffix) on public.profiles to authenticated;
