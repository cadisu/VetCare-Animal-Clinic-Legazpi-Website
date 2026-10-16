-- Phase 5: SMS appointment reminders, SMS status tracking, and rescheduling.
-- Apply after 20261015000000_phase4_appointment_status_workflow.sql.
-- Does not change booking RPCs, transition_appointment_status, or mark_appointment_completed.
-- Rescheduling changes slot_id and schedule_version only. It is not a status transition.

alter table public.appointments
  add column schedule_version integer not null default 1;

alter table public.appointments
  add constraint appointments_schedule_version_positive check (schedule_version >= 1);

create type public.sms_message_type as enum ('APPOINTMENT_REMINDER', 'RESCHEDULE_NOTIFICATION');
create type public.sms_status as enum ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED');
create type public.sms_failure_class as enum ('none', 'config', 'validation', 'transient', 'uncertain');
create type public.reschedule_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

create table public.sms_templates (
  template_key text primary key,
  body text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint sms_templates_body_len check (char_length(body) between 1 and 670)
);

insert into public.sms_templates (template_key, body)
values (
  'appointment_reminder',
  'Good day! This is a reminder that [Pet Name] has a [Service] appointment at [Clinic Name] on [Date] at [Time]. Please contact us if you need to reschedule.'
);

create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  recipient_phone text not null,
  content text not null,
  message_type public.sms_message_type not null,
  schedule_version integer not null,
  status public.sms_status not null default 'PENDING',
  provider text not null default 'unisms',
  reference_id text,
  provider_status text,
  fail_reason text,
  provider_response jsonb,
  last_webhook_id text,
  error_detail text,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  outcome_uncertain boolean not null default false,
  failure_class public.sms_failure_class not null default 'none',
  attempt_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  attempt_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint sms_messages_content_len check (char_length(content) between 1 and 670),
  constraint sms_messages_phone_len check (char_length(recipient_phone) between 1 and 20),
  constraint sms_messages_schedule_version_positive check (schedule_version >= 1),
  constraint sms_messages_retry_count_nonnegative check (retry_count >= 0),
  constraint sms_messages_provider_status_known check (
    provider_status is null or provider_status in ('pending', 'retrying', 'sent', 'failed')
  ),
  constraint sms_messages_provider_name check (provider = 'unisms'),
  constraint sms_messages_appointment_schedule_type_key unique (appointment_id, schedule_version, message_type)
);

create unique index sms_messages_reference_id_idx
  on public.sms_messages (reference_id)
  where reference_id is not null;

create index sms_messages_status_retry_idx
  on public.sms_messages (status, next_retry_at);

create index sms_messages_client_id_idx
  on public.sms_messages (client_id, created_at desc);

drop trigger if exists sms_messages_set_updated_at on public.sms_messages;
create trigger sms_messages_set_updated_at
  before update on public.sms_messages
  for each row execute function public.set_updated_at();

create table public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  requested_slot_id uuid not null references public.appointment_slots (id) on delete restrict,
  previous_slot_id uuid not null references public.appointment_slots (id) on delete restrict,
  status public.reschedule_request_status not null default 'PENDING',
  reason text,
  requested_by uuid not null references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint reschedule_requests_reason_len check (reason is null or char_length(reason) <= 500),
  constraint reschedule_requests_note_len check (review_note is null or char_length(review_note) <= 500),
  constraint reschedule_requests_slot_changed check (requested_slot_id <> previous_slot_id)
);

create unique index reschedule_requests_one_pending_idx
  on public.reschedule_requests (appointment_id)
  where status = 'PENDING';

create index reschedule_requests_appointment_idx
  on public.reschedule_requests (appointment_id, created_at desc);

create table public.appointment_reschedule_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  request_id uuid references public.reschedule_requests (id) on delete restrict,
  actor_id uuid references public.profiles (id),
  actor_role public.user_role not null,
  previous_slot_id uuid not null references public.appointment_slots (id) on delete restrict,
  new_slot_id uuid not null references public.appointment_slots (id) on delete restrict,
  previous_schedule_version integer not null,
  new_schedule_version integer not null,
  previous_status public.appointment_status not null,
  new_status public.appointment_status not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint appointment_reschedule_events_reason_len check (reason is null or char_length(reason) <= 500),
  constraint appointment_reschedule_events_version_advanced check (new_schedule_version = previous_schedule_version + 1),
  constraint appointment_reschedule_events_status_unchanged check (previous_status = new_status)
);

create index appointment_reschedule_events_appointment_idx
  on public.appointment_reschedule_events (appointment_id, created_at desc);

alter table public.sms_templates enable row level security;
alter table public.sms_messages enable row level security;
alter table public.reschedule_requests enable row level security;
alter table public.appointment_reschedule_events enable row level security;

revoke all on public.sms_templates from public, anon, authenticated;
revoke all on public.sms_messages from public, anon, authenticated;
revoke all on public.reschedule_requests from public, anon, authenticated;
revoke all on public.appointment_reschedule_events from public, anon, authenticated;

