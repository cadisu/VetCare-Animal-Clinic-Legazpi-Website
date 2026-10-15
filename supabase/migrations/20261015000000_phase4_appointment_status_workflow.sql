-- Phase 4: appointment status workflow.
-- Apply after 20261014000000_staff_profile_images.sql.
-- Does not rewrite historical migrations or existing appointment rows.
--
-- Allowed transitions (also mirrored in src/lib/appointments/transitions.ts):
--   CLIENT (own row only): PENDING -> CANCELLED
--   STAFF and SENIOR_VET:
--     PENDING -> CONFIRMED | CANCELLED
--     CONFIRMED -> CHECKED_IN | CANCELLED | NO_SHOW
--     CHECKED_IN -> IN_CONSULTATION
--     IN_CONSULTATION -> COMPLETED
-- Confirming a PENDING appointment is the veterinarian-acceptance step.
-- Staff and Senior Vet may both confirm, including when the slot requires
-- veterinarian acceptance. Skipping PENDING straight to a later status is rejected.

create table if not exists public.appointment_status_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id),
  previous_status public.appointment_status not null,
  new_status public.appointment_status not null,
  actor_id uuid references public.profiles (id),
  actor_role public.user_role not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint appointment_status_events_reason_len check (reason is null or char_length(reason) <= 500),
  constraint appointment_status_events_status_changed check (previous_status <> new_status)
);

create index if not exists appointment_status_events_appointment_id_idx
  on public.appointment_status_events (appointment_id, created_at);

alter table public.appointment_status_events enable row level security;

drop policy if exists "appointment_status_events_select_staff" on public.appointment_status_events;
create policy "appointment_status_events_select_staff"
  on public.appointment_status_events
  for select
  to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

revoke all on public.appointment_status_events from public, anon, authenticated;
grant select on public.appointment_status_events to authenticated;

-- Status changes on a row that already occupies a slot are not new bookings.
-- Inserts, and any future reactivation out of CANCELLED, still enforce capacity.
create or replace function public.enforce_appointment_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  slot_row public.appointment_slots%rowtype;
  booked int;
begin
  if tg_op = 'UPDATE'
     and old.slot_id is not distinct from new.slot_id
     and old.status <> 'CANCELLED' then
    return new;
  end if;

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

create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.appointment_status_transition', true) is distinct from 'on' then
    raise exception 'Not authorized';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_enforce_status_transition on public.appointments;
create trigger appointments_enforce_status_transition
  before update on public.appointments
  for each row execute function public.enforce_appointment_status_transition();

revoke all on function public.enforce_appointment_status_transition() from public, anon, authenticated;

create or replace function public.transition_appointment_status(
  p_appointment_id uuid,
  p_next_status public.appointment_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_appt public.appointments%rowtype;
  v_reason text;
  v_allowed boolean := false;
begin
  v_role := public.current_user_role();
  if v_role is null or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select * into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_role = 'CLIENT' then
    if v_appt.client_id is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    v_allowed := v_appt.status = 'PENDING' and p_next_status = 'CANCELLED';
    v_reason := 'Cancelled by client';
  elsif v_role in ('STAFF', 'SENIOR_VET') then
    v_allowed :=
      (v_appt.status = 'PENDING' and p_next_status in ('CONFIRMED', 'CANCELLED'))
      or (v_appt.status = 'CONFIRMED' and p_next_status in ('CHECKED_IN', 'CANCELLED', 'NO_SHOW'))
      or (v_appt.status = 'CHECKED_IN' and p_next_status = 'IN_CONSULTATION')
      or (v_appt.status = 'IN_CONSULTATION' and p_next_status = 'COMPLETED');

    if p_next_status = 'CANCELLED' then
      v_reason := nullif(btrim(coalesce(p_reason, '')), '');
      if v_reason is not null and char_length(v_reason) > 500 then
        raise exception 'Invalid reason';
      end if;
    else
      v_reason := null;
    end if;
  else
    raise exception 'Not authorized';
  end if;

  if not v_allowed then
    raise exception 'Invalid status transition';
  end if;

  perform set_config('app.appointment_status_transition', 'on', true);

  update public.appointments
  set status = p_next_status
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  perform set_config('app.appointment_status_transition', 'off', true);

  insert into public.appointment_status_events (
    appointment_id,
    previous_status,
    new_status,
    actor_id,
    actor_role,
    reason
  ) values (
    p_appointment_id,
    v_appt.status,
    p_next_status,
    auth.uid(),
    v_role,
    v_reason
  );

  return jsonb_build_object(
    'appointment_id', p_appointment_id,
    'previous_status', v_appt.status,
    'new_status', p_next_status
  );
end;
$$;

revoke all on function public.transition_appointment_status(uuid, public.appointment_status, text) from public, anon;
grant execute on function public.transition_appointment_status(uuid, public.appointment_status, text) to authenticated;

-- Existing completion entry point. Completion is now only IN_CONSULTATION -> COMPLETED.
create or replace function public.mark_appointment_completed(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.transition_appointment_status(p_appointment_id, 'COMPLETED', null);
end;
$$;

revoke all on function public.mark_appointment_completed(uuid) from public, anon;
grant execute on function public.mark_appointment_completed(uuid) to authenticated;
