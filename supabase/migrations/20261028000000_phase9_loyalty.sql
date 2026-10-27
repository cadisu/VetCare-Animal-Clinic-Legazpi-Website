-- =====================================================================
-- Phase 9: digital stamp card.
-- Inspected before these hooks:
--   pos_recalculate (phase 7) forces discount_amount and reward_amount to 0
--   protect_pos_transaction is BEFORE trigger pos_transactions_protect
--   pos_transactions_set_updated_at is also BEFORE UPDATE
--   pos_complete_transaction, pos_void_transaction, and pos_edit_completed_transaction
--     (phase 8) lock the bill, set app.pos_write, and own stock and FEFO
--   appointments_enforce_status_transition is BEFORE UPDATE
-- This migration does not replace pos_complete_transaction, pos_void_transaction,
-- or pos_edit_completed_transaction, and it does not move product stock.
-- Redemption runs in BEFORE trigger a_loyalty_pos_before while the bill row is locked.
-- The stamp runs in AFTER trigger z_loyalty_pos_after, after redemption.
-- A stamp is awarded after redemption in the same checkout.
-- =====================================================================

-- ---------- types ----------

do $$ begin
  create type public.loyalty_cycle_policy as enum ('RESET_ON_REDEEM', 'CONTINUE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_reward_type as enum ('FREE_SERVICE', 'DISCOUNT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_cycle_status as enum ('OPEN', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_cycle_open_reason as enum ('INITIAL', 'RESET', 'ROLLOVER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_stamp_status as enum ('ACTIVE', 'REVERSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_grant_status as enum ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'REVOKED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loyalty_redemption_status as enum ('APPLIED', 'RESTORED');
exception when duplicate_object then null; end $$;

-- ---------- program ----------

create table if not exists public.loyalty_programs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  description   text check (description is null or char_length(description) <= 500),
  stamp_limit   int not null default 12 check (stamp_limit between 1 and 36),
  is_active     boolean not null default false,
  cycle_policy  public.loyalty_cycle_policy not null default 'RESET_ON_REDEEM',
  singleton     boolean not null default true unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.loyalty_program_services (
  program_id  uuid not null references public.loyalty_programs (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete restrict,
  primary key (program_id, service_id)
);

create table if not exists public.loyalty_rewards (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.loyalty_programs (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  description      text check (description is null or char_length(description) <= 500),
  reward_type      public.loyalty_reward_type not null,
  milestone_stamps int not null check (milestone_stamps between 1 and 36),
  service_id       uuid references public.services (id) on delete restrict,
  discount_amount  numeric(12, 2) check (discount_amount is null or discount_amount > 0),
  is_active        boolean not null default true,
  allow_repeat     boolean not null default false,
  validity_days    int check (validity_days is null or validity_days between 1 and 3650),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint loyalty_rewards_shape check (
    (
      reward_type = 'FREE_SERVICE'
      and service_id is not null
      and discount_amount is null
    )
    or (
      reward_type = 'DISCOUNT'
      and discount_amount is not null
    )
  )
);

create table if not exists public.loyalty_cycles (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.loyalty_programs (id) on delete restrict,
  client_id     uuid not null references public.profiles (id) on delete restrict,
  cycle_number  int not null check (cycle_number > 0),
  status        public.loyalty_cycle_status not null default 'OPEN',
  open_reason   public.loyalty_cycle_open_reason not null default 'INITIAL',
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  unique (client_id, program_id, cycle_number)
);

create unique index if not exists loyalty_cycles_one_open
  on public.loyalty_cycles (client_id, program_id)
  where status = 'OPEN';

create table if not exists public.loyalty_stamp_events (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.loyalty_programs (id) on delete restrict,
  client_id         uuid not null references public.profiles (id) on delete restrict,
  cycle_id          uuid not null references public.loyalty_cycles (id) on delete restrict,
  transaction_id    uuid not null references public.pos_transactions (id) on delete restrict,
  appointment_id    uuid references public.appointments (id) on delete restrict,
  service_id        uuid references public.services (id) on delete restrict,
  event_type        text not null check (event_type in ('EARNED', 'REVERSED')),
  status            public.loyalty_stamp_status not null default 'ACTIVE',
  reverses_event_id uuid references public.loyalty_stamp_events (id) on delete restrict,
  reason            text check (reason is null or char_length(btrim(reason)) between 3 and 500),
  created_by        uuid references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now()
);

comment on table public.loyalty_stamp_events is
  'Append-only stamp history. One ACTIVE earn per transaction. A void inserts a reversal and does not delete the earn.';

create unique index if not exists loyalty_stamp_one_active_earn
  on public.loyalty_stamp_events (transaction_id)
  where event_type = 'EARNED' and status = 'ACTIVE';

create unique index if not exists loyalty_stamp_one_reversal
  on public.loyalty_stamp_events (reverses_event_id)
  where reverses_event_id is not null;

create index if not exists loyalty_stamp_events_client_idx
  on public.loyalty_stamp_events (client_id, created_at desc);

create table if not exists public.loyalty_grants (
  id                       uuid primary key default gen_random_uuid(),
  program_id               uuid not null references public.loyalty_programs (id) on delete restrict,
  client_id                uuid not null references public.profiles (id) on delete restrict,
  cycle_id                 uuid not null references public.loyalty_cycles (id) on delete restrict,
  reward_id                uuid not null references public.loyalty_rewards (id) on delete restrict,
  status                   public.loyalty_grant_status not null default 'AVAILABLE',
  milestone_stamps         int not null check (milestone_stamps between 1 and 36),
  reward_name              text not null,
  reward_description       text,
  reward_type              public.loyalty_reward_type not null,
  service_id               uuid references public.services (id) on delete restrict,
  discount_amount          numeric(12, 2),
  validity_days            int,
  expires_at               timestamptz,
  unlocked_at              timestamptz not null default now(),
  held_by_transaction_id   uuid,
  redeemed_transaction_id  uuid
);

comment on column public.loyalty_grants.expires_at is
  'Snapshotted at unlock from validity_days. Later reward edits must not change it. Existing reward validity cannot be changed.';

comment on column public.loyalty_grants.held_by_transaction_id is
  'Reservation on one open bill. It is not a redemption and does not insert a loyalty redemption row.';

create unique index if not exists loyalty_grants_one_hold
  on public.loyalty_grants (held_by_transaction_id)
  where held_by_transaction_id is not null;

create index if not exists loyalty_grants_client_idx
  on public.loyalty_grants (client_id, status, unlocked_at desc);

create table if not exists public.loyalty_redemptions (
  id                uuid primary key default gen_random_uuid(),
  grant_id          uuid not null references public.loyalty_grants (id) on delete restrict,
  client_id         uuid not null references public.profiles (id) on delete restrict,
  transaction_id    uuid not null unique references public.pos_transactions (id) on delete restrict,
  reward_amount     numeric(12, 2) not null check (reward_amount >= 0),
  reward_label      text,
  status            public.loyalty_redemption_status not null default 'APPLIED',
  redeemed_by       uuid references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now(),
  restored_at       timestamptz,
  restored_by       uuid references public.profiles (id) on delete restrict,
  restore_note      text,
  cycle_closed_id   uuid references public.loyalty_cycles (id) on delete restrict,
  cycle_opened_id   uuid references public.loyalty_cycles (id) on delete restrict
);

create index if not exists loyalty_redemptions_client_idx
  on public.loyalty_redemptions (client_id, created_at desc);

-- POS columns. Catalog line prices stay on the item rows.
alter table public.pos_transactions
  add column if not exists loyalty_grant_id uuid,
  add column if not exists reward_label text;

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'pos_transactions'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%discount_amount = 0%'
        or pg_get_constraintdef(con.oid) ilike '%reward_amount = 0%'
      )
  loop
    execute format('alter table public.pos_transactions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.pos_transactions
  drop constraint if exists pos_transactions_discount_amount_nonnegative;
alter table public.pos_transactions
  add constraint pos_transactions_discount_amount_nonnegative check (discount_amount >= 0);

alter table public.pos_transactions
  drop constraint if exists pos_transactions_reward_amount_nonnegative;
alter table public.pos_transactions
  add constraint pos_transactions_reward_amount_nonnegative check (reward_amount >= 0);

alter table public.pos_transactions
  drop constraint if exists pos_transactions_loyalty_grant_fk;
alter table public.pos_transactions
  add constraint pos_transactions_loyalty_grant_fk
  foreign key (loyalty_grant_id) references public.loyalty_grants (id) on delete restrict;

alter table public.loyalty_grants
  drop constraint if exists loyalty_grants_held_by_fk;
alter table public.loyalty_grants
  add constraint loyalty_grants_held_by_fk
  foreign key (held_by_transaction_id) references public.pos_transactions (id) on delete restrict;

alter table public.loyalty_grants
  drop constraint if exists loyalty_grants_redeemed_txn_fk;
alter table public.loyalty_grants
  add constraint loyalty_grants_redeemed_txn_fk
  foreign key (redeemed_transaction_id) references public.pos_transactions (id) on delete restrict;

drop trigger if exists loyalty_programs_set_updated_at on public.loyalty_programs;
create trigger loyalty_programs_set_updated_at
  before update on public.loyalty_programs
  for each row execute function public.set_updated_at();

drop trigger if exists loyalty_rewards_set_updated_at on public.loyalty_rewards;
create trigger loyalty_rewards_set_updated_at
  before update on public.loyalty_rewards
  for each row execute function public.set_updated_at();

-- ---------- guards ----------

create or replace function public.loyalty_write_allowed()
returns boolean
language sql
stable
as $fn$
  select current_setting('app.loyalty_write', true) = 'on';
$fn$;

create or replace function public.protect_loyalty_table()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if not public.loyalty_write_allowed() then
    raise exception 'Loyalty records cannot be changed directly';
  end if;

  if tg_table_name = 'loyalty_stamp_events' then
    if tg_op = 'DELETE' then
      raise exception 'Loyalty history cannot be deleted';
    end if;
    if tg_op = 'UPDATE' then
      if old.event_type = 'EARNED'
         and old.status = 'ACTIVE'
         and new.status = 'REVERSED'
         and new.client_id is not distinct from old.client_id
         and new.cycle_id is not distinct from old.cycle_id
         and new.transaction_id is not distinct from old.transaction_id
         and new.service_id is not distinct from old.service_id
         and new.event_type is not distinct from old.event_type then
        return new;
      end if;
      raise exception 'Loyalty history cannot be rewritten';
    end if;
  elsif tg_table_name in ('loyalty_grants', 'loyalty_redemptions', 'loyalty_cycles', 'loyalty_programs', 'loyalty_rewards') then
    if tg_op = 'DELETE' then
      raise exception 'Loyalty history cannot be deleted';
    end if;
  end if;

  if tg_table_name = 'loyalty_grants' and tg_op = 'UPDATE' then
    if new.expires_at is distinct from old.expires_at
       or new.validity_days is distinct from old.validity_days
       or new.milestone_stamps is distinct from old.milestone_stamps
       or new.reward_name is distinct from old.reward_name
       or new.reward_description is distinct from old.reward_description
       or new.reward_type is distinct from old.reward_type
       or new.discount_amount is distinct from old.discount_amount
       or new.service_id is distinct from old.service_id
       or new.client_id is distinct from old.client_id
       or new.cycle_id is distinct from old.cycle_id
       or new.reward_id is distinct from old.reward_id
       or new.program_id is distinct from old.program_id
       or new.unlocked_at is distinct from old.unlocked_at then
      raise exception 'Existing reward validity cannot be changed';
    end if;
  end if;

  if tg_table_name = 'loyalty_redemptions' and tg_op = 'UPDATE' then
    if new.grant_id is distinct from old.grant_id
       or new.client_id is distinct from old.client_id
       or new.transaction_id is distinct from old.transaction_id
       or new.reward_amount is distinct from old.reward_amount
       or new.redeemed_by is distinct from old.redeemed_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Loyalty history cannot be rewritten';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$fn$;

drop trigger if exists loyalty_programs_protect on public.loyalty_programs;
create trigger loyalty_programs_protect
  before insert or update or delete on public.loyalty_programs
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_program_services_protect on public.loyalty_program_services;
create trigger loyalty_program_services_protect
  before insert or update or delete on public.loyalty_program_services
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_rewards_protect on public.loyalty_rewards;
create trigger loyalty_rewards_protect
  before insert or update or delete on public.loyalty_rewards
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_cycles_protect on public.loyalty_cycles;
create trigger loyalty_cycles_protect
  before insert or update or delete on public.loyalty_cycles
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_stamp_events_protect on public.loyalty_stamp_events;
create trigger loyalty_stamp_events_protect
  before insert or update or delete on public.loyalty_stamp_events
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_grants_protect on public.loyalty_grants;
create trigger loyalty_grants_protect
  before insert or update or delete on public.loyalty_grants
  for each row execute function public.protect_loyalty_table();

drop trigger if exists loyalty_redemptions_protect on public.loyalty_redemptions;
create trigger loyalty_redemptions_protect
  before insert or update or delete on public.loyalty_redemptions
  for each row execute function public.protect_loyalty_table();

-- ---------- helpers ----------

create or replace function public.loyalty_assert_senior()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can change the loyalty program';
  end if;
end;
$fn$;

create or replace function public.loyalty_cycle_stamp_count(p_cycle_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int
  from public.loyalty_stamp_events
  where cycle_id = p_cycle_id
    and event_type = 'EARNED'
    and status = 'ACTIVE';
$fn$;

create or replace function public.loyalty_lock_open_cycle(
  p_program_id uuid,
  p_client_id uuid,
  p_reason public.loyalty_cycle_open_reason
)
returns public.loyalty_cycles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cycle public.loyalty_cycles;
  v_next int;
begin
  perform set_config('app.loyalty_write', 'on', true);
  select *
    into v_cycle
  from public.loyalty_cycles
  where program_id = p_program_id
    and client_id = p_client_id
    and status = 'OPEN'
  for update;
  if found then
    return v_cycle;
  end if;

  select coalesce(max(cycle_number), 0) + 1
    into v_next
  from public.loyalty_cycles
  where program_id = p_program_id
    and client_id = p_client_id;

  begin
    insert into public.loyalty_cycles (program_id, client_id, cycle_number, status, open_reason)
    values (p_program_id, p_client_id, v_next, 'OPEN', p_reason)
    returning * into v_cycle;
  exception
    when unique_violation then
      select *
        into v_cycle
      from public.loyalty_cycles
      where program_id = p_program_id
        and client_id = p_client_id
        and status = 'OPEN'
      for update;
  end;
  return v_cycle;
end;
$fn$;

create or replace function public.loyalty_reward_quote(p_transaction_id uuid, p_grant_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_txn public.pos_transactions;
  v_grant public.loyalty_grants;
  v_subtotal numeric(12, 2);
  v_base numeric(12, 2);
  v_unit numeric(12, 2);
begin
  select * into v_txn from public.pos_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  select * into v_grant from public.loyalty_grants where id = p_grant_id;
  if not found then
    raise exception 'This reward is no longer available';
  end if;
  if v_txn.client_id is null or v_grant.client_id is distinct from v_txn.client_id then
    raise exception 'This reward belongs to another client';
  end if;
  if v_grant.status not in ('AVAILABLE', 'REDEEMED') then
    raise exception 'This reward is no longer available';
  end if;
  if v_grant.status = 'AVAILABLE'
     and v_grant.expires_at is not null
     and v_grant.expires_at <= now() then
    raise exception 'This reward has expired';
  end if;

  select coalesce(round(sum(subtotal), 2), 0)
    into v_subtotal
  from public.pos_transaction_items
  where transaction_id = p_transaction_id;

  if v_grant.reward_type = 'FREE_SERVICE' then
    select unit_price
      into v_unit
    from public.pos_transaction_items
    where transaction_id = p_transaction_id
      and item_type = 'SERVICE'
      and service_id = v_grant.service_id
    order by created_at, id
    limit 1;
    if v_unit is null then
      raise exception 'This reward needs its service on the bill';
    end if;
    return least(round(v_unit, 2), v_subtotal);
  end if;

  if v_grant.service_id is not null then
    select round(sum(subtotal), 2)
      into v_base
    from public.pos_transaction_items
    where transaction_id = p_transaction_id
      and item_type = 'SERVICE'
      and service_id = v_grant.service_id;
    if v_base is null then
      raise exception 'This reward needs its service on the bill';
    end if;
  else
    v_base := v_subtotal;
  end if;
  return least(round(coalesce(v_grant.discount_amount, 0), 2), coalesce(v_base, 0), v_subtotal);
end;
$fn$;

create or replace function public.loyalty_release_hold(p_grant_id uuid, p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform set_config('app.loyalty_write', 'on', true);
  update public.loyalty_grants
  set held_by_transaction_id = null
  where id = p_grant_id
    and held_by_transaction_id = p_transaction_id
    and status = 'AVAILABLE';
end;
$fn$;

create or replace function public.loyalty_unlock_cycle(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cycle public.loyalty_cycles;
  v_program public.loyalty_programs;
  v_count int;
  v_reward public.loyalty_rewards;
  v_expires timestamptz;
begin
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_cycle from public.loyalty_cycles where id = p_cycle_id for update;
  if not found or v_cycle.status <> 'OPEN' then
    return;
  end if;
  select * into v_program from public.loyalty_programs where id = v_cycle.program_id;
  if not found then
    return;
  end if;
  v_count := public.loyalty_cycle_stamp_count(p_cycle_id);

  for v_reward in
    select *
    from public.loyalty_rewards
    where program_id = v_program.id
      and is_active
      and milestone_stamps <= v_count
      and milestone_stamps <= v_program.stamp_limit
    order by milestone_stamps, created_at
  loop
    if not v_reward.allow_repeat and exists (
      select 1 from public.loyalty_grants
      where cycle_id = p_cycle_id
        and reward_id = v_reward.id
        and status in ('AVAILABLE', 'REDEEMED', 'EXPIRED')
    ) then
      continue;
    end if;
    if v_reward.allow_repeat and exists (
      select 1 from public.loyalty_grants
      where cycle_id = p_cycle_id
        and reward_id = v_reward.id
        and status = 'AVAILABLE'
    ) then
      continue;
    end if;

    v_expires := case
      when v_reward.validity_days is null then null
      else now() + make_interval(days => v_reward.validity_days)
    end;
    insert into public.loyalty_grants (
      program_id, client_id, cycle_id, reward_id, status,
      milestone_stamps, reward_name, reward_description, reward_type,
      service_id, discount_amount, validity_days, expires_at
    ) values (
      v_program.id, v_cycle.client_id, p_cycle_id, v_reward.id, 'AVAILABLE',
      v_reward.milestone_stamps, v_reward.name, v_reward.description, v_reward.reward_type,
      v_reward.service_id, v_reward.discount_amount, v_reward.validity_days, v_expires
    );
  end loop;
end;
$fn$;

create or replace function public.loyalty_refresh_open_cycles()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cycle uuid;
begin
  for v_cycle in select id from public.loyalty_cycles where status = 'OPEN'
  loop
    perform public.loyalty_unlock_cycle(v_cycle);
  end loop;
end;
$fn$;

create or replace function public.loyalty_qualifying_service(p_transaction_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_program uuid;
  v_service uuid;
begin
  select id into v_program from public.loyalty_programs where is_active limit 1;
  if v_program is null then
    return null;
  end if;
  select i.service_id
    into v_service
  from public.pos_transaction_items i
  join public.appointments a on a.id = i.appointment_id and a.status = 'COMPLETED'
  join public.loyalty_program_services e
    on e.program_id = v_program and e.service_id = i.service_id
  where i.transaction_id = p_transaction_id
    and i.item_type = 'SERVICE'
  order by i.created_at, i.id
  limit 1;
  return v_service;
end;
$fn$;

-- One stamp per completed paid transaction, only after the eligible appointment is completed.
-- RESET_ON_REDEEM: a full open cycle does not earn another stamp until redemption opens the next cycle.
-- CONTINUE: the stamp that would pass stamp_limit closes the full cycle and becomes stamp 1 of a ROLLOVER cycle.
create or replace function public.loyalty_award_for_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_txn public.pos_transactions;
  v_program public.loyalty_programs;
  v_service uuid;
  v_appointment uuid;
  v_cycle public.loyalty_cycles;
  v_count int;
begin
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found or v_txn.status <> 'COMPLETED' or v_txn.client_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_txn.client_id and role = 'CLIENT' and status = 'ACTIVE'
  ) then
    return;
  end if;
  select * into v_program from public.loyalty_programs limit 1;
  if not found or not v_program.is_active then
    return;
  end if;
  if exists (
    select 1 from public.loyalty_stamp_events
    where transaction_id = p_transaction_id
      and event_type = 'EARNED'
      and status = 'ACTIVE'
  ) then
    return;
  end if;

  v_service := public.loyalty_qualifying_service(p_transaction_id);
  if v_service is null then
    return;
  end if;
  select i.appointment_id
    into v_appointment
  from public.pos_transaction_items i
  where i.transaction_id = p_transaction_id
    and i.item_type = 'SERVICE'
    and i.service_id = v_service
  order by i.created_at, i.id
  limit 1;

  v_cycle := public.loyalty_lock_open_cycle(v_program.id, v_txn.client_id, 'INITIAL');
  v_count := public.loyalty_cycle_stamp_count(v_cycle.id);
  if v_count >= v_program.stamp_limit then
    if v_program.cycle_policy = 'RESET_ON_REDEEM' then
      return;
    end if;
    update public.loyalty_cycles
    set status = 'CLOSED', closed_at = now()
    where id = v_cycle.id;
    v_cycle := public.loyalty_lock_open_cycle(v_program.id, v_txn.client_id, 'ROLLOVER');
  end if;

  begin
    insert into public.loyalty_stamp_events (
      program_id, client_id, cycle_id, transaction_id, appointment_id, service_id,
      event_type, status, created_by
    ) values (
      v_program.id, v_txn.client_id, v_cycle.id, p_transaction_id, v_appointment, v_service,
      'EARNED', 'ACTIVE', auth.uid()
    );
  exception
    when unique_violation then
      return;
  end;
  perform public.loyalty_unlock_cycle(v_cycle.id);
end;
$fn$;

create or replace function public.loyalty_reverse_stamp(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_earn public.loyalty_stamp_events;
  v_cycle public.loyalty_cycles;
  v_previous public.loyalty_cycles;
  v_count int;
  v_reason text;
  v_held record;
begin
  perform set_config('app.loyalty_write', 'on', true);
  perform set_config('app.pos_write', 'on', true);
  select *
    into v_earn
  from public.loyalty_stamp_events
  where transaction_id = p_transaction_id
    and event_type = 'EARNED'
    and status = 'ACTIVE'
  for update;
  if not found then
    return;
  end if;

  update public.loyalty_stamp_events
  set status = 'REVERSED'
  where id = v_earn.id;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 then
    v_reason := 'Stamp reversed';
  end if;
  insert into public.loyalty_stamp_events (
    program_id, client_id, cycle_id, transaction_id, appointment_id, service_id,
    event_type, status, reverses_event_id, reason, created_by
  ) values (
    v_earn.program_id, v_earn.client_id, v_earn.cycle_id, v_earn.transaction_id,
    v_earn.appointment_id, v_earn.service_id,
    'REVERSED', 'ACTIVE', v_earn.id, v_reason, auth.uid()
  );

  v_count := public.loyalty_cycle_stamp_count(v_earn.cycle_id);
  for v_held in
    select id, held_by_transaction_id as held
    from public.loyalty_grants
    where cycle_id = v_earn.cycle_id
      and status = 'AVAILABLE'
      and milestone_stamps > v_count
    for update
  loop
    if v_held.held is not null then
      update public.pos_transactions
      set loyalty_grant_id = null,
          reward_label = null
      where id = v_held.held
        and status = 'OPEN'
        and loyalty_grant_id = v_held.id;
      if found then
        perform public.pos_recalculate(v_held.held);
      end if;
    end if;
    update public.loyalty_grants
    set status = 'REVOKED',
        held_by_transaction_id = null
    where id = v_held.id;
  end loop;

  select * into v_cycle from public.loyalty_cycles where id = v_earn.cycle_id for update;
  if v_cycle.open_reason = 'ROLLOVER'
     and v_cycle.status = 'OPEN'
     and public.loyalty_cycle_stamp_count(v_cycle.id) = 0
     and not exists (
       select 1 from public.loyalty_grants
       where cycle_id = v_cycle.id
         and status in ('AVAILABLE', 'REDEEMED', 'EXPIRED')
     ) then
    select *
      into v_previous
    from public.loyalty_cycles
    where client_id = v_cycle.client_id
      and program_id = v_cycle.program_id
      and cycle_number = v_cycle.cycle_number - 1
    for update;
    if found and v_previous.status = 'CLOSED' then
      update public.loyalty_cycles
      set status = 'CLOSED', closed_at = now()
      where id = v_cycle.id;
      update public.loyalty_cycles
      set status = 'OPEN', closed_at = null
      where id = v_previous.id;
    end if;
  end if;
end;
$fn$;

create or replace function public.loyalty_reopen_if_empty(p_opened_id uuid, p_closed_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_opened public.loyalty_cycles;
  v_closed public.loyalty_cycles;
begin
  if p_opened_id is null or p_closed_id is null then
    return false;
  end if;
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_opened from public.loyalty_cycles where id = p_opened_id for update;
  if not found then
    return false;
  end if;
  select * into v_closed from public.loyalty_cycles where id = p_closed_id for update;
  if not found then
    return false;
  end if;
  if v_opened.status = 'OPEN'
     and public.loyalty_cycle_stamp_count(v_opened.id) = 0
     and not exists (
       select 1 from public.loyalty_grants
       where cycle_id = v_opened.id
         and status in ('AVAILABLE', 'REDEEMED', 'EXPIRED')
     )
     and v_closed.status = 'CLOSED' then
    update public.loyalty_cycles
    set status = 'CLOSED', closed_at = now()
    where id = v_opened.id;
    update public.loyalty_cycles
    set status = 'OPEN', closed_at = null
    where id = v_closed.id;
    return true;
  end if;
  return false;
end;
$fn$;

create or replace function public.loyalty_sync_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status public.pos_transaction_status;
begin
  select status into v_status from public.pos_transactions where id = p_transaction_id;
  if v_status is distinct from 'COMPLETED' then
    return;
  end if;
  if public.loyalty_qualifying_service(p_transaction_id) is not null then
    perform public.loyalty_award_for_transaction(p_transaction_id);
  else
    perform public.loyalty_reverse_stamp(p_transaction_id, 'Bill no longer qualifies for a stamp');
  end if;
end;
$fn$;

-- ---------- redemption ----------

create or replace function public.loyalty_redeem(
  p_transaction_id uuid,
  p_grant_id uuid,
  p_client_id uuid,
  p_reward_amount numeric,
  p_reward_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_grant public.loyalty_grants;
  v_program public.loyalty_programs;
  v_open public.loyalty_cycles;
  v_closed uuid;
  v_opened uuid;
  v_next int;
  v_quote numeric(12, 2);
begin
  perform public.pos_assert_staff();
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_grant from public.loyalty_grants where id = p_grant_id for update;
  if not found then
    raise exception 'This reward is no longer available';
  end if;
  if p_client_id is null or v_grant.client_id is distinct from p_client_id then
    raise exception 'This reward belongs to another client';
  end if;
  if v_grant.status <> 'AVAILABLE' then
    raise exception 'This reward is no longer available';
  end if;
  if v_grant.held_by_transaction_id is distinct from p_transaction_id then
    raise exception 'This reward is on another open bill';
  end if;
  if v_grant.expires_at is not null and v_grant.expires_at <= now() then
    raise exception 'This reward has expired';
  end if;

  v_quote := public.loyalty_reward_quote(p_transaction_id, p_grant_id);
  if round(v_quote, 2) is distinct from round(coalesce(p_reward_amount, 0), 2) then
    raise exception 'This reward needs its service on the bill';
  end if;

  update public.loyalty_grants
  set status = 'REDEEMED',
      held_by_transaction_id = null,
      redeemed_transaction_id = p_transaction_id
  where id = v_grant.id;

  select * into v_program from public.loyalty_programs where id = v_grant.program_id;
  if v_program.cycle_policy = 'RESET_ON_REDEEM' then
    select *
      into v_open
    from public.loyalty_cycles
    where program_id = v_program.id
      and client_id = v_grant.client_id
      and status = 'OPEN'
    for update;
    if found then
      update public.loyalty_cycles
      set status = 'CLOSED', closed_at = now()
      where id = v_open.id;
      v_closed := v_open.id;
      v_next := v_open.cycle_number + 1;
    else
      select coalesce(max(cycle_number), 0) + 1
        into v_next
      from public.loyalty_cycles
      where program_id = v_program.id
        and client_id = v_grant.client_id;
    end if;
    insert into public.loyalty_cycles (program_id, client_id, cycle_number, status, open_reason)
    values (v_program.id, v_grant.client_id, v_next, 'OPEN', 'RESET')
    returning id into v_opened;
  end if;

  insert into public.loyalty_redemptions (
    grant_id, client_id, transaction_id, reward_amount, reward_label, status,
    redeemed_by, cycle_closed_id, cycle_opened_id
  ) values (
    v_grant.id, v_grant.client_id, p_transaction_id, round(coalesce(p_reward_amount, 0), 2),
    p_reward_label, 'APPLIED', auth.uid(), v_closed, v_opened
  );
end;
$fn$;

create or replace function public.loyalty_restore_redemption(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.loyalty_redemptions;
  v_grant public.loyalty_grants;
  v_reopened boolean;
  v_note text;
begin
  perform set_config('app.loyalty_write', 'on', true);
  select *
    into v_row
  from public.loyalty_redemptions
  where transaction_id = p_transaction_id
    and status = 'APPLIED'
  for update;
  if not found then
    return;
  end if;

  select * into v_grant from public.loyalty_grants where id = v_row.grant_id for update;
  if (v_grant.expires_at is not null and v_grant.expires_at <= now())
     or public.loyalty_cycle_stamp_count(v_grant.cycle_id) < v_grant.milestone_stamps then
    update public.loyalty_grants
    set status = 'EXPIRED',
        held_by_transaction_id = null,
        redeemed_transaction_id = null
    where id = v_grant.id
      and v_grant.expires_at is not null
      and v_grant.expires_at <= now();
    update public.loyalty_grants
    set status = 'REVOKED',
        held_by_transaction_id = null,
        redeemed_transaction_id = null
    where id = v_grant.id
      and status = 'REDEEMED';
  else
    update public.loyalty_grants
    set status = 'AVAILABLE',
        held_by_transaction_id = null,
        redeemed_transaction_id = null
    where id = v_grant.id;
  end if;

  v_reopened := public.loyalty_reopen_if_empty(v_row.cycle_opened_id, v_row.cycle_closed_id);
  v_note := btrim(coalesce(p_reason, ''));
  if v_row.cycle_opened_id is not null and not v_reopened then
    v_note := v_note || ' Reward restored. The new cycle already has activity, so the reset stays.';
  end if;

  update public.loyalty_redemptions
  set status = 'RESTORED',
      restored_at = now(),
      restored_by = auth.uid(),
      restore_note = nullif(btrim(v_note), '')
  where id = v_row.id;
end;
$fn$;

create or replace function public.loyalty_on_completed_void(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.loyalty_reverse_stamp(p_transaction_id, p_reason);
  perform public.loyalty_restore_redemption(p_transaction_id, p_reason);
end;
$fn$;

create or replace function public.loyalty_attach_reward(p_transaction_id uuid, p_grant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_txn public.pos_transactions;
  v_grant public.loyalty_grants;
begin
  perform public.pos_assert_staff();
  perform set_config('app.pos_write', 'on', true);
  perform set_config('app.loyalty_write', 'on', true);

  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found or v_txn.status <> 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;

  if v_txn.loyalty_grant_id is not null and v_txn.loyalty_grant_id is distinct from p_grant_id then
    perform public.loyalty_release_hold(v_txn.loyalty_grant_id, p_transaction_id);
  end if;

  if p_grant_id is null then
    update public.pos_transactions
    set loyalty_grant_id = null,
        reward_label = null
    where id = p_transaction_id;
    perform public.pos_recalculate(p_transaction_id);
    return;
  end if;

  if v_txn.client_id is null then
    raise exception 'Choose a client before using a reward';
  end if;

  select * into v_grant from public.loyalty_grants where id = p_grant_id for update;
  if not found or v_grant.status <> 'AVAILABLE' then
    raise exception 'This reward is no longer available';
  end if;
  if v_grant.client_id is distinct from v_txn.client_id then
    raise exception 'This reward belongs to another client';
  end if;
  if v_grant.expires_at is not null and v_grant.expires_at <= now() then
    raise exception 'This reward has expired';
  end if;
  if v_grant.held_by_transaction_id is not null
     and v_grant.held_by_transaction_id is distinct from p_transaction_id then
    raise exception 'This reward is on another open bill';
  end if;

  update public.pos_transactions
  set loyalty_grant_id = p_grant_id
  where id = p_transaction_id;
  perform public.loyalty_reward_quote(p_transaction_id, p_grant_id);

  update public.loyalty_grants
  set held_by_transaction_id = p_transaction_id
  where id = p_grant_id;
  perform public.pos_recalculate(p_transaction_id);
end;
$fn$;

-- ---------- POS totals and guard ----------

create or replace function public.pos_recalculate(p_transaction_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_subtotal numeric(12, 2);
  v_reward numeric(12, 2) := 0;
  v_label text;
  v_grant uuid;
begin
  select coalesce(round(sum(subtotal), 2), 0)
    into v_subtotal
  from public.pos_transaction_items
  where transaction_id = p_transaction_id;

  select loyalty_grant_id into v_grant
  from public.pos_transactions
  where id = p_transaction_id;

  if v_grant is not null then
    v_reward := public.loyalty_reward_quote(p_transaction_id, v_grant);
    select reward_name into v_label from public.loyalty_grants where id = v_grant;
  end if;

  update public.pos_transactions
  set subtotal = v_subtotal,
      discount_amount = 0,
      reward_amount = v_reward,
      reward_label = v_label,
      total = round(v_subtotal - v_reward, 2)
  where id = p_transaction_id;

  return round(v_subtotal - v_reward, 2);
end;
$fn$;

create or replace function public.protect_pos_transaction()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'Completed transactions cannot be deleted';
  end if;
  if not public.pos_write_allowed()
     and current_setting('app.pos_backfill', true) is distinct from 'on'
     and current_setting('app.pos_edit', true) is distinct from 'on' then
    raise exception 'Transactions cannot be changed directly';
  end if;

  if tg_op = 'INSERT' then
    if new.reward_amount <> 0 or new.loyalty_grant_id is not null or new.reward_label is not null then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if current_setting('app.pos_backfill', true) = 'on'
     and old.status = new.status
     and old.status in ('COMPLETED', 'VOIDED')
     and old.amount_tendered is null
     and new.amount_tendered = new.total
     and new.change_amount = 0
     and new.amount_paid is not distinct from old.amount_paid then
    return new;
  end if;

  if new.reference is distinct from old.reference
     or new.created_by is distinct from old.created_by
     or new.discount_amount <> 0
     or new.discount_amount is distinct from old.discount_amount then
    raise exception 'This bill can no longer be changed';
  end if;

  if new.reward_amount < 0
     or new.reward_amount > new.subtotal
     or round(new.total, 2) is distinct from round(new.subtotal - new.discount_amount - new.reward_amount, 2) then
    raise exception 'This bill can no longer be changed';
  end if;

  if new.reward_amount is distinct from old.reward_amount
     or new.loyalty_grant_id is distinct from old.loyalty_grant_id
     or new.reward_label is distinct from old.reward_label then
    if old.status = 'OPEN' and new.status = 'OPEN' and public.pos_write_allowed() then
      null;
    elsif old.status = 'OPEN' and new.status = 'VOIDED' and public.pos_write_allowed()
          and new.loyalty_grant_id is null and new.reward_amount = 0 then
      null;
    elsif current_setting('app.pos_edit', true) = 'on'
          and old.status = 'COMPLETED'
          and new.status = 'COMPLETED'
          and new.total = old.total
          and new.amount_paid = old.amount_paid then
      null;
    else
      raise exception 'This bill can no longer be changed';
    end if;
  end if;

  if old.status = 'OPEN' and new.status = 'OPEN' then
    if new.amount_paid is not null
       or new.amount_tendered is not null
       or new.change_amount is not null
       or new.processed_by is not null
       or new.completed_at is not null
       or new.voided_by is not null
       or new.voided_at is not null
       or new.void_reason is not null then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if old.status = 'OPEN' and new.status = 'COMPLETED' then
    if new.amount_paid is distinct from new.total
       or new.amount_tendered is null
       or new.amount_tendered < new.total
       or new.change_amount is distinct from round(new.amount_tendered - new.total, 2)
       or new.processed_by is null
       or new.completed_at is null
       or new.voided_by is not null
       or new.voided_at is not null
       or new.void_reason is not null
       or new.reward_amount is distinct from old.reward_amount
       or new.loyalty_grant_id is distinct from old.loyalty_grant_id
       or new.subtotal is distinct from old.subtotal
       or new.total is distinct from old.total then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if old.status = 'OPEN' and new.status = 'VOIDED' then
    if new.amount_paid is not null
       or new.amount_tendered is not null
       or new.change_amount is not null
       or new.processed_by is not null
       or new.completed_at is not null
       or new.voided_by is null
       or new.voided_at is null
       or new.void_reason is null
       or new.subtotal is distinct from old.subtotal
       or new.loyalty_grant_id is not null
       or new.reward_amount <> 0 then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if old.status = 'COMPLETED' and new.status = 'VOIDED' then
    if new.amount_paid is distinct from old.amount_paid
       or new.amount_tendered is distinct from old.amount_tendered
       or new.change_amount is distinct from old.change_amount
       or new.subtotal is distinct from old.subtotal
       or new.total is distinct from old.total
       or new.reward_amount is distinct from old.reward_amount
       or new.loyalty_grant_id is distinct from old.loyalty_grant_id
       or new.processed_by is distinct from old.processed_by
       or new.completed_at is distinct from old.completed_at
       or new.voided_by is null
       or new.voided_at is null
       or new.void_reason is null then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if current_setting('app.pos_edit', true) = 'on'
     and old.status = 'COMPLETED'
     and new.status = 'COMPLETED'
     and new.total = old.total
     and new.amount_paid = old.amount_paid
     and new.amount_tendered is not distinct from old.amount_tendered
     and new.change_amount is not distinct from old.change_amount
     and new.client_id is not distinct from old.client_id
     and new.pet_id is not distinct from old.pet_id
     and new.appointment_id is not distinct from old.appointment_id
     and new.walk_in_name is not distinct from old.walk_in_name
     and new.walk_in_contact is not distinct from old.walk_in_contact
     and new.processed_by is not distinct from old.processed_by
     and new.completed_at is not distinct from old.completed_at then
    return new;
  end if;

  raise exception 'This bill can no longer be changed';
end;
$fn$;

create or replace function public.loyalty_pos_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = 'OPEN' and new.status = 'VOIDED' then
    if old.loyalty_grant_id is not null then
      perform public.loyalty_release_hold(old.loyalty_grant_id, old.id);
    end if;
    new.loyalty_grant_id := null;
    new.reward_label := null;
    new.reward_amount := 0;
    new.total := round(new.subtotal - new.discount_amount, 2);
    return new;
  end if;

  if old.status = 'OPEN' and new.status = 'COMPLETED' and new.loyalty_grant_id is not null then
    perform public.loyalty_redeem(
      new.id,
      new.loyalty_grant_id,
      new.client_id,
      new.reward_amount,
      new.reward_label
    );
  end if;
  return new;
end;
$fn$;

create or replace function public.loyalty_pos_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.status is distinct from 'COMPLETED' and new.status = 'COMPLETED' then
    perform public.loyalty_award_for_transaction(new.id);
  elsif old.status = 'COMPLETED' and new.status = 'VOIDED' then
    perform public.loyalty_on_completed_void(new.id, new.void_reason);
  end if;
  return null;
end;
$fn$;

create or replace function public.loyalty_appointment_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_txn uuid;
begin
  if old.status is not distinct from new.status or new.status is distinct from 'COMPLETED' then
    return null;
  end if;
  for v_txn in
    select distinct t.id
    from public.pos_transactions t
    join public.pos_transaction_items i on i.transaction_id = t.id
    where t.status = 'COMPLETED'
      and t.client_id is not null
      and (t.appointment_id = new.id or i.appointment_id = new.id)
  loop
    perform public.loyalty_award_for_transaction(v_txn);
  end loop;
  return null;
end;
$fn$;

create or replace function public.loyalty_edit_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.loyalty_sync_transaction(new.transaction_id);
  return null;
end;
$fn$;

drop trigger if exists a_loyalty_pos_before on public.pos_transactions;
create trigger a_loyalty_pos_before
  before update on public.pos_transactions
  for each row execute function public.loyalty_pos_before();

drop trigger if exists z_loyalty_pos_after on public.pos_transactions;
create trigger z_loyalty_pos_after
  after update on public.pos_transactions
  for each row execute function public.loyalty_pos_after();

drop trigger if exists z_loyalty_appointment_completed on public.appointments;
create trigger z_loyalty_appointment_completed
  after update on public.appointments
  for each row execute function public.loyalty_appointment_after();

drop trigger if exists z_loyalty_pos_edit_sync on public.pos_transaction_edits;
create trigger z_loyalty_pos_edit_sync
  after insert on public.pos_transaction_edits
  for each row execute function public.loyalty_edit_after();

-- Wraps the existing cart and payment functions so the reward hold and checkout share one transaction.
create or replace function public.pos_save_cart_with_reward(
  p_transaction_id uuid,
  p_client_id uuid,
  p_pet_id uuid,
  p_appointment_id uuid,
  p_walk_in_name text,
  p_walk_in_contact text,
  p_items jsonb,
  p_pay boolean,
  p_amount_tendered numeric,
  p_grant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  perform public.pos_assert_staff();
  if p_transaction_id is not null then
    perform public.loyalty_attach_reward(p_transaction_id, null);
  end if;
  v_id := public.pos_save_cart(
    p_transaction_id,
    p_client_id,
    p_pet_id,
    p_appointment_id,
    p_walk_in_name,
    p_walk_in_contact,
    p_items,
    false,
    null
  );
  perform public.loyalty_attach_reward(v_id, p_grant_id);
  if coalesce(p_pay, false) then
    perform public.pos_complete_transaction(v_id, p_amount_tendered);
  end if;
  return v_id;
end;
$fn$;

-- ---------- configuration ----------

create or replace function public.loyalty_save_program(
  p_name text,
  p_description text,
  p_is_active boolean,
  p_stamp_limit int,
  p_cycle_policy text,
  p_service_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_name text;
  v_description text;
  v_policy public.loyalty_cycle_policy;
  v_service uuid;
begin
  perform public.loyalty_assert_senior();
  perform set_config('app.loyalty_write', 'on', true);
  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Enter a program name';
  end if;
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'The description is too long';
  end if;
  if p_stamp_limit is null or p_stamp_limit < 1 or p_stamp_limit > 36 then
    raise exception 'Enter a stamp limit from 1 to 36';
  end if;
  if p_cycle_policy not in ('RESET_ON_REDEEM', 'CONTINUE') then
    raise exception 'Choose a cycle policy';
  end if;
  v_policy := p_cycle_policy::public.loyalty_cycle_policy;
  if exists (
    select 1 from public.loyalty_rewards
    where is_active and milestone_stamps > p_stamp_limit
  ) then
    raise exception 'Stamp limit is below an active milestone';
  end if;

  select id into v_id from public.loyalty_programs limit 1;
  if v_id is null then
    insert into public.loyalty_programs (name, description, stamp_limit, is_active, cycle_policy)
    values (v_name, v_description, p_stamp_limit, coalesce(p_is_active, false), v_policy)
    returning id into v_id;
  else
    update public.loyalty_programs
    set name = v_name,
        description = v_description,
        stamp_limit = p_stamp_limit,
        is_active = coalesce(p_is_active, false),
        cycle_policy = v_policy
    where id = v_id;
  end if;

  delete from public.loyalty_program_services where program_id = v_id;
  if p_service_ids is not null and jsonb_typeof(p_service_ids) = 'array' then
    for v_service in
      select distinct value::uuid
      from jsonb_array_elements_text(p_service_ids)
    loop
      if not exists (select 1 from public.services where id = v_service) then
        raise exception 'Choose a clinic service';
      end if;
      insert into public.loyalty_program_services (program_id, service_id)
      values (v_id, v_service);
    end loop;
  end if;

  perform public.loyalty_refresh_open_cycles();
  return v_id;
end;
$fn$;

create or replace function public.loyalty_save_reward(
  p_reward_id uuid,
  p_name text,
  p_description text,
  p_reward_type text,
  p_milestone int,
  p_service_id uuid,
  p_discount numeric,
  p_is_active boolean,
  p_allow_repeat boolean,
  p_validity_days int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_program public.loyalty_programs;
  v_id uuid;
  v_name text;
  v_description text;
  v_type public.loyalty_reward_type;
  v_service uuid;
  v_discount numeric(12, 2);
begin
  perform public.loyalty_assert_senior();
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_program from public.loyalty_programs limit 1;
  if not found then
    raise exception 'Enter a program name';
  end if;
  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Enter a reward name';
  end if;
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if p_reward_type not in ('FREE_SERVICE', 'DISCOUNT') then
    raise exception 'Choose a reward type';
  end if;
  v_type := p_reward_type::public.loyalty_reward_type;
  if p_milestone is null or p_milestone < 1 or p_milestone > v_program.stamp_limit then
    raise exception 'Stamp limit is below an active milestone';
  end if;
  if p_validity_days is not null and (p_validity_days < 1 or p_validity_days > 3650) then
    raise exception 'Enter a valid number of days';
  end if;

  if v_type = 'FREE_SERVICE' then
    v_service := p_service_id;
    v_discount := null;
    if v_service is null or not exists (select 1 from public.services where id = v_service) then
      raise exception 'Choose the reward service';
    end if;
  else
    v_service := p_service_id;
    if v_service is not null and not exists (select 1 from public.services where id = v_service) then
      raise exception 'Choose the reward service';
    end if;
    if p_discount is null or p_discount <= 0 or p_discount > 9999999999.99 then
      raise exception 'Enter a discount amount';
    end if;
    v_discount := round(p_discount, 2);
  end if;

  if coalesce(p_is_active, false) and p_milestone > v_program.stamp_limit then
    raise exception 'Stamp limit is below an active milestone';
  end if;

  if p_reward_id is null then
    insert into public.loyalty_rewards (
      program_id, name, description, reward_type, milestone_stamps, service_id,
      discount_amount, is_active, allow_repeat, validity_days
    ) values (
      v_program.id, v_name, v_description, v_type, p_milestone, v_service,
      v_discount, coalesce(p_is_active, true), coalesce(p_allow_repeat, false), p_validity_days
    ) returning id into v_id;
  else
    update public.loyalty_rewards
    set name = v_name,
        description = v_description,
        reward_type = v_type,
        milestone_stamps = p_milestone,
        service_id = v_service,
        discount_amount = v_discount,
        is_active = coalesce(p_is_active, false),
        allow_repeat = coalesce(p_allow_repeat, false),
        validity_days = p_validity_days
    where id = p_reward_id
      and program_id = v_program.id
    returning id into v_id;
    if v_id is null then
      raise exception 'This reward is no longer available';
    end if;
  end if;

  -- Raising a milestone does not revoke grants already issued.
  -- Existing reward validity cannot be changed.
  perform public.loyalty_refresh_open_cycles();
  return v_id;
end;
$fn$;

create or replace function public.loyalty_set_reward_active(p_reward_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reward public.loyalty_rewards;
  v_limit int;
begin
  perform public.loyalty_assert_senior();
  perform set_config('app.loyalty_write', 'on', true);
  select * into v_reward from public.loyalty_rewards where id = p_reward_id;
  if not found then
    raise exception 'This reward is no longer available';
  end if;
  select stamp_limit into v_limit from public.loyalty_programs where id = v_reward.program_id;
  if coalesce(p_is_active, false) and v_reward.milestone_stamps > v_limit then
    raise exception 'Stamp limit is below an active milestone';
  end if;
  update public.loyalty_rewards
  set is_active = coalesce(p_is_active, false)
  where id = p_reward_id;
  perform public.loyalty_refresh_open_cycles();
end;
$fn$;

create or replace function public.loyalty_client_rewards(p_client_id uuid)
returns table (
  grant_id uuid,
  reward_name text,
  reward_description text,
  reward_type public.loyalty_reward_type,
  service_id uuid,
  discount_amount numeric,
  milestone_stamps int,
  expires_at timestamptz,
  held_by_transaction_id uuid,
  held_reference text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row record;
begin
  perform public.pos_assert_staff();
  if p_client_id is null or not exists (
    select 1 from public.profiles where id = p_client_id and role = 'CLIENT'
  ) then
    raise exception 'Client not found';
  end if;
  perform set_config('app.loyalty_write', 'on', true);
  perform set_config('app.pos_write', 'on', true);

  for v_row in
    select id, held_by_transaction_id as held
    from public.loyalty_grants
    where client_id = p_client_id
      and status = 'AVAILABLE'
      and expires_at is not null
      and expires_at <= now()
    for update
  loop
    if v_row.held is not null then
      update public.pos_transactions
      set loyalty_grant_id = null,
          reward_label = null
      where id = v_row.held
        and status = 'OPEN'
        and loyalty_grant_id = v_row.id;
      if found then
        perform public.pos_recalculate(v_row.held);
      end if;
    end if;
    update public.loyalty_grants
    set status = 'EXPIRED',
        held_by_transaction_id = null
    where id = v_row.id;
  end loop;

  return query
  select
    g.id,
    g.reward_name,
    g.reward_description,
    g.reward_type,
    g.service_id,
    g.discount_amount,
    g.milestone_stamps,
    g.expires_at,
    g.held_by_transaction_id,
    t.reference
  from public.loyalty_grants g
  left join public.pos_transactions t on t.id = g.held_by_transaction_id
  where g.client_id = p_client_id
    and g.status = 'AVAILABLE'
  order by g.milestone_stamps, g.unlocked_at;
end;
$fn$;

-- ---------- seed ----------

select set_config('app.loyalty_write', 'on', true);
insert into public.loyalty_programs (name, description, stamp_limit, is_active, cycle_policy)
select
  'VetCare Loyalty',
  'Digital stamp card for completed clinic visits.',
  12,
  false,
  'RESET_ON_REDEEM'
where not exists (select 1 from public.loyalty_programs);

-- ---------- access ----------

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_program_services enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_cycles enable row level security;
alter table public.loyalty_stamp_events enable row level security;
alter table public.loyalty_grants enable row level security;
alter table public.loyalty_redemptions enable row level security;

drop policy if exists "loyalty_programs_select" on public.loyalty_programs;
create policy "loyalty_programs_select"
  on public.loyalty_programs for select to authenticated
  using (public.current_user_role() in ('CLIENT', 'STAFF', 'SENIOR_VET'));

drop policy if exists "loyalty_program_services_select" on public.loyalty_program_services;
create policy "loyalty_program_services_select"
  on public.loyalty_program_services for select to authenticated
  using (public.current_user_role() in ('CLIENT', 'STAFF', 'SENIOR_VET'));

drop policy if exists "loyalty_rewards_select" on public.loyalty_rewards;
create policy "loyalty_rewards_select"
  on public.loyalty_rewards for select to authenticated
  using (public.current_user_role() in ('CLIENT', 'STAFF', 'SENIOR_VET'));

drop policy if exists "loyalty_cycles_select" on public.loyalty_cycles;
create policy "loyalty_cycles_select"
  on public.loyalty_cycles for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (public.current_user_role() = 'CLIENT' and client_id = auth.uid())
  );

drop policy if exists "loyalty_stamp_events_select" on public.loyalty_stamp_events;
create policy "loyalty_stamp_events_select"
  on public.loyalty_stamp_events for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (public.current_user_role() = 'CLIENT' and client_id = auth.uid())
  );

drop policy if exists "loyalty_grants_select" on public.loyalty_grants;
create policy "loyalty_grants_select"
  on public.loyalty_grants for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (public.current_user_role() = 'CLIENT' and client_id = auth.uid())
  );

drop policy if exists "loyalty_redemptions_select" on public.loyalty_redemptions;
create policy "loyalty_redemptions_select"
  on public.loyalty_redemptions for select to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (public.current_user_role() = 'CLIENT' and client_id = auth.uid())
  );

revoke all on public.loyalty_programs from public, anon, authenticated;
revoke all on public.loyalty_program_services from public, anon, authenticated;
revoke all on public.loyalty_rewards from public, anon, authenticated;
revoke all on public.loyalty_cycles from public, anon, authenticated;
revoke all on public.loyalty_stamp_events from public, anon, authenticated;
revoke all on public.loyalty_grants from public, anon, authenticated;
revoke all on public.loyalty_redemptions from public, anon, authenticated;

grant select on public.loyalty_programs to authenticated;
grant select on public.loyalty_program_services to authenticated;
grant select on public.loyalty_rewards to authenticated;
grant select on public.loyalty_cycles to authenticated;
grant select on public.loyalty_stamp_events to authenticated;
grant select on public.loyalty_grants to authenticated;
grant select on public.loyalty_redemptions to authenticated;

revoke all on function public.loyalty_write_allowed() from public, anon, authenticated;
revoke all on function public.protect_loyalty_table() from public, anon, authenticated;
revoke all on function public.loyalty_assert_senior() from public, anon, authenticated;
revoke all on function public.loyalty_cycle_stamp_count(uuid) from public, anon, authenticated;
revoke all on function public.loyalty_lock_open_cycle(uuid, uuid, public.loyalty_cycle_open_reason) from public, anon, authenticated;
revoke all on function public.loyalty_reward_quote(uuid, uuid) from public, anon, authenticated;
revoke all on function public.loyalty_release_hold(uuid, uuid) from public, anon, authenticated;
revoke all on function public.loyalty_unlock_cycle(uuid) from public, anon, authenticated;
revoke all on function public.loyalty_refresh_open_cycles() from public, anon, authenticated;
revoke all on function public.loyalty_qualifying_service(uuid) from public, anon, authenticated;
revoke all on function public.loyalty_award_for_transaction(uuid) from public, anon, authenticated;
revoke all on function public.loyalty_reverse_stamp(uuid, text) from public, anon, authenticated;
revoke all on function public.loyalty_reopen_if_empty(uuid, uuid) from public, anon, authenticated;
revoke all on function public.loyalty_sync_transaction(uuid) from public, anon, authenticated;
revoke all on function public.loyalty_redeem(uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.loyalty_restore_redemption(uuid, text) from public, anon, authenticated;
revoke all on function public.loyalty_on_completed_void(uuid, text) from public, anon, authenticated;
revoke all on function public.loyalty_pos_before() from public, anon, authenticated;
revoke all on function public.loyalty_pos_after() from public, anon, authenticated;
revoke all on function public.loyalty_appointment_after() from public, anon, authenticated;
revoke all on function public.loyalty_edit_after() from public, anon, authenticated;

revoke all on function public.loyalty_attach_reward(uuid, uuid) from public, anon;
grant execute on function public.loyalty_attach_reward(uuid, uuid) to authenticated;

revoke all on function public.pos_save_cart_with_reward(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, numeric, uuid) from public, anon;
grant execute on function public.pos_save_cart_with_reward(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, numeric, uuid) to authenticated;

revoke all on function public.loyalty_save_program(text, text, boolean, int, text, jsonb) from public, anon;
grant execute on function public.loyalty_save_program(text, text, boolean, int, text, jsonb) to authenticated;

revoke all on function public.loyalty_save_reward(uuid, text, text, text, int, uuid, numeric, boolean, boolean, int) from public, anon;
grant execute on function public.loyalty_save_reward(uuid, text, text, text, int, uuid, numeric, boolean, boolean, int) to authenticated;

revoke all on function public.loyalty_set_reward_active(uuid, boolean) from public, anon;
grant execute on function public.loyalty_set_reward_active(uuid, boolean) to authenticated;

revoke all on function public.loyalty_client_rewards(uuid) from public, anon;
grant execute on function public.loyalty_client_rewards(uuid) to authenticated;
