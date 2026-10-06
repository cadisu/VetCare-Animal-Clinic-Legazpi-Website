-- =====================================================================
-- Phase 3: appointments, slots, services, veterinarians, capacity RPCs
-- Run AFTER Phase 2 migration.
-- =====================================================================

-- ---------- Enums ----------
do $$ begin
  create type public.appointment_source as enum ('APPOINTMENT', 'WALK_IN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum (
    'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.availability_mode as enum ('OPEN', 'BY_APPOINTMENT', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_category as enum (
    'CONSULTATION', 'VACCINATION', 'PREVENTION', 'GROOMING', 'SURGERY', 'OTHER'
  );
exception when duplicate_object then null; end $$;

-- ---------- Services ----------
create table if not exists public.services (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  description           text check (description is null or char_length(description) <= 2000),
  category              public.service_category not null default 'OTHER',
  requires_veterinarian boolean not null default true,
  is_active             boolean not null default true,
  is_bookable           boolean not null default true,
  price                 numeric(12, 2) check (price is null or price >= 0),
  duration_minutes      int check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 480)),
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists services_active_bookable_idx on public.services (is_active, is_bookable, sort_order);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ---------- Veterinarians (profile_id linked after privileged accounts exist) ----------
create table if not exists public.veterinarians (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  profile_id   uuid unique references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists veterinarians_set_updated_at on public.veterinarians;
create trigger veterinarians_set_updated_at
  before update on public.veterinarians
  for each row execute function public.set_updated_at();

-- ---------- Weekly availability ----------
create table if not exists public.veterinarian_weekly_availability (
  id               uuid primary key default gen_random_uuid(),
  veterinarian_id  uuid not null references public.veterinarians (id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 0 and 6),
  start_time       time not null,
  end_time         time not null,
  mode             public.availability_mode not null default 'OPEN',
  check (start_time < end_time),
  unique (veterinarian_id, day_of_week)
);

create table if not exists public.clinic_weekly_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  is_closed   boolean not null default false,
  check (is_closed or start_time < end_time)
);

create table if not exists public.blocked_dates (
  id              uuid primary key default gen_random_uuid(),
  block_date      date not null,
  veterinarian_id uuid references public.veterinarians (id) on delete cascade,
  reason          text check (reason is null or char_length(reason) <= 500),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (block_date, veterinarian_id)
);

-- ---------- Slots ----------
create table if not exists public.appointment_slots (
  id                       uuid primary key default gen_random_uuid(),
  slot_date                date not null,
  start_time               time not null,
  capacity                 int not null default 3 check (capacity > 0 and capacity <= 50),
  is_blocked               boolean not null default false,
  veterinarian_id          uuid references public.veterinarians (id) on delete restrict,
  requires_vet_acceptance  boolean not null default false,
  created_at               timestamptz not null default now()
);

create unique index if not exists appointment_slots_vet_lane_idx
  on public.appointment_slots (slot_date, start_time, veterinarian_id)
  where veterinarian_id is not null;

create unique index if not exists appointment_slots_clinic_lane_idx
  on public.appointment_slots (slot_date, start_time)
  where veterinarian_id is null;

create index if not exists appointment_slots_date_vet_idx
  on public.appointment_slots (slot_date, veterinarian_id);

-- Immutable slot identity fields
create or replace function public.prevent_slot_identity_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.slot_date is distinct from old.slot_date
       or new.start_time is distinct from old.start_time
       or new.veterinarian_id is distinct from old.veterinarian_id
       or new.requires_vet_acceptance is distinct from old.requires_vet_acceptance then
      raise exception 'Slot date, time, veterinarian and acceptance flag cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_slots_immutable_identity on public.appointment_slots;
create trigger appointment_slots_immutable_identity
  before update on public.appointment_slots
  for each row execute function public.prevent_slot_identity_change();

