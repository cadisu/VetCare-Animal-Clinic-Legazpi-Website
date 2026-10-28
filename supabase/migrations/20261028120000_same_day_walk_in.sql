-- Staff and Senior Vet can record a walk-in on an earlier slot from today.
-- Clients still see those times as unavailable, and dates before today stay closed.

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
as $fn$
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
  elsif p_source = 'WALK_IN' then
    if slot_row.slot_date < now_local::date then
      raise exception 'Cannot book a past date for a walk-in';
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
$fn$;
