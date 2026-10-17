-- Editable reschedule SMS template, staff access to reminder templates, and staff service management.

insert into public.sms_templates (template_key, body)
values (
  'reschedule_notification',
  'Good day! [Pet Name]''s [Service] appointment at [Clinic Name] has been rescheduled to [Date] at [Time].'
)
on conflict (template_key) do nothing;

create or replace function public.render_sms_template_body(
  p_body text,
  p_pet_name text,
  p_service_name text,
  p_clinic_name text,
  p_date_label text,
  p_time_label text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  result text := p_body;
begin
  result := replace(result, '[Pet Name]', E'\x01PET\x01');
  result := replace(result, '[Service]', E'\x01SVC\x01');
  result := replace(result, '[Clinic Name]', E'\x01CLINIC\x01');
  result := replace(result, '[Date]', E'\x01DATE\x01');
  result := replace(result, '[Time]', E'\x01TIME\x01');
  result := replace(result, E'\x01PET\x01', coalesce(p_pet_name, ''));
  result := replace(result, E'\x01SVC\x01', coalesce(p_service_name, ''));
  result := replace(result, E'\x01CLINIC\x01', coalesce(p_clinic_name, ''));
  result := replace(result, E'\x01DATE\x01', coalesce(p_date_label, ''));
  result := replace(result, E'\x01TIME\x01', coalesce(p_time_label, ''));
  return result;
end;
$$;

revoke all on function public.render_sms_template_body(text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.get_sms_reminder_template()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if not public.is_service_role() and public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  select body into v_body
  from public.sms_templates
  where template_key = 'appointment_reminder';
  return v_body;
end;
$$;

create or replace function public.update_sms_reminder_template(p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  if not public.sms_template_body_valid(p_body) then
    raise exception 'Invalid reminder template';
  end if;
  update public.sms_templates
  set body = p_body,
      updated_by = auth.uid(),
      updated_at = now()
  where template_key = 'appointment_reminder';
  if not found then
    raise exception 'Reminder template is not configured';
  end if;
  return p_body;
end;
$$;

create or replace function public.get_sms_reschedule_template()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if not public.is_service_role() and public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  select body into v_body
  from public.sms_templates
  where template_key = 'reschedule_notification';
  return v_body;
end;
$$;

revoke all on function public.get_sms_reschedule_template() from public, anon;
grant execute on function public.get_sms_reschedule_template() to authenticated, service_role;

create or replace function public.update_sms_reschedule_template(p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  if not public.sms_template_body_valid(p_body) then
    raise exception 'Invalid reminder template';
  end if;
  update public.sms_templates
  set body = p_body,
      updated_by = auth.uid(),
      updated_at = now()
  where template_key = 'reschedule_notification';
  if not found then
    raise exception 'Reschedule template is not configured';
  end if;
  return p_body;
end;
$$;

revoke all on function public.update_sms_reschedule_template(text) from public, anon;
grant execute on function public.update_sms_reschedule_template(text) to authenticated;

create or replace function public._apply_appointment_reschedule(
  p_appointment_id uuid,
  p_new_slot_id uuid,
  p_request_id uuid,
  p_reason text,
  p_clinic_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_appt public.appointments%rowtype;
  v_old_slot public.appointment_slots%rowtype;
  v_new_slot public.appointment_slots%rowtype;
  v_pet public.pets%rowtype;
  v_svc public.services%rowtype;
  v_now timestamp;
  v_booked integer;
  v_version integer;
  v_reason text;
  v_phone text;
  v_content text;
  v_sms_status public.sms_status := 'PENDING';
  v_class public.sms_failure_class := 'none';
  v_error text;
  v_sms_id uuid;
  v_clinic text;
  v_template text;
  v_date_label text;
  v_time_label text;
begin
  v_role := public.current_user_role();
  if v_role not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Invalid reason';
  end if;

  v_now := timezone('Asia/Manila', now());
  v_clinic := btrim(coalesce(p_clinic_name, ''));

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_appt.status not in ('PENDING', 'CONFIRMED') then
    raise exception 'Appointment cannot be rescheduled';
  end if;
  if p_new_slot_id = v_appt.slot_id then
    raise exception 'Choose a different time slot';
  end if;

  if v_appt.slot_id < p_new_slot_id then
    select * into v_old_slot from public.appointment_slots where id = v_appt.slot_id for update;
    select * into v_new_slot from public.appointment_slots where id = p_new_slot_id for update;
  else
    select * into v_new_slot from public.appointment_slots where id = p_new_slot_id for update;
    select * into v_old_slot from public.appointment_slots where id = v_appt.slot_id for update;
  end if;

  if v_new_slot.id is null then
    raise exception 'Invalid slot';
  end if;

  select * into v_pet from public.pets where id = v_appt.pet_id;
  if not found or v_pet.owner_id <> v_appt.client_id or v_pet.is_archived then
    raise exception 'Invalid pet';
  end if;

  select * into v_svc from public.services where id = v_appt.service_id;
  if not found or not v_svc.is_active or not v_svc.is_bookable then
    raise exception 'Service is not available for booking';
  end if;

  if v_svc.requires_veterinarian then
    if v_new_slot.veterinarian_id is null then
      raise exception 'This service requires a veterinarian slot';
    end if;
  else
    if v_new_slot.veterinarian_id is not null then
      raise exception 'This service uses clinic-wide slots';
    end if;
  end if;

  if v_new_slot.is_blocked or public.is_date_blocked(v_new_slot.slot_date, v_new_slot.veterinarian_id) then
    raise exception 'This slot is not available';
  end if;

  if v_new_slot.slot_date > (v_now::date + 60) then
    raise exception 'Outside booking window';
  end if;

  if (v_new_slot.slot_date + v_new_slot.start_time) <= v_now then
    raise exception 'That time has passed';
  end if;

  select count(*)::int into v_booked
  from public.appointments a
  where a.slot_id = v_new_slot.id
    and a.status <> 'CANCELLED'
    and a.id <> v_appt.id;

  if v_booked >= v_new_slot.capacity then
    raise exception 'This time slot is full';
  end if;

  update public.appointments
  set slot_id = v_new_slot.id,
      schedule_version = schedule_version + 1,
      over_capacity = false
  where id = v_appt.id
  returning schedule_version into v_version;

  update public.sms_messages
  set status = 'CANCELLED',
      error_detail = 'Superseded by reschedule'
  where appointment_id = v_appt.id
    and message_type = 'APPOINTMENT_REMINDER'
    and schedule_version < v_version
    and status = 'PENDING'
    and reference_id is null
    and outcome_uncertain = false;

  update public.reschedule_requests
  set status = 'REJECTED',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = 'The appointment was rescheduled by staff before this request was reviewed.'
  where appointment_id = v_appt.id
    and status = 'PENDING'
    and (p_request_id is null or id <> p_request_id);

  insert into public.appointment_reschedule_events (
    appointment_id,
    request_id,
    actor_id,
    actor_role,
    previous_slot_id,
    new_slot_id,
    previous_schedule_version,
    new_schedule_version,
    previous_status,
    new_status,
    reason
  ) values (
    v_appt.id,
    p_request_id,
    auth.uid(),
    v_role,
    v_old_slot.id,
    v_new_slot.id,
    v_appt.schedule_version,
    v_version,
    v_appt.status,
    v_appt.status,
    v_reason
  );

  select contact_number into v_phone from public.profiles where id = v_appt.client_id;
  v_phone := public.normalize_ph_mobile(v_phone);

  if v_clinic = '' then
    v_content := 'Reschedule notification was not sent because the clinic name is not configured.';
    v_sms_status := 'FAILED';
    v_class := 'config';
    v_error := 'Clinic name is not configured.';
    v_phone := coalesce(v_phone, 'invalid');
  elsif v_phone is null then
    v_content := 'Reschedule notification was not sent because the client has no valid mobile number.';
    v_sms_status := 'FAILED';
    v_class := 'validation';
    v_error := 'Client mobile number is missing or invalid.';
    v_phone := 'invalid';
  else
    select body into v_template
    from public.sms_templates
    where template_key = 'reschedule_notification';
    v_date_label := to_char(v_new_slot.slot_date, 'FMMonth FMDD, YYYY');
    v_time_label := to_char(v_new_slot.start_time, 'FMHH12:MI AM');
    if v_template is null or not public.sms_template_body_valid(v_template) then
      v_content := 'Reschedule notification was not sent because the message template is not configured.';
      v_sms_status := 'FAILED';
      v_class := 'config';
      v_error := 'Reschedule template is missing or invalid.';
    else
      v_content := public.render_sms_template_body(
        v_template,
        v_pet.name,
        v_svc.name,
        v_clinic,
        v_date_label,
        v_time_label
      );
      if char_length(btrim(v_content)) < 1 or char_length(v_content) > 670 then
        v_content := 'Reschedule notification was not sent because the rendered message is too long.';
        v_sms_status := 'FAILED';
        v_class := 'validation';
        v_error := 'Rendered reschedule message exceeds 670 characters.';
      end if;
    end if;
  end if;

  insert into public.sms_messages (
    appointment_id,
    client_id,
    recipient_phone,
    content,
    message_type,
    schedule_version,
    status,
    failure_class,
    error_detail
  ) values (
    v_appt.id,
    v_appt.client_id,
    v_phone,
    v_content,
    'RESCHEDULE_NOTIFICATION',
    v_version,
    v_sms_status,
    v_class,
    v_error
  )
  returning id into v_sms_id;

  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'schedule_version', v_version,
    'previous_status', v_appt.status,
    'new_status', v_appt.status,
    'sms_message_id', v_sms_id,
    'sms_status', v_sms_status
  );
end;
$$;

revoke all on function public._apply_appointment_reschedule(uuid, uuid, uuid, text, text) from public, anon, authenticated;

drop policy if exists "services_manage_senior_vet" on public.services;
drop policy if exists "services_manage_staff" on public.services;
create policy "services_manage_staff"
  on public.services for all to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'))
  with check (public.current_user_role() in ('STAFF', 'SENIOR_VET'));
