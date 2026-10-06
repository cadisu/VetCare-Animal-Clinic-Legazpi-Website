-- Phase 3 amendment: staff/senior vet may mark service finished (COMPLETED only).

create or replace function public.mark_appointment_completed(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role public.user_role;
  appt public.appointments%rowtype;
  slot_row public.appointment_slots%rowtype;
begin
  role := public.current_user_role();
  if role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if appt.status in ('COMPLETED', 'CANCELLED', 'NO_SHOW') then
    raise exception 'Appointment cannot be completed from its current status';
  end if;

  select * into slot_row from public.appointment_slots where id = appt.slot_id;
  if slot_row.requires_vet_acceptance and appt.status = 'PENDING' then
    raise exception 'This appointment is awaiting veterinarian confirmation before the service can be completed';
  end if;

  if appt.status not in ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION') then
    raise exception 'Appointment cannot be completed from its current status';
  end if;

  update public.appointments
  set status = 'COMPLETED'
  where id = p_appointment_id;
end;
$$;

revoke all on function public.mark_appointment_completed(uuid) from public, anon;
grant execute on function public.mark_appointment_completed(uuid) to authenticated;
