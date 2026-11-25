-- Expire pending visits whose appointment date has already ended in Asia/Manila.
-- EXPIRED is added in the previous migration. Confirmed visits are left unchanged.
-- Expired visits free the slot the same way cancelled visits do.

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
      and a.status not in ('CANCELLED', 'EXPIRED')
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
                and a.status not in ('CANCELLED', 'EXPIRED')
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
          and a.status not in ('CANCELLED', 'EXPIRED')
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
  if new.status in ('CANCELLED', 'EXPIRED') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.slot_id is not distinct from new.slot_id
     and old.status not in ('CANCELLED', 'EXPIRED') then
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
    and a.status not in ('CANCELLED', 'EXPIRED')
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
          and a.status not in ('CANCELLED', 'EXPIRED')
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
    where a.slot_id = old.id
      and a.status not in ('CANCELLED', 'EXPIRED');
    if new.capacity < booked then
      raise exception 'Capacity cannot be below current bookings (%)', booked;
    end if;
  end if;
  return new;
end;
$$;

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
    and a.status not in ('CANCELLED', 'EXPIRED')
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
    and a.status not in ('CANCELLED', 'EXPIRED')
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
      and a.status not in ('CANCELLED', 'EXPIRED')
      and s.slot_date = v_slot.slot_date
      and s.start_time = v_slot.start_time
  ) then
    raise exception 'This pet already has an appointment at that date and time';
  end if;
end;
$$;

revoke all on function public._assert_replacement_slot(uuid, uuid) from public, anon, authenticated;

create or replace function public.expire_unconfirmed_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $expire$
declare
  v_id uuid;
  v_count integer := 0;
begin
  perform set_config('app.appointment_status_transition', 'on', true);

  for v_id in
    select a.id
    from public.appointments a
    join public.appointment_slots s on s.id = a.slot_id
    where a.status = 'PENDING'
      and s.slot_date < (timezone('Asia/Manila', now()))::date
    for update of a
  loop
    update public.appointments
    set status = 'EXPIRED'
    where id = v_id
      and status = 'PENDING';

    if not found then
      continue;
    end if;

    insert into public.appointment_status_events (
      appointment_id,
      previous_status,
      new_status,
      actor_id,
      actor_role,
      reason
    ) values (
      v_id,
      'PENDING',
      'EXPIRED',
      null,
      null,
      'The appointment date ended before the clinic confirmed it.'
    );

    update public.sms_messages
    set status = 'CANCELLED',
        error_detail = 'Cancelled because the appointment expired before confirmation.'
    where appointment_id = v_id
      and status = 'PENDING'
      and reference_id is null
      and outcome_uncertain = false;

    update public.reschedule_requests
    set status = 'WITHDRAWN',
        review_note = 'Withdrawn because the appointment expired before confirmation.'
    where appointment_id = v_id
      and status = 'PENDING';

    v_count := v_count + 1;
  end loop;

  perform set_config('app.appointment_status_transition', 'off', true);
  return v_count;
end;
$expire$;

revoke all on function public.expire_unconfirmed_appointments() from public, anon;
grant execute on function public.expire_unconfirmed_appointments() to authenticated, service_role;

create or replace function public.clinic_analytics_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_role public.user_role;
  v_customers integer;
  v_pending integer;
  v_confirmed integer;
  v_checked_in integer;
  v_in_consultation integer;
  v_completed integer;
  v_cancelled integer;
  v_no_show integer;
  v_expired integer;
  v_scheduled integer;
  v_scheduled_rows integer;
  v_booked integer;
  v_source_appointment integer;
  v_source_walk_in integer;
  v_service_bills integer;
  v_services jsonb;
  v_sale_count integer;
  v_gross numeric(12, 2);
  v_discounts numeric(12, 2);
  v_rewards numeric(12, 2);
  v_recorded numeric(12, 2);
  v_counter_bills integer;
  v_counter_recorded numeric(12, 2);
  v_days jsonb;
  v_recent jsonb;
  v_stamps_net integer;
  v_stamps_reversed integer;
  v_unlocked integer;
  v_revoked integer;
  v_redeemed integer;
  v_restored integer;