grant select, insert, update, delete on public.sms_templates to service_role;
grant select, insert, update, delete on public.sms_messages to service_role;
grant select, insert, update, delete on public.reschedule_requests to service_role;
grant select, insert, update, delete on public.appointment_reschedule_events to service_role;

-- Authenticated users reach these tables only through the RPCs below.
-- Policies still deny direct writes if a grant is added later by mistake.

drop policy if exists "sms_messages_select_own_or_staff" on public.sms_messages;
create policy "sms_messages_select_own_or_staff"
  on public.sms_messages
  for select
  to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (
      public.current_user_role() = 'CLIENT'
      and client_id = auth.uid()
    )
  );

drop policy if exists "reschedule_requests_select_own_or_staff" on public.reschedule_requests;
create policy "reschedule_requests_select_own_or_staff"
  on public.reschedule_requests
  for select
  to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (
      public.current_user_role() = 'CLIENT'
      and requested_by = auth.uid()
    )
  );

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

revoke all on function public.is_service_role() from public, anon, authenticated;

create or replace function public.sms_template_body_valid(p_body text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  stripped text;
begin
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 670 then
    return false;
  end if;
  if position('[Pet Name]' in p_body) = 0 then return false; end if;
  if position('[Service]' in p_body) = 0 then return false; end if;
  if position('[Clinic Name]' in p_body) = 0 then return false; end if;
  if position('[Date]' in p_body) = 0 then return false; end if;
  if position('[Time]' in p_body) = 0 then return false; end if;
  stripped := replace(p_body, '[Pet Name]', '');
  stripped := replace(stripped, '[Service]', '');
  stripped := replace(stripped, '[Clinic Name]', '');
  stripped := replace(stripped, '[Date]', '');
  stripped := replace(stripped, '[Time]', '');
  if stripped ~ '\[[^]]*\]' then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.sms_template_body_valid(text) from public, anon, authenticated;

create or replace function public.normalize_ph_mobile(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  v := regexp_replace(coalesce(p_phone, ''), '[[:space:]-]', '', 'g');
  if v ~ '^\+639[0-9]{9}$' then
    return v;
  elsif v ~ '^639[0-9]{9}$' then
    return '+' || v;
  elsif v ~ '^09[0-9]{9}$' then
    return '+63' || substring(v from 2);
  end if;
  return null;
end;
$$;

revoke all on function public.normalize_ph_mobile(text) from public, anon, authenticated;

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
  if not public.is_service_role() and public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Not authorized';
  end if;
  select body into v_body
  from public.sms_templates
  where template_key = 'appointment_reminder';
  return v_body;
end;
$$;

revoke all on function public.get_sms_reminder_template() from public, anon;
grant execute on function public.get_sms_reminder_template() to authenticated, service_role;

create or replace function public.update_sms_reminder_template(p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'SENIOR_VET' or auth.uid() is null then
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

revoke all on function public.update_sms_reminder_template(text) from public, anon;
grant execute on function public.update_sms_reminder_template(text) to authenticated;

create or replace function public.list_reminder_candidates(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'appointment_id', a.id,
      'client_id', a.client_id,
      'status', a.status,
      'schedule_version', a.schedule_version,
      'pet_name', p.name,
      'service_name', s.name,
      'slot_date', to_char(sl.slot_date, 'YYYY-MM-DD'),
      'start_time', to_char(sl.start_time, 'HH24:MI:SS'),
      'requires_vet_acceptance', sl.requires_vet_acceptance,
      'contact_number', pr.contact_number,
      'sms_id', sm.id,
      'sms_status', sm.status,
      'failure_class', sm.failure_class
    ))
    from public.appointments a
    join public.appointment_slots sl on sl.id = a.slot_id
    join public.pets p on p.id = a.pet_id and p.owner_id = a.client_id
    join public.services s on s.id = a.service_id
    join public.profiles pr on pr.id = a.client_id
    left join public.sms_messages sm
      on sm.appointment_id = a.id
     and sm.schedule_version = a.schedule_version
     and sm.message_type = 'APPOINTMENT_REMINDER'
    where sl.slot_date = p_target_date
      and a.status in ('PENDING', 'CONFIRMED')
      and not p.is_archived
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_reminder_candidates(date) from public, anon, authenticated;
grant execute on function public.list_reminder_candidates(date) to service_role;

create or replace function public.enqueue_sms_message(
  p_appointment_id uuid,
  p_message_type public.sms_message_type,
  p_content text,
  p_recipient_phone text,
  p_status public.sms_status,
  p_failure_class public.sms_failure_class,
  p_error_detail text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_id uuid;
  v_phone text;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('PENDING', 'FAILED') then
    raise exception 'Invalid SMS status';
  end if;
  if char_length(coalesce(p_content, '')) < 1 or char_length(p_content) > 670 then
    raise exception 'Invalid SMS content';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;

  v_phone := coalesce(public.normalize_ph_mobile(p_recipient_phone), left(nullif(btrim(coalesce(p_recipient_phone, '')), ''), 20), 'invalid');

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
  )
  values (
    v_appt.id,
    v_appt.client_id,
    v_phone,
    p_content,
    p_message_type,
    v_appt.schedule_version,
    p_status,
    p_failure_class,
    p_error_detail
  )
  on conflict (appointment_id, schedule_version, message_type)
  do update set
    content = excluded.content,
    recipient_phone = excluded.recipient_phone,
    status = excluded.status,
    failure_class = excluded.failure_class,
    error_detail = excluded.error_detail,
    outcome_uncertain = false,
    next_retry_at = null
  where public.sms_messages.status = 'FAILED'
    and public.sms_messages.failure_class = 'config'
    and public.sms_messages.reference_id is null
    and public.sms_messages.outcome_uncertain = false
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enqueue_sms_message(uuid, public.sms_message_type, text, text, public.sms_status, public.sms_failure_class, text) from public, anon, authenticated;
grant execute on function public.enqueue_sms_message(uuid, public.sms_message_type, text, text, public.sms_status, public.sms_failure_class, text) to service_role;

create or replace function public.list_due_sms_ids(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;
  v_now := timezone('Asia/Manila', now());
  return coalesce((
    select jsonb_agg(sm.id)
    from public.sms_messages sm
    join public.appointments a on a.id = sm.appointment_id
    join public.appointment_slots sl on sl.id = a.slot_id
    join public.pets p on p.id = a.pet_id and p.owner_id = a.client_id
    where a.status in ('PENDING', 'CONFIRMED')
      and not p.is_archived
      and sm.schedule_version = a.schedule_version
      and sm.outcome_uncertain = false
      and (sl.slot_date + sl.start_time) > v_now
      and (
        (
          sm.message_type = 'APPOINTMENT_REMINDER'
          and sm.status = 'PENDING'
          and sl.slot_date <= p_target_date
        )
        or (
          sm.status = 'FAILED'
          and sm.failure_class = 'config'
        )
        or (
          sm.status = 'FAILED'
          and sm.failure_class = 'transient'
          and sm.provider_status is distinct from 'failed'
          and sm.retry_count < 3
          and (sm.next_retry_at is null or sm.next_retry_at <= now())
        )
        or (
          sm.message_type = 'RESCHEDULE_NOTIFICATION'
          and sm.status = 'PENDING'
        )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_due_sms_ids(date) from public, anon, authenticated;
grant execute on function public.list_due_sms_ids(date) to service_role;

create or replace function public.list_sms_to_reconcile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sm.id,
      'reference_id', sm.reference_id
    ))
    from public.sms_messages sm
    where sm.status = 'QUEUED'
      and sm.reference_id is not null
      and sm.provider_status in ('pending', 'retrying')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_sms_to_reconcile() from public, anon, authenticated;
grant execute on function public.list_sms_to_reconcile() to service_role;

create or replace function public.claim_sms_for_delivery(p_sms_id uuid, p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sms public.sms_messages%rowtype;
  v_appt public.appointments%rowtype;
  v_slot public.appointment_slots%rowtype;
  v_now timestamp;
  v_claimed public.sms_messages%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;

  v_now := timezone('Asia/Manila', now());

  select * into v_sms from public.sms_messages where id = p_sms_id for update;
  if not found then
    return jsonb_build_object('skipped', true);
  end if;

  select * into v_appt from public.appointments where id = v_sms.appointment_id for update;
  select * into v_slot from public.appointment_slots where id = v_appt.slot_id;

  if v_appt.schedule_version is distinct from v_sms.schedule_version
     or v_appt.status not in ('PENDING', 'CONFIRMED')
     or (v_slot.slot_date + v_slot.start_time) <= v_now
     or v_sms.outcome_uncertain then
    update public.sms_messages
    set status = 'CANCELLED',
        error_detail = 'Superseded or no longer eligible'
    where id = v_sms.id
      and status in ('PENDING', 'FAILED')
      and reference_id is null;
    return jsonb_build_object('cancelled', true);
  end if;

  if v_sms.message_type = 'APPOINTMENT_REMINDER'
     and v_sms.status = 'PENDING'
     and v_slot.slot_date > p_target_date then
    return jsonb_build_object('skipped', true);
  end if;

  if v_sms.reference_id is not null then
    return jsonb_build_object('skipped', true);
  end if;

  if v_sms.status = 'QUEUED' or v_sms.status in ('SENT', 'CANCELLED') then
    return jsonb_build_object('skipped', true);
  end if;

  if not (
    v_sms.status = 'PENDING'
    or (v_sms.status = 'FAILED' and v_sms.failure_class = 'config')
    or (
      v_sms.status = 'FAILED'
      and v_sms.failure_class = 'transient'
      and v_sms.provider_status is distinct from 'failed'
      and v_sms.retry_count < 3
      and (v_sms.next_retry_at is null or v_sms.next_retry_at <= now())
    )
  ) then
    return jsonb_build_object('skipped', true);
  end if;

  update public.sms_messages
  set status = 'QUEUED',
      attempt_at = now(),
      failure_class = 'none',
      error_detail = null,
      next_retry_at = null
  where id = v_sms.id
    and status = v_sms.status
  returning * into v_claimed;

  if v_claimed.id is null then
    return jsonb_build_object('skipped', true);
  end if;

  return jsonb_build_object(
    'id', v_claimed.id,
    'appointment_id', v_claimed.appointment_id,
    'content', v_claimed.content,
    'recipient_phone', v_claimed.recipient_phone,
    'message_type', v_claimed.message_type,
    'schedule_version', v_claimed.schedule_version,
    'retry_count', v_claimed.retry_count,
    'reference_id', v_claimed.reference_id
  );
end;
$$;

revoke all on function public.claim_sms_for_delivery(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_sms_for_delivery(uuid, date) to service_role;

create or replace function public.assert_sms_current(p_sms_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sms public.sms_messages%rowtype;
  v_version integer;
  v_status public.appointment_status;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;

  select * into v_sms from public.sms_messages where id = p_sms_id for update;
  if not found or v_sms.status <> 'QUEUED' or v_sms.reference_id is not null then
    return false;
  end if;

  select schedule_version, status into v_version, v_status
  from public.appointments
  where id = v_sms.appointment_id;

  if v_version is distinct from v_sms.schedule_version or v_status not in ('PENDING', 'CONFIRMED') then
    update public.sms_messages
    set status = 'CANCELLED',
        error_detail = 'Superseded before send'
    where id = v_sms.id
      and status = 'QUEUED'
      and reference_id is null;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.assert_sms_current(uuid) from public, anon, authenticated;
grant execute on function public.assert_sms_current(uuid) to service_role;

-- Used only after GET /sms/:reference_id confirms the previous attempt failed.
create or replace function public.clear_failed_sms_reference(p_sms_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sms public.sms_messages%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;

  select * into v_sms from public.sms_messages where id = p_sms_id for update;
  if not found or v_sms.status <> 'QUEUED' or v_sms.reference_id is null then
    return false;
  end if;
  if v_sms.provider_status is distinct from 'failed' then
    return false;
  end if;

  update public.sms_messages
  set reference_id = null,
      provider_status = null,
      attempt_log = attempt_log || jsonb_build_array(jsonb_build_object(
        'at', now(),
        'cleared_reference_id', v_sms.reference_id,
        'reason', 'manual retry after provider failed'
      ))
  where id = v_sms.id
    and status = 'QUEUED';

  return true;
end;
$$;

revoke all on function public.clear_failed_sms_reference(uuid) from public, anon, authenticated;
grant execute on function public.clear_failed_sms_reference(uuid) to service_role;

create or replace function public.record_sms_provider_result(p_sms_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sms public.sms_messages%rowtype;
  v_status text;
  v_provider text;
  v_class text;
  v_reference text;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;

  select * into v_sms from public.sms_messages where id = p_sms_id for update;
  if not found then
    return jsonb_build_object('ignored', true);
  end if;

  -- A webhook may already have stored a final status. Do not regress it.
  if v_sms.status in ('SENT', 'CANCELLED', 'FAILED') and v_sms.status <> 'QUEUED' then
    if v_sms.status = 'SENT' or v_sms.status = 'CANCELLED' then
      return jsonb_build_object('ignored', true, 'status', v_sms.status);
    end if;
  end if;
  if v_sms.status <> 'QUEUED' then
    return jsonb_build_object('ignored', true, 'status', v_sms.status);
  end if;

  v_status := p_result->>'internal_status';
  v_provider := nullif(p_result->>'provider_status', '');
  v_class := coalesce(nullif(p_result->>'failure_class', ''), 'none');
  v_reference := nullif(p_result->>'reference_id', '');

  if v_status not in ('QUEUED', 'SENT', 'FAILED', 'CANCELLED') then
    raise exception 'Invalid SMS status';
  end if;
  if v_provider is not null and v_provider not in ('pending', 'retrying', 'sent', 'failed') then
    raise exception 'Invalid provider status';
  end if;
  if v_class not in ('none', 'config', 'validation', 'transient', 'uncertain') then
    raise exception 'Invalid failure class';
  end if;

  update public.sms_messages
  set status = v_status::public.sms_status,
      provider_status = v_provider,
      reference_id = coalesce(v_reference, reference_id),
      fail_reason = nullif(p_result->>'fail_reason', ''),
      provider_response = p_result->'provider_response',
      error_detail = nullif(p_result->>'error_detail', ''),
      failure_class = v_class::public.sms_failure_class,
      outcome_uncertain = coalesce((p_result->>'outcome_uncertain')::boolean, false),
      retry_count = coalesce((p_result->>'retry_count')::integer, retry_count),
      next_retry_at = case
        when nullif(p_result->>'next_retry_at', '') is null then null
        else (p_result->>'next_retry_at')::timestamptz
      end,
      sent_at = case when v_status = 'SENT' then coalesce(sent_at, now()) else sent_at end,
      attempt_log = attempt_log || jsonb_build_array(jsonb_build_object(
        'at', now(),
        'internal_status', v_status,
        'provider_status', v_provider,
        'failure_class', v_class,
        'reference_id', v_reference
      ))
  where id = v_sms.id
    and status = 'QUEUED';

  return jsonb_build_object('updated', true, 'status', v_status);
end;
$$;

revoke all on function public.record_sms_provider_result(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_sms_provider_result(uuid, jsonb) to service_role;

create or replace function public.apply_sms_provider_event(
  p_reference_id text,
  p_event text,
  p_provider_status text,
  p_fail_reason text,
  p_webhook_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sms public.sms_messages%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Not authorized';
  end if;
  if p_reference_id is null or btrim(p_reference_id) = '' then
    return jsonb_build_object('matched', false);
  end if;

  select * into v_sms
  from public.sms_messages
  where reference_id = p_reference_id
  for update;

  if not found then
    return jsonb_build_object('matched', false);
  end if;

  if p_webhook_id is not null and p_webhook_id <> '' and v_sms.last_webhook_id is not distinct from p_webhook_id then
    return jsonb_build_object('matched', true, 'duplicate', true);
  end if;

  if p_event = 'message.sent' and p_provider_status is not null and p_provider_status <> 'sent' then
    return jsonb_build_object('matched', true, 'ignored', true);
  elsif p_event = 'message.failed' and p_provider_status is not null and p_provider_status <> 'failed' then
    return jsonb_build_object('matched', true, 'ignored', true);
  elsif p_event = 'message.retrying' and p_provider_status is not null and p_provider_status <> 'retrying' then
    return jsonb_build_object('matched', true, 'ignored', true);
  end if;

  if p_event = 'message.sent' then
    if v_sms.status = 'CANCELLED' then
      return jsonb_build_object('matched', true, 'ignored', true);
    end if;
    if v_sms.provider_status = 'sent' and v_sms.status = 'SENT' then
      update public.sms_messages set last_webhook_id = coalesce(p_webhook_id, last_webhook_id) where id = v_sms.id;
      return jsonb_build_object('matched', true, 'duplicate', true);
    end if;
    update public.sms_messages
    set status = 'SENT',
        provider_status = 'sent',
        fail_reason = null,
        failure_class = 'none',
        outcome_uncertain = false,
        error_detail = null,
        sent_at = coalesce(sent_at, now()),
        last_webhook_id = coalesce(p_webhook_id, last_webhook_id),
        provider_response = p_payload
    where id = v_sms.id;
    return jsonb_build_object('matched', true, 'status', 'SENT');
  elsif p_event = 'message.failed' then
    if v_sms.status = 'SENT' or v_sms.provider_status = 'sent' or v_sms.status = 'CANCELLED' then
      return jsonb_build_object('matched', true, 'ignored', true);
    end if;
    if v_sms.status = 'FAILED' and v_sms.provider_status = 'failed' then
      update public.sms_messages
      set last_webhook_id = coalesce(p_webhook_id, last_webhook_id),
          fail_reason = coalesce(nullif(p_fail_reason, ''), fail_reason)
      where id = v_sms.id;
      return jsonb_build_object('matched', true, 'duplicate', true);
    end if;
    update public.sms_messages
    set status = 'FAILED',
        provider_status = 'failed',
        fail_reason = nullif(p_fail_reason, ''),
        failure_class = 'transient',
        outcome_uncertain = false,
        error_detail = nullif(p_fail_reason, ''),
        last_webhook_id = coalesce(p_webhook_id, last_webhook_id),
        provider_response = p_payload
    where id = v_sms.id;
    return jsonb_build_object('matched', true, 'status', 'FAILED');
  elsif p_event = 'message.retrying' then
    if v_sms.status in ('SENT', 'FAILED', 'CANCELLED') or v_sms.provider_status in ('sent', 'failed') then
      return jsonb_build_object('matched', true, 'ignored', true);
    end if;
    update public.sms_messages
    set status = 'QUEUED',
        provider_status = 'retrying',
        last_webhook_id = coalesce(p_webhook_id, last_webhook_id),
        provider_response = p_payload,
        outcome_uncertain = false
    where id = v_sms.id;
    return jsonb_build_object('matched', true, 'status', 'QUEUED');
  else
    return jsonb_build_object('matched', true, 'ignored', true);
  end if;
end;
$$;

revoke all on function public.apply_sms_provider_event(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_sms_provider_event(text, text, text, text, text, jsonb) to service_role;

create or replace function public.claim_sms_manual_retry(p_sms_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_sms public.sms_messages%rowtype;
  v_appt public.appointments%rowtype;
  v_slot public.appointment_slots%rowtype;
  v_now timestamp;
  v_claimed public.sms_messages%rowtype;
begin
  v_role := public.current_user_role();
  if v_role not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  v_now := timezone('Asia/Manila', now());

  select * into v_sms from public.sms_messages where id = p_sms_id for update;
  if not found then
    raise exception 'Message not found';
  end if;

  select * into v_appt from public.appointments where id = v_sms.appointment_id for update;
  select * into v_slot from public.appointment_slots where id = v_appt.slot_id;

  if v_sms.outcome_uncertain then
    raise exception 'This message outcome is uncertain and cannot be resent';
  end if;
  if v_sms.status <> 'FAILED' or v_sms.failure_class not in ('config', 'transient') then
    raise exception 'This message cannot be retried';
  end if;
  if v_sms.provider_status in ('pending', 'retrying', 'sent') then
    raise exception 'This message cannot be retried';
  end if;
  if v_appt.schedule_version is distinct from v_sms.schedule_version
     or v_appt.status not in ('PENDING', 'CONFIRMED')
     or (v_slot.slot_date + v_slot.start_time) <= v_now then
    raise exception 'This message cannot be retried';
  end if;

  update public.sms_messages
  set status = 'QUEUED',
      attempt_at = now(),
      failure_class = 'none',
      error_detail = null,
      next_retry_at = null
  where id = v_sms.id
    and status = 'FAILED'
  returning * into v_claimed;

  if v_claimed.id is null then
    raise exception 'This message cannot be retried';
  end if;

  return jsonb_build_object(
    'id', v_claimed.id,
    'appointment_id', v_claimed.appointment_id,
    'content', v_claimed.content,
    'recipient_phone', v_claimed.recipient_phone,
    'message_type', v_claimed.message_type,
    'schedule_version', v_claimed.schedule_version,
    'retry_count', v_claimed.retry_count,
    'reference_id', v_claimed.reference_id
  );
end;
$$;

revoke all on function public.claim_sms_manual_retry(uuid) from public, anon;
grant execute on function public.claim_sms_manual_retry(uuid) to authenticated;

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
    v_content := 'Good day! ' || v_pet.name || '''s ' || v_svc.name
      || ' appointment at ' || v_clinic
      || ' has been rescheduled to '
      || to_char(v_new_slot.slot_date, 'FMMonth FMDD, YYYY')
      || ' at '
      || to_char(v_new_slot.start_time, 'FMHH12:MI AM')
      || '.';
    if char_length(v_content) > 670 then
      v_content := 'Reschedule notification was not sent because the rendered message is too long.';
      v_sms_status := 'FAILED';
      v_class := 'validation';
      v_error := 'Rendered reschedule message exceeds 670 characters.';
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

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_slot_id uuid,
  p_reason text,
  p_clinic_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  return public._apply_appointment_reschedule(
    p_appointment_id, p_new_slot_id, null, p_reason, p_clinic_name
  );
end;
$$;

revoke all on function public.reschedule_appointment(uuid, uuid, text, text) from public, anon;
grant execute on function public.reschedule_appointment(uuid, uuid, text, text) to authenticated;

create or replace function public._assert_replacement_slot(
  p_appointment_id uuid,
  p_new_slot_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_slot public.appointment_slots%rowtype;
  v_svc public.services%rowtype;
  v_pet public.pets%rowtype;
  v_now timestamp;
  v_booked integer;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_appt.status not in ('PENDING', 'CONFIRMED') then
    raise exception 'Appointment cannot be rescheduled';
  end if;
  if p_new_slot_id = v_appt.slot_id then
    raise exception 'Choose a different time slot';
  end if;

  select * into v_slot from public.appointment_slots where id = p_new_slot_id;
  if not found then
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
    if v_slot.veterinarian_id is null then
      raise exception 'This service requires a veterinarian slot';
    end if;
  else
    if v_slot.veterinarian_id is not null then
      raise exception 'This service uses clinic-wide slots';
    end if;
  end if;

  v_now := timezone('Asia/Manila', now());
  if v_slot.is_blocked or public.is_date_blocked(v_slot.slot_date, v_slot.veterinarian_id) then
    raise exception 'This slot is not available';
  end if;
  if v_slot.slot_date > (v_now::date + 60) then
    raise exception 'Outside booking window';
  end if;
  if (v_slot.slot_date + v_slot.start_time) <= v_now then
    raise exception 'That time has passed';
  end if;

  select count(*)::int into v_booked
  from public.appointments a
  where a.slot_id = v_slot.id
    and a.status <> 'CANCELLED'
    and a.id <> v_appt.id;
  if v_booked >= v_slot.capacity then
    raise exception 'This time slot is full';
  end if;

  if exists (
    select 1
    from public.appointments a
    join public.appointment_slots s on s.id = a.slot_id
    where a.pet_id = v_appt.pet_id
      and a.id <> v_appt.id
      and a.status <> 'CANCELLED'
      and s.slot_date = v_slot.slot_date
      and s.start_time = v_slot.start_time
  ) then
    raise exception 'This pet already has an appointment at that date and time';
  end if;
end;
$$;

revoke all on function public._assert_replacement_slot(uuid, uuid) from public, anon, authenticated;

create or replace function public.submit_reschedule_request(
  p_appointment_id uuid,
  p_new_slot_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_reason text;
  v_id uuid;
begin
  if public.current_user_role() is distinct from 'CLIENT' or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Invalid reason';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found or v_appt.client_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  perform public._assert_replacement_slot(p_appointment_id, p_new_slot_id);

  begin
    insert into public.reschedule_requests (
      appointment_id,
      requested_slot_id,
      previous_slot_id,
      status,
      reason,
      requested_by
    ) values (
      v_appt.id,
      p_new_slot_id,
      v_appt.slot_id,
      'PENDING',
      v_reason,
      auth.uid()
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'A reschedule request is already pending';
  end;

  return v_id;
end;
$$;

revoke all on function public.submit_reschedule_request(uuid, uuid, text) from public, anon;
grant execute on function public.submit_reschedule_request(uuid, uuid, text) to authenticated;

create or replace function public.withdraw_reschedule_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.current_user_role() is distinct from 'CLIENT' or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  update public.reschedule_requests
  set status = 'WITHDRAWN'
  where id = p_request_id
    and requested_by = auth.uid()
    and status = 'PENDING';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'This request is no longer pending';
  end if;
end;
$$;

revoke all on function public.withdraw_reschedule_request(uuid) from public, anon;
grant execute on function public.withdraw_reschedule_request(uuid) to authenticated;

create or replace function public.approve_reschedule_request(
  p_request_id uuid,
  p_clinic_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.reschedule_requests%rowtype;
  v_result jsonb;
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select appointment_id into v_req.appointment_id
  from public.reschedule_requests
  where id = p_request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  perform 1 from public.appointments where id = v_req.appointment_id for update;

  select * into v_req from public.reschedule_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'This request is no longer pending';
  end if;

  v_result := public._apply_appointment_reschedule(
    v_req.appointment_id,
    v_req.requested_slot_id,
    v_req.id,
    v_req.reason,
    p_clinic_name
  );

  update public.reschedule_requests
  set status = 'APPROVED',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_req.id
    and status = 'PENDING';

  return v_result;
end;
$$;

revoke all on function public.approve_reschedule_request(uuid, text) from public, anon;
grant execute on function public.approve_reschedule_request(uuid, text) to authenticated;

create or replace function public.reject_reschedule_request(
  p_request_id uuid,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
  v_count integer;
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  v_note := nullif(btrim(coalesce(p_review_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Invalid reason';
  end if;

  update public.reschedule_requests
  set status = 'REJECTED',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = v_note
  where id = p_request_id
    and status = 'PENDING';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'This request is no longer pending';
  end if;
end;
$$;

revoke all on function public.reject_reschedule_request(uuid, text) from public, anon;
grant execute on function public.reject_reschedule_request(uuid, text) to authenticated;

create or replace function public.list_appointment_sms(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_client uuid;
begin
  v_role := public.current_user_role();
  if v_role is null or auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select client_id into v_client from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_role = 'CLIENT' and v_client is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_role not in ('CLIENT', 'STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  if v_role = 'CLIENT' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sm.id,
        'message_type', sm.message_type,
        'status', sm.status,
        'provider_status', sm.provider_status,
        'schedule_version', sm.schedule_version,
        'created_at', sm.created_at,
        'sent_at', sm.sent_at
      ) order by sm.created_at desc)
      from public.sms_messages sm
      where sm.appointment_id = p_appointment_id
        and sm.client_id = auth.uid()
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sm.id,
      'appointment_id', sm.appointment_id,
      'client_id', sm.client_id,
      'recipient_phone', sm.recipient_phone,
      'content', sm.content,
      'message_type', sm.message_type,
      'schedule_version', sm.schedule_version,
      'status', sm.status,
      'provider_status', sm.provider_status,
      'reference_id', sm.reference_id,
      'fail_reason', sm.fail_reason,
      'error_detail', sm.error_detail,
      'retry_count', sm.retry_count,
      'next_retry_at', sm.next_retry_at,
      'outcome_uncertain', sm.outcome_uncertain,
      'failure_class', sm.failure_class,
      'created_at', sm.created_at,
      'attempt_at', sm.attempt_at,
      'sent_at', sm.sent_at
    ) order by sm.created_at desc)
    from public.sms_messages sm
    where sm.appointment_id = p_appointment_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_appointment_sms(uuid) from public, anon;
grant execute on function public.list_appointment_sms(uuid) to authenticated;

create or replace function public.list_clinic_sms(p_limit integer, p_offset integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_offset integer;
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return coalesce((
    select jsonb_agg(row_data)
    from (
      select jsonb_build_object(
        'id', sm.id,
        'appointment_id', sm.appointment_id,
        'recipient_phone', sm.recipient_phone,
        'message_type', sm.message_type,
        'status', sm.status,
        'provider_status', sm.provider_status,
        'reference_id', sm.reference_id,
        'fail_reason', sm.fail_reason,
        'error_detail', sm.error_detail,
        'retry_count', sm.retry_count,
        'outcome_uncertain', sm.outcome_uncertain,
        'failure_class', sm.failure_class,
        'created_at', sm.created_at,
        'attempt_at', sm.attempt_at,
        'sent_at', sm.sent_at,
        'pet_name', p.name,
        'service_name', s.name
      ) as row_data
      from public.sms_messages sm
      join public.appointments a on a.id = sm.appointment_id
      join public.pets p on p.id = a.pet_id
      join public.services s on s.id = a.service_id
      order by sm.created_at desc
      limit v_limit
      offset v_offset
    ) listed
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_clinic_sms(integer, integer) from public, anon;
grant execute on function public.list_clinic_sms(integer, integer) to authenticated;

create or replace function public.list_appointment_reschedule_requests(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_client uuid;
begin
  v_role := public.current_user_role();
  if v_role is null or auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  select client_id into v_client from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_role = 'CLIENT' and v_client is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_role not in ('CLIENT', 'STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'appointment_id', r.appointment_id,
      'status', r.status,
      'reason', r.reason,
      'review_note', r.review_note,
      'created_at', r.created_at,
      'reviewed_at', r.reviewed_at,
      'requested_slot_date', to_char(ns.slot_date, 'YYYY-MM-DD'),
      'requested_start_time', to_char(ns.start_time, 'HH24:MI:SS'),
      'previous_slot_date', to_char(ps.slot_date, 'YYYY-MM-DD'),
      'previous_start_time', to_char(ps.start_time, 'HH24:MI:SS')
    ) order by r.created_at desc)
    from public.reschedule_requests r
    join public.appointment_slots ns on ns.id = r.requested_slot_id
    join public.appointment_slots ps on ps.id = r.previous_slot_id
    where r.appointment_id = p_appointment_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_appointment_reschedule_requests(uuid) from public, anon;
grant execute on function public.list_appointment_reschedule_requests(uuid) to authenticated;

create or replace function public.list_pending_reschedule_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'appointment_id', r.appointment_id,
      'reason', r.reason,
      'created_at', r.created_at,
      'pet_name', p.name,
      'service_name', s.name,
      'client_name', pr.full_name,
      'current_slot_date', to_char(cs.slot_date, 'YYYY-MM-DD'),
      'current_start_time', to_char(cs.start_time, 'HH24:MI:SS'),
      'requested_slot_date', to_char(ns.slot_date, 'YYYY-MM-DD'),
      'requested_start_time', to_char(ns.start_time, 'HH24:MI:SS')
    ) order by r.created_at asc)
    from public.reschedule_requests r
    join public.appointments a on a.id = r.appointment_id
    join public.pets p on p.id = a.pet_id
    join public.services s on s.id = a.service_id
    join public.profiles pr on pr.id = a.client_id
    join public.appointment_slots cs on cs.id = a.slot_id
    join public.appointment_slots ns on ns.id = r.requested_slot_id
    where r.status = 'PENDING'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_pending_reschedule_requests() from public, anon;
grant execute on function public.list_pending_reschedule_requests() to authenticated;

create or replace function public.list_reschedule_events(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_client uuid;
begin
  v_role := public.current_user_role();
  if v_role is null or auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  select client_id into v_client from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_role = 'CLIENT' and v_client is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_role not in ('CLIENT', 'STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'actor_role', e.actor_role,
      'reason', e.reason,
      'created_at', e.created_at,
      'previous_status', e.previous_status,
      'new_status', e.new_status,
      'previous_schedule_version', e.previous_schedule_version,
      'new_schedule_version', e.new_schedule_version,
      'previous_slot_date', to_char(ps.slot_date, 'YYYY-MM-DD'),
      'previous_start_time', to_char(ps.start_time, 'HH24:MI:SS'),
      'new_slot_date', to_char(ns.slot_date, 'YYYY-MM-DD'),
      'new_start_time', to_char(ns.start_time, 'HH24:MI:SS')
    ) order by e.created_at desc)
    from public.appointment_reschedule_events e
    join public.appointment_slots ps on ps.id = e.previous_slot_id
    join public.appointment_slots ns on ns.id = e.new_slot_id
    where e.appointment_id = p_appointment_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_reschedule_events(uuid) from public, anon;
grant execute on function public.list_reschedule_events(uuid) to authenticated;