-- Reject lowering capacity below booked count
create or replace function public.enforce_slot_capacity_floor()
returns trigger
language plpgsql
as $$
declare
  booked int;
begin
  if new.capacity < old.capacity then
    select count(*)::int into booked
    from public.appointments a
    where a.slot_id = old.id and a.status <> 'CANCELLED';
    if new.capacity < booked then
      raise exception 'Capacity cannot be below current bookings (%)', booked;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_slots_capacity_floor on public.appointment_slots;
create trigger appointment_slots_capacity_floor
  before update of capacity on public.appointment_slots
  for each row execute function public.enforce_slot_capacity_floor();

-- ---------- Appointments ----------
create table if not exists public.appointments (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles (id) on delete restrict,
  pet_id         uuid not null references public.pets (id) on delete restrict,
  service_id     uuid not null references public.services (id) on delete restrict,
  slot_id        uuid not null references public.appointment_slots (id) on delete restrict,
  source         public.appointment_source not null default 'APPOINTMENT',
  status         public.appointment_status not null default 'PENDING',
  over_capacity  boolean not null default false,
  created_by     uuid not null references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_slot_idx on public.appointments (slot_id);
create index if not exists appointments_pet_idx on public.appointments (pet_id);

create unique index if not exists appointments_pet_slot_active_idx
  on public.appointments (pet_id, slot_id)
  where status <> 'CANCELLED';

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Capacity enforcement at insert/update
create or replace function public.enforce_appointment_capacity()
returns trigger
language plpgsql
as $$
declare
  slot_row public.appointment_slots%rowtype;
  booked int;
begin
  select * into slot_row from public.appointment_slots where id = new.slot_id for update;
  if not found then
    raise exception 'Invalid slot';
  end if;

  select count(*)::int into booked
  from public.appointments a
  where a.slot_id = new.slot_id
    and a.status <> 'CANCELLED'
    and (tg_op = 'INSERT' or a.id <> new.id);

  if booked >= slot_row.capacity and not (new.over_capacity and public.current_user_role() in ('STAFF', 'SENIOR_VET')) then
    raise exception 'This time slot is full';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_capacity_check on public.appointments;
create trigger appointments_capacity_check
  before insert or update of slot_id, status, over_capacity on public.appointments
  for each row execute function public.enforce_appointment_capacity();

-- Prevent same pet at same date/time in two active appointments
create or replace function public.prevent_pet_double_booking()
returns trigger
language plpgsql
as $$
declare
  slot_row public.appointment_slots%rowtype;
begin
  if new.status = 'CANCELLED' then
    return new;
  end if;

  select * into slot_row from public.appointment_slots where id = new.slot_id;
  if exists (
    select 1
    from public.appointments a
    join public.appointment_slots s on s.id = a.slot_id
    where a.pet_id = new.pet_id
      and a.status <> 'CANCELLED'
      and s.slot_date = slot_row.slot_date
      and s.start_time = slot_row.start_time
      and (tg_op = 'INSERT' or a.id <> new.id)
  ) then
    raise exception 'This pet already has an appointment at that date and time';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_pet_double_book on public.appointments;
create trigger appointments_pet_double_book
  before insert or update of slot_id, pet_id, status on public.appointments
  for each row execute function public.prevent_pet_double_booking();

-- ---------- Helpers ----------
create or replace function public.clinic_now()
returns timestamptz
language sql
stable
as $$
  select now() at time zone 'Asia/Manila';
$$;

create or replace function public.is_date_blocked(p_date date, p_vet_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.blocked_dates b
    where b.block_date = p_date
      and (b.veterinarian_id is null or b.veterinarian_id = p_vet_id)
  );
$$;

-- ---------- ensure_slots ----------
create or replace function public.ensure_slots(p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  dow smallint;
  t time;
  ch record;
  vh record;
  acceptance boolean;
begin
  if p_to < p_from then
    raise exception 'Invalid date range';
  end if;
  if p_to > p_from + 60 then
    raise exception 'Date range exceeds booking window';
  end if;

  d := p_from;
  while d <= p_to loop
    dow := extract(dow from d)::smallint;

    -- Clinic lane
    select * into ch from public.clinic_weekly_hours where day_of_week = dow;
    if found and not ch.is_closed and not public.is_date_blocked(d, null) then
      t := ch.start_time;
      while t + interval '60 minutes' <= ch.end_time loop
        insert into public.appointment_slots (slot_date, start_time, veterinarian_id, requires_vet_acceptance)
        values (d, t, null, false)
        on conflict do nothing;
        t := t + interval '60 minutes';
      end loop;
    end if;

    -- Vet lanes
    for vh in
      select v.*, w.start_time as w_start, w.end_time as w_end, w.mode
      from public.veterinarians v
      join public.veterinarian_weekly_availability w on w.veterinarian_id = v.id
      where v.is_active and w.day_of_week = dow and w.mode <> 'CLOSED'
    loop
      if public.is_date_blocked(d, vh.id) then
        continue;
      end if;
      acceptance := vh.mode = 'BY_APPOINTMENT';
      t := vh.w_start;
      while t + interval '60 minutes' <= vh.w_end loop
        insert into public.appointment_slots (slot_date, start_time, veterinarian_id, requires_vet_acceptance)
        values (d, t, vh.id, acceptance)
        on conflict do nothing;
        t := t + interval '60 minutes';
      end loop;
    end loop;

    d := d + 1;
  end loop;
end;
$$;

revoke all on function public.ensure_slots(date, date) from public, anon;
grant execute on function public.ensure_slots(date, date) to authenticated;

-- ---------- get_availability ----------
create or replace function public.get_availability(
  p_service_id uuid,
  p_veterinarian_id uuid,
  p_from date,
  p_to date
)
returns table (
  slot_id uuid,
  slot_date date,
  start_time time,
  capacity int,
  booked_count int,
  slot_state text,
  requires_vet_acceptance boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  svc public.services%rowtype;
begin
  select * into svc from public.services where id = p_service_id;
  if not found then
    return;
  end if;

  perform public.ensure_slots(p_from, p_to);

  return query
  with slots as (
    select s.*
    from public.appointment_slots s
    where s.slot_date between p_from and p_to
      and (
        (svc.requires_veterinarian and s.veterinarian_id = p_veterinarian_id)
        or (not svc.requires_veterinarian and s.veterinarian_id is null)
      )
  ),
  counts as (
    select a.slot_id, count(*)::int as booked
    from public.appointments a
    where a.status <> 'CANCELLED'
    group by a.slot_id
  )
  select
    sl.id,
    sl.slot_date,
    sl.start_time,
    sl.capacity,
    coalesce(c.booked, 0),
    case
      when sl.is_blocked or public.is_date_blocked(sl.slot_date, sl.veterinarian_id) then 'BLOCKED'
      when coalesce(c.booked, 0) >= sl.capacity then 'FULL'
      when sl.slot_date < (public.clinic_now())::date then 'UNAVAILABLE'
      when sl.slot_date = (public.clinic_now())::date
           and sl.start_time <= (public.clinic_now())::time then 'UNAVAILABLE'
      else 'AVAILABLE'
    end,
    sl.requires_vet_acceptance
  from slots sl
  left join counts c on c.slot_id = sl.id
  order by sl.slot_date, sl.start_time;
end;
$$;

revoke all on function public.get_availability(uuid, uuid, date, date) from public, anon;
grant execute on function public.get_availability(uuid, uuid, date, date) to authenticated;

-- ---------- Internal booking ----------
create or replace function public._create_appointment_internal(
  p_client_id uuid,
  p_pet_id uuid,
  p_service_id uuid,
  p_slot_id uuid,
  p_source public.appointment_source,
  p_over_capacity boolean,
  p_allow_past_current_slot boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  role public.user_role;
  slot_row public.appointment_slots%rowtype;
  svc public.services%rowtype;
  pet_row public.pets%rowtype;
  client_row public.profiles%rowtype;
  appt_id uuid;
  slot_start timestamptz;
  now_local timestamp;
begin
  role := public.current_user_role();
  now_local := public.clinic_now();

  select * into client_row from public.profiles where id = p_client_id;
  if not found or client_row.role <> 'CLIENT' or client_row.status <> 'ACTIVE' then
    raise exception 'Invalid client';
  end if;

  select * into pet_row from public.pets where id = p_pet_id;
  if not found or pet_row.owner_id <> p_client_id or pet_row.is_archived then
    raise exception 'Invalid pet';
  end if;

  select * into svc from public.services where id = p_service_id;
  if not found or not svc.is_active or not svc.is_bookable then
    raise exception 'Service is not available for booking';
  end if;

  select * into slot_row from public.appointment_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Invalid slot';
  end if;

  if svc.requires_veterinarian then
    if slot_row.veterinarian_id is null then
      raise exception 'This service requires a veterinarian slot';
    end if;
  else
    if slot_row.veterinarian_id is not null then
      raise exception 'This service uses clinic-wide slots';
    end if;
  end if;

  if slot_row.is_blocked or public.is_date_blocked(slot_row.slot_date, slot_row.veterinarian_id) then
    raise exception 'This slot is not available';
  end if;

  if slot_row.slot_date > (now_local::date + 60) then
    raise exception 'Outside booking window';
  end if;

  slot_start := slot_row.slot_date + slot_row.start_time;
  if not p_allow_past_current_slot then
    if slot_start <= now_local then
      raise exception 'Cannot book a past time slot';
    end if;
  else
    if slot_row.slot_date < now_local::date
       or (slot_row.slot_date = now_local::date and slot_row.start_time + interval '60 minutes' <= now_local::time) then
      raise exception 'Walk-in slot has already ended';
    end if;
  end if;

  if role = 'CLIENT' and p_over_capacity then
    raise exception 'Not authorized';
  end if;

  if role = 'CLIENT' and p_client_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  if role in ('STAFF', 'SENIOR_VET') and p_source not in ('APPOINTMENT', 'WALK_IN') then
    raise exception 'Invalid source';
  end if;

  if role = 'CLIENT' and p_source <> 'APPOINTMENT' then
    raise exception 'Not authorized';
  end if;

  insert into public.appointments (
    client_id, pet_id, service_id, slot_id, source, status, over_capacity, created_by
  )
  values (
    p_client_id,
    p_pet_id,
    p_service_id,
    p_slot_id,
    p_source,
    'PENDING',
    coalesce(p_over_capacity, false),
    auth.uid()
  )
  returning id into appt_id;

  return appt_id;
end;
$$;

revoke all on function public._create_appointment_internal(uuid, uuid, uuid, uuid, public.appointment_source, boolean, boolean) from public, anon, authenticated;

create or replace function public.book_appointment(
  p_pet_id uuid,
  p_service_id uuid,
  p_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'CLIENT' then
    raise exception 'Not authorized';
  end if;
  return public._create_appointment_internal(
    auth.uid(), p_pet_id, p_service_id, p_slot_id, 'APPOINTMENT', false, false
  );
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, uuid) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid) to authenticated;

create or replace function public.create_staff_appointment(
  p_client_id uuid,
  p_pet_id uuid,
  p_service_id uuid,
  p_slot_id uuid,
  p_source public.appointment_source,
  p_allow_over_capacity boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  return public._create_appointment_internal(
    p_client_id,
    p_pet_id,
    p_service_id,
    p_slot_id,
    p_source,
    coalesce(p_allow_over_capacity, false),
    true
  );
end;
$$;

revoke all on function public.create_staff_appointment(uuid, uuid, uuid, uuid, public.appointment_source, boolean) from public, anon;
grant execute on function public.create_staff_appointment(uuid, uuid, uuid, uuid, public.appointment_source, boolean) to authenticated;

-- ---------- RLS ----------
alter table public.services enable row level security;
alter table public.veterinarians enable row level security;
alter table public.veterinarian_weekly_availability enable row level security;
alter table public.clinic_weekly_hours enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointments enable row level security;

-- services
drop policy if exists "services_select" on public.services;
create policy "services_select"
  on public.services for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (is_active and is_bookable)
    or exists (
      select 1 from public.appointments a
      where a.service_id = services.id and a.client_id = auth.uid()
    )
  );

drop policy if exists "services_manage_senior_vet" on public.services;
create policy "services_manage_senior_vet"
  on public.services for all to authenticated
  using (public.current_user_role() = 'SENIOR_VET')
  with check (public.current_user_role() = 'SENIOR_VET');

-- veterinarians
drop policy if exists "veterinarians_select" on public.veterinarians;
create policy "veterinarians_select"
  on public.veterinarians for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or is_active
    or exists (
      select 1
      from public.appointments a
      join public.appointment_slots s on s.id = a.slot_id
      where a.client_id = auth.uid() and s.veterinarian_id = veterinarians.id
    )
  );

drop policy if exists "veterinarians_manage_senior_vet" on public.veterinarians;
create policy "veterinarians_manage_senior_vet"
  on public.veterinarians for all to authenticated
  using (public.current_user_role() = 'SENIOR_VET')
  with check (public.current_user_role() = 'SENIOR_VET');

-- weekly availability + clinic hours
drop policy if exists "vet_weekly_select" on public.veterinarian_weekly_availability;
create policy "vet_weekly_select"
  on public.veterinarian_weekly_availability for select to authenticated
  using (true);

drop policy if exists "vet_weekly_manage" on public.veterinarian_weekly_availability;
create policy "vet_weekly_manage"
  on public.veterinarian_weekly_availability for all to authenticated
  using (public.current_user_role() = 'SENIOR_VET')
  with check (public.current_user_role() = 'SENIOR_VET');

drop policy if exists "clinic_hours_select" on public.clinic_weekly_hours;
create policy "clinic_hours_select"
  on public.clinic_weekly_hours for select to authenticated
  using (true);

drop policy if exists "clinic_hours_manage" on public.clinic_weekly_hours;
create policy "clinic_hours_manage"
  on public.clinic_weekly_hours for all to authenticated
  using (public.current_user_role() = 'SENIOR_VET')
  with check (public.current_user_role() = 'SENIOR_VET');

-- blocked dates
drop policy if exists "blocked_dates_select" on public.blocked_dates;
create policy "blocked_dates_select"
  on public.blocked_dates for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "blocked_dates_insert" on public.blocked_dates;
create policy "blocked_dates_insert"
  on public.blocked_dates for insert to authenticated
  with check (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "blocked_dates_delete" on public.blocked_dates;
create policy "blocked_dates_delete"
  on public.blocked_dates for delete to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

-- slots: staff block only; senior vet capacity
drop policy if exists "slots_select" on public.appointment_slots;
create policy "slots_select"
  on public.appointment_slots for select to authenticated
  using (true);

drop policy if exists "slots_update_staff_block" on public.appointment_slots;
create policy "slots_update_staff_block"
  on public.appointment_slots for update to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'))
  with check (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "slots_update_capacity_senior_vet" on public.appointment_slots;
-- capacity updates enforced in app; RLS allows senior vet full update on capacity column via grant

-- appointments
drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select"
  on public.appointments for select to authenticated
  using (
    (client_id = auth.uid() and public.current_user_role() = 'CLIENT')
    or public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

-- ---------- Privileges ----------
revoke all on public.services from anon, authenticated;
grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;

revoke all on public.veterinarians from anon, authenticated;
grant select on public.veterinarians to authenticated;
grant insert, update, delete on public.veterinarians to authenticated;

revoke all on public.veterinarian_weekly_availability from anon, authenticated;
grant select, insert, update, delete on public.veterinarian_weekly_availability to authenticated;

revoke all on public.clinic_weekly_hours from anon, authenticated;
grant select, insert, update, delete on public.clinic_weekly_hours to authenticated;

revoke all on public.blocked_dates from anon, authenticated;
grant select, insert, delete on public.blocked_dates to authenticated;

revoke all on public.appointment_slots from anon, authenticated;
grant select on public.appointment_slots to authenticated;
grant update (is_blocked, capacity) on public.appointment_slots to authenticated;

revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

-- ---------- Seeds (fixed vet IDs for profile linking) ----------
insert into public.veterinarians (id, display_name, sort_order)
values
  ('a1000000-0000-4000-8000-000000000001', 'Dr. Carmela Dawn De Guzman-Yanga', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Dr. Merlyn P. Castelo', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Dr. John Kenneth P. Adan', 3)
on conflict (id) do nothing;

insert into public.clinic_weekly_hours (day_of_week, start_time, end_time, is_closed)
values
  (0, '09:00', '16:00', false),
  (1, '09:00', '18:00', false),
  (2, '09:00', '18:00', false),
  (3, '09:00', '18:00', false),
  (4, '09:00', '18:00', false),
  (5, '09:00', '18:00', false),
  (6, '09:00', '18:00', false)
on conflict (day_of_week) do update
  set start_time = excluded.start_time, end_time = excluded.end_time, is_closed = excluded.is_closed;

-- Carmela: Tue-Thu BY_APPOINTMENT, Fri-Sat OPEN
insert into public.veterinarian_weekly_availability (veterinarian_id, day_of_week, start_time, end_time, mode)
values
  ('a1000000-0000-4000-8000-000000000001', 2, '09:00', '18:00', 'BY_APPOINTMENT'),
  ('a1000000-0000-4000-8000-000000000001', 3, '09:00', '18:00', 'BY_APPOINTMENT'),
  ('a1000000-0000-4000-8000-000000000001', 4, '09:00', '18:00', 'BY_APPOINTMENT'),
  ('a1000000-0000-4000-8000-000000000001', 5, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000001', 6, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000002', 0, '09:00', '16:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000002', 3, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000002', 4, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000002', 6, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000003', 0, '09:00', '16:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000003', 1, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000003', 2, '09:00', '18:00', 'OPEN'),
  ('a1000000-0000-4000-8000-000000000003', 5, '09:00', '18:00', 'OPEN')
on conflict (veterinarian_id, day_of_week) do nothing;

insert into public.services (name, description, category, requires_veterinarian, is_active, is_bookable, sort_order)
select v.name, v.description, v.category, v.requires_veterinarian, true, true, v.sort_order
from (values
  ('Consultation', 'Veterinary consultation with a clinic veterinarian.', 'CONSULTATION'::public.service_category, true, 10),
  ('Multivalent vaccine', 'Multivalent vaccination service.', 'VACCINATION'::public.service_category, true, 20),
  ('Anti-Rabies vaccine', 'Anti-rabies vaccination.', 'VACCINATION'::public.service_category, true, 30),
  ('Deworming', 'Deworming treatment.', 'OTHER'::public.service_category, true, 40),
  ('Tick & Flea / Heartworm prevention', 'Parasite prevention consultation and treatment.', 'PREVENTION'::public.service_category, true, 50),
  ('Grooming', 'Grooming service (clinic-wide scheduling).', 'GROOMING'::public.service_category, false, 60),
  ('Surgery', 'Surgical service with a clinic veterinarian.', 'SURGERY'::public.service_category, true, 70)
) as v(name, description, category, requires_veterinarian, sort_order)
where not exists (select 1 from public.services s where s.name = v.name);
