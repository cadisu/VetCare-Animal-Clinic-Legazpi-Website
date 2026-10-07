-- Phase 3: mark times a pet already holds as ALREADY_BOOKED in availability.

drop function if exists public.get_availability(uuid, uuid, date, date);

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
      when p_pet_id is not null and exists (
        select 1
        from public.appointments a
        join public.appointment_slots s on s.id = a.slot_id
        where a.pet_id = p_pet_id
          and a.status <> 'CANCELLED'
          and s.slot_date = sl.slot_date
          and s.start_time = sl.start_time
      ) then 'ALREADY_BOOKED'
      else 'AVAILABLE'
    end,
    sl.requires_vet_acceptance
  from slots sl
  left join counts c on c.slot_id = sl.id
  order by sl.slot_date, sl.start_time;
end;
$$;

revoke all on function public.get_availability(uuid, uuid, date, date, uuid) from public, anon;
grant execute on function public.get_availability(uuid, uuid, date, date, uuid) to authenticated;
