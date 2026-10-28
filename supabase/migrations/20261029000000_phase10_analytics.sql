-- Phase 10 analytics. Read-only aggregates over existing records.
-- This function does not write appointments, payments, stock, or loyalty.

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
      v_source_appointment,
      v_source_walk_in
  from public.appointments a
  join public.appointment_slots s on s.id = a.slot_id
  where s.slot_date between p_from and p_to;

  v_scheduled := v_pending + v_confirmed + v_checked_in + v_in_consultation
    + v_completed + v_cancelled + v_no_show;

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
        'NO_SHOW', v_no_show
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

comment on function public.clinic_analytics_report(date, date) is
  'Read-only clinic analytics for active staff and senior vets. Dates are inclusive Asia/Manila calendar dates.';

revoke all on function public.clinic_analytics_report(date, date) from public, anon;
grant execute on function public.clinic_analytics_report(date, date) to authenticated;