begin
  v_role := public.current_user_role();
  if v_role is null or v_role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not allowed to view clinic analytics';
  end if;

  if p_from is null or p_to is null or p_from > p_to or (p_to - p_from) > 365 then
    raise exception 'Invalid reporting period';
  end if;

  select count(*)::integer
    into v_customers
  from public.profiles
  where role = 'CLIENT'
    and (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  select
    (count(*) filter (where a.status = 'PENDING'))::integer,
    (count(*) filter (where a.status = 'CONFIRMED'))::integer,
    (count(*) filter (where a.status = 'CHECKED_IN'))::integer,
    (count(*) filter (where a.status = 'IN_CONSULTATION'))::integer,
    (count(*) filter (where a.status = 'COMPLETED'))::integer,
    (count(*) filter (where a.status = 'CANCELLED'))::integer,
    (count(*) filter (where a.status = 'NO_SHOW'))::integer,
    (count(*) filter (where a.status = 'EXPIRED'))::integer,
    (count(*) filter (where a.source = 'APPOINTMENT'))::integer,
    (count(*) filter (where a.source = 'WALK_IN'))::integer
    into
      v_pending,
      v_confirmed,
      v_checked_in,
      v_in_consultation,
      v_completed,
      v_cancelled,
      v_no_show,
      v_expired,
      v_source_appointment,
      v_source_walk_in
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where s.slot_date between p_from and p_to;

  v_scheduled := v_pending + v_confirmed + v_checked_in + v_in_consultation
    + v_completed + v_cancelled + v_no_show + v_expired;

  select count(*)::integer
    into v_scheduled_rows
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where s.slot_date between p_from and p_to;

  if v_scheduled is distinct from v_scheduled_rows
     or (v_source_appointment + v_source_walk_in) is distinct from v_scheduled_rows then
    raise exception 'Appointment status counts do not reconcile';
  end if;

  select count(*)::integer
    into v_booked
  from public.appointments
  where (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  select count(distinct t.id)::integer
    into v_service_bills
  from public.pos_transactions t
  join public.pos_transaction_items i on i.transaction_id = t.id
  where t.status = 'COMPLETED'
    and t.completed_at is not null
    and i.item_type = 'SERVICE'
    and (timezone('Asia/Manila', t.completed_at))::date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'service_id', services.service_id,
    'description', services.description,
    'transaction_count', services.transaction_count,
    'recorded_amount', services.recorded_amount
  ) order by services.transaction_count desc, services.recorded_amount desc), '[]'::jsonb)
    into v_services
  from (
    select
      i.service_id,
      coalesce((array_agg(i.description order by i.created_at desc))[1], 'Service') as description,
      count(distinct i.transaction_id)::integer as transaction_count,
      coalesce(round(sum(i.subtotal), 2), 0) as recorded_amount
    from public.pos_transaction_items i
    join public.pos_transactions t on t.id = i.transaction_id
    where i.item_type = 'SERVICE'
      and t.status = 'COMPLETED'
      and t.completed_at is not null
      and (timezone('Asia/Manila', t.completed_at))::date between p_from and p_to
    group by i.service_id
    order by count(distinct i.transaction_id) desc, coalesce(round(sum(i.subtotal), 2), 0) desc
    limit 12
  ) services;

  select
    count(*)::integer,
    coalesce(round(sum(subtotal), 2), 0),
    coalesce(round(sum(discount_amount), 2), 0),
    coalesce(round(sum(reward_amount), 2), 0),
    coalesce(round(sum(total), 2), 0)
    into v_sale_count, v_gross, v_discounts, v_rewards, v_recorded
  from public.pos_transactions
  where status = 'COMPLETED'
    and completed_at is not null
    and (timezone('Asia/Manila', completed_at))::date between p_from and p_to;

  select
    count(*)::integer,
    coalesce(round(sum(total), 2), 0)
    into v_counter_bills, v_counter_recorded
  from public.pos_transactions
  where status = 'COMPLETED'
    and client_id is null
    and completed_at is not null
    and (timezone('Asia/Manila', completed_at))::date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(series.day::date, 'YYYY-MM-DD'),
    'gross', coalesce(sales.gross, 0),
    'discounts', coalesce(sales.discounts, 0),
    'rewards', coalesce(sales.rewards, 0),
    'recorded_sales', coalesce(sales.recorded_sales, 0),
    'transactions', coalesce(sales.transactions, 0)
  ) order by series.day), '[]'::jsonb)
    into v_days
  from generate_series(p_from, p_to, interval '1 day') as series(day)
  left join (
    select
      (timezone('Asia/Manila', completed_at))::date as sale_date,
      round(sum(subtotal), 2) as gross,
      round(sum(discount_amount), 2) as discounts,
      round(sum(reward_amount), 2) as rewards,
      round(sum(total), 2) as recorded_sales,
      count(*)::integer as transactions
    from public.pos_transactions
    where status = 'COMPLETED'
      and completed_at is not null
      and (timezone('Asia/Manila', completed_at))::date between p_from and p_to
    group by 1
  ) sales on sales.sale_date = series.day::date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'reference', recent.reference,
    'completed_at', recent.completed_at,
    'gross', recent.subtotal,
    'discounts', recent.discount_amount,
    'rewards', recent.reward_amount,
    'recorded_sales', recent.total
  ) order by recent.completed_at desc), '[]'::jsonb)
    into v_recent
  from (
    select id, reference, completed_at, subtotal, discount_amount, reward_amount, total
    from public.pos_transactions
    where status = 'COMPLETED'
      and completed_at is not null
      and (timezone('Asia/Manila', completed_at))::date between p_from and p_to
    order by completed_at desc
    limit 15
  ) recent;

  select count(*)::integer
    into v_stamps_net
  from public.loyalty_stamp_events
  where event_type = 'EARNED'
    and status = 'ACTIVE'
    and (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  select count(*)::integer
    into v_stamps_reversed
  from public.loyalty_stamp_events
  where event_type = 'REVERSED'
    and (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  select count(*)::integer
    into v_unlocked
  from public.loyalty_grants
  where status <> 'REVOKED'
    and (timezone('Asia/Manila', unlocked_at))::date between p_from and p_to;

  select count(*)::integer
    into v_revoked
  from public.loyalty_grants
  where status = 'REVOKED'
    and (timezone('Asia/Manila', unlocked_at))::date between p_from and p_to;

  select count(*)::integer
    into v_redeemed
  from public.loyalty_redemptions
  where status = 'APPLIED'
    and (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  select count(*)::integer
    into v_restored
  from public.loyalty_redemptions
  where status = 'RESTORED'
    and (timezone('Asia/Manila', created_at))::date between p_from and p_to;

  return jsonb_build_object(
    'customers_registered', v_customers,
    'appointments', jsonb_build_object(
      'scheduled', v_scheduled,
      'booked', v_booked,
      'statuses', jsonb_build_object(
        'PENDING', v_pending,
        'CONFIRMED', v_confirmed,
        'CHECKED_IN', v_checked_in,
        'IN_CONSULTATION', v_in_consultation,
        'COMPLETED', v_completed,
        'CANCELLED', v_cancelled,
        'NO_SHOW', v_no_show,
        'EXPIRED', v_expired
      ),
      'sources', jsonb_build_object(
        'APPOINTMENT', v_source_appointment,
        'WALK_IN', v_source_walk_in
      )
    ),
    'services', jsonb_build_object(
      'bills', v_service_bills,
      'rows', v_services
    ),
    'sales', jsonb_build_object(
      'transactions', v_sale_count,
      'gross', v_gross,
      'discounts', v_discounts,
      'rewards', v_rewards,
      'recorded_sales', v_recorded,
      'counter_bills', v_counter_bills,
      'counter_recorded_sales', v_counter_recorded,
      'days', v_days,
      'recent', v_recent
    ),
    'loyalty', jsonb_build_object(
      'stamps_earned_net', v_stamps_net,
      'stamps_reversed', v_stamps_reversed,
      'rewards_unlocked', v_unlocked,
      'rewards_revoked', v_revoked,
      'rewards_redeemed', v_redeemed,
      'redemptions_restored', v_restored
    )
  );
end;
$fn$;

revoke all on function public.clinic_analytics_report(date, date) from public, anon;
grant execute on function public.clinic_analytics_report(date, date) to authenticated;
