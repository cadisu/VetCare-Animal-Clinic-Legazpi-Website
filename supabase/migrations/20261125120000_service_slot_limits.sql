-- Each service has its own hourly booking limit.
-- Surgery keeps every hour open until one is booked, then that booking also holds the next hour.

alter table public.services
  add column if not exists bookings_per_slot int not null default 3;

alter table public.services drop constraint if exists services_bookings_per_slot_range;
alter table public.services
  add constraint services_bookings_per_slot_range
  check (bookings_per_slot >= 1 and bookings_per_slot <= 50);

update public.services
set bookings_per_slot = 2,
    duration_minutes = 60
where name = 'Consultation';

update public.services
set bookings_per_slot = 3,
    duration_minutes = 60
where name in (
  'Multivalent vaccine',
  'Anti-Rabies vaccine',
  'Deworming',
  'Tick & Flea / Heartworm prevention',
  'Grooming'
);

update public.services
set bookings_per_slot = 1,
    duration_minutes = 120
where name = 'Surgery';

create or replace function public.get_availability(
  p_service_id uuid,
  p_veterinarian_id uuid,
  p_from date,
  p_to date,
  p_pet_id uuid default null
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
as $fn$
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
    where a.service_id = p_service_id
      and a.status <> 'CANCELLED'
    group by a.slot_id
  )
  select
    sl.id,
    sl.slot_date,
    sl.start_time,
    svc.bookings_per_slot,
    coalesce(c.booked, 0),
    case
      when sl.is_blocked or public.is_date_blocked(sl.slot_date, sl.veterinarian_id) then 'BLOCKED'
      when coalesce(c.booked, 0) >= svc.bookings_per_slot
        or (
          (coalesce(svc.duration_minutes, 0) >= 120 or svc.category = 'SURGERY')
          and (
            not exists (
              select 1
              from public.appointment_slots n
              where n.slot_date = sl.slot_date
                and n.veterinarian_id is not distinct from sl.veterinarian_id
                and n.start_time = sl.start_time + interval '1 hour'
                and not n.is_blocked
            )
            or exists (
              select 1
              from public.appointments a
              join public.appointment_slots os on os.id = a.slot_id
              where a.service_id = p_service_id
                and a.status <> 'CANCELLED'
                and os.slot_date = sl.slot_date
                and os.veterinarian_id is not distinct from sl.veterinarian_id
                and os.start_time in (
                  sl.start_time - interval '1 hour',
                  sl.start_time + interval '1 hour'
                )
            )
          )
        ) then 'FULL'
      when p_pet_id is not null and exists (
        select 1
        from public.appointments a
        join public.appointment_slots s on s.id = a.slot_id
        where a.pet_id = p_pet_id
          and a.status <> 'CANCELLED'
          and s.slot_date = sl.slot_date
          and s.start_time = sl.start_time
      ) then 'ALREADY_BOOKED'
      when sl.slot_date < (public.clinic_now())::date then 'UNAVAILABLE'
      when sl.slot_date = (public.clinic_now())::date
           and sl.start_time <= (public.clinic_now())::time then
        case
          when public.current_user_role() in ('STAFF', 'SENIOR_VET') then 'EARLIER_TODAY'
          else 'UNAVAILABLE'
        end
      else 'AVAILABLE'
    end,
    sl.requires_vet_acceptance
  from slots sl
  left join counts c on c.slot_id = sl.id
  order by sl.slot_date, sl.start_time;
end;
$fn$;

create or replace function public.enforce_appointment_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  slot_row public.appointment_slots%rowtype;
  svc public.services%rowtype;
  booked int;
  holds_neighbor boolean;
begin
  if new.status = 'CANCELLED' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.slot_id is not distinct from new.slot_id
     and old.status <> 'CANCELLED' then
    return new;
  end if;

  select * into slot_row from public.appointment_slots where id = new.slot_id for update;
  if not found then
    raise exception 'Invalid slot';
  end if;

  select * into svc from public.services where id = new.service_id;
  if not found then
    raise exception 'Service is not available for booking';
  end if;

  select count(*)::int into booked
  from public.appointments a
  where a.slot_id = new.slot_id
    and a.service_id = new.service_id
    and a.status <> 'CANCELLED'
    and (tg_op = 'INSERT' or a.id <> new.id);

  holds_neighbor := false;
  if coalesce(svc.duration_minutes, 0) >= 120 or svc.category = 'SURGERY' then
    holds_neighbor :=
      not exists (
        select 1
        from public.appointment_slots n
        where n.slot_date = slot_row.slot_date
          and n.veterinarian_id is not distinct from slot_row.veterinarian_id
          and n.start_time = slot_row.start_time + interval '1 hour'
          and not n.is_blocked
      )
      or exists (
        select 1
        from public.appointments a
        join public.appointment_slots os on os.id = a.slot_id
        where a.service_id = new.service_id
          and a.status <> 'CANCELLED'
          and (tg_op = 'INSERT' or a.id <> new.id)
          and os.slot_date = slot_row.slot_date
          and os.veterinarian_id is not distinct from slot_row.veterinarian_id
          and os.start_time in (
            slot_row.start_time - interval '1 hour',
            slot_row.start_time + interval '1 hour'
          )
      );
  end if;

  if (booked >= svc.bookings_per_slot or holds_neighbor)
     and not (new.over_capacity and public.current_user_role() in ('STAFF', 'SENIOR_VET')) then
    raise exception 'This time slot is full';
  end if;

  return new;
end;
$$;
