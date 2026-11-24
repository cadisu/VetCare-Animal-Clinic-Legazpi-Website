-- Phase 12: Senior Vet user administration and an append-only audit log.
-- Run after 20261029000000_phase10_analytics.sql.
--
-- Deactivation changes profiles.status only. Appointments, bills, clinical
-- rows, and older audit rows stay. Existing clinical, POS, inventory, loyalty,
-- and appointment functions are not replaced. Triggers record the action after
-- those writes succeed.

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete restrict,
  action       text not null check (char_length(action) between 1 and 80),
  entity_type  text not null check (char_length(entity_type) between 1 and 80),
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only record of important clinic actions. Metadata is short and must not contain clinical notes or secrets.';

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_senior_vet" on public.audit_logs;
create policy "audit_logs_select_senior_vet"
  on public.audit_logs
  for select
  to authenticated
  using (public.current_user_role() = 'SENIOR_VET');

revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.protect_audit_log()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Audit logs cannot be changed';
end;
$$;

drop trigger if exists audit_logs_no_change on public.audit_logs;
create trigger audit_logs_no_change
  before update or delete on public.audit_logs
  for each row execute function public.protect_audit_log();

-- Called only from other database functions and triggers.
create or replace function public.write_audit_log(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.assert_senior_vet()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Not authorized';
  end if;
end;
$$;

revoke all on function public.assert_senior_vet() from public, anon, authenticated;

-- The function owner must be able to call these from the other security-definer
-- functions. Granting to current_user covers the SQL editor role, which is not
-- always postgres.
do $grant$
begin
  execute format(
    'grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to postgres, service_role, %I',
    current_user
  );
  execute format(
    'grant execute on function public.assert_senior_vet() to postgres, service_role, %I',
    current_user
  );
end
$grant$;

-- ---------- User administration ----------

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_contact_number text,
  p_address text,
  p_birthdate date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_first text := left(btrim(coalesce(p_first_name, '')), 60);
  v_last text := left(btrim(coalesce(p_last_name, '')), 60);
  v_middle text := nullif(left(btrim(coalesce(p_middle_name, '')), 60), '');
  v_contact text := nullif(btrim(coalesce(p_contact_number, '')), '');
  v_address text := nullif(left(btrim(coalesce(p_address, '')), 255), '');
  v_changes jsonb := '[]'::jsonb;
begin
  perform public.assert_senior_vet();
  if char_length(v_first) < 1 or char_length(v_last) < 1 then
    raise exception 'Enter a first and last name';
  end if;
  if v_contact is null or v_contact !~ '^09[0-9]{9}$' then
    raise exception 'Enter a valid contact number';
  end if;

  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  if v_row.role = 'CLIENT' then
    if v_address is null or char_length(v_address) < 5 then
      raise exception 'Enter a complete address';
    end if;
    if p_birthdate is null
       or p_birthdate < date '1900-01-01'
       or p_birthdate > (timezone('Asia/Manila', now()))::date then
      raise exception 'Enter a valid birthdate';
    end if;
  end if;

  if v_row.first_name is distinct from v_first then
    v_changes := v_changes || jsonb_build_array('first_name');
  end if;
  if v_row.middle_name is distinct from v_middle then
    v_changes := v_changes || jsonb_build_array('middle_name');
  end if;
  if v_row.last_name is distinct from v_last then
    v_changes := v_changes || jsonb_build_array('last_name');
  end if;
  if v_row.contact_number is distinct from v_contact then
    v_changes := v_changes || jsonb_build_array('contact_number');
  end if;

  if v_row.role = 'CLIENT' then
    if v_row.address is distinct from v_address then
      v_changes := v_changes || jsonb_build_array('address');
    end if;
    if v_row.birthdate is distinct from p_birthdate then
      v_changes := v_changes || jsonb_build_array('birthdate');
    end if;
    update public.profiles
    set first_name = v_first,
        middle_name = v_middle,
        last_name = v_last,
        contact_number = v_contact,
        address = v_address,
        birthdate = p_birthdate
    where id = p_user_id;
  else
    update public.profiles
    set first_name = v_first,
        middle_name = v_middle,
        last_name = v_last,
        contact_number = v_contact
    where id = p_user_id;
  end if;

  perform public.write_audit_log(
    auth.uid(),
    'user_updated',
    'profile',
    p_user_id,
    jsonb_build_object('role', v_row.role, 'fields', v_changes)
  );
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_remaining int;
begin
  perform public.assert_senior_vet();
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status';
  end if;
  if p_status is null or p_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Choose an account status';
  end if;

  perform 1 from public.profiles
  where role = 'SENIOR_VET' and status = 'ACTIVE'
  for update;

  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_row.status = p_status then
    return;
  end if;

  if p_status = 'INACTIVE' and v_row.role = 'SENIOR_VET' then
    select count(*)::int into v_remaining
    from public.profiles
    where role = 'SENIOR_VET' and status = 'ACTIVE' and id <> p_user_id;
    if v_remaining = 0 then
      raise exception 'The clinic must keep at least one active Senior Vet';
    end if;
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  perform public.write_audit_log(
    auth.uid(),
    case when p_status = 'INACTIVE' then 'user_deactivated' else 'user_reactivated' end,
    'profile',
    p_user_id,
    jsonb_build_object('role', v_row.role, 'status', p_status)
  );
end;
$$;

create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_remaining int;
begin
  perform public.assert_senior_vet();
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if p_role is null or p_role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  perform 1 from public.profiles
  where role = 'SENIOR_VET' and status = 'ACTIVE'
  for update;

  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_row.role = 'CLIENT' then
    raise exception 'Client accounts cannot change role';
  end if;
  if v_row.role = p_role then
    return;
  end if;

  if v_row.role = 'SENIOR_VET' and p_role is distinct from 'SENIOR_VET' then
    select count(*)::int into v_remaining
    from public.profiles
    where role = 'SENIOR_VET' and status = 'ACTIVE' and id <> p_user_id;
    if v_remaining = 0 then
      raise exception 'The clinic must keep at least one active Senior Vet';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  perform public.write_audit_log(
    auth.uid(),
    'role_changed',
    'profile',
    p_user_id,
    jsonb_build_object('from_role', v_row.role, 'to_role', p_role)
  );
end;
$$;

create or replace function public.audit_user_created(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  perform public.assert_senior_vet();
  if p_role is null or p_role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role is distinct from p_role then
    raise exception 'Account not found';
  end if;

  perform public.write_audit_log(
    auth.uid(),
    'user_created',
    'profile',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text, text, text, text, date) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text, text, text, text, date) to authenticated;

revoke all on function public.admin_set_account_status(uuid, public.account_status) from public, anon;
grant execute on function public.admin_set_account_status(uuid, public.account_status) to authenticated;

revoke all on function public.admin_set_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;

revoke all on function public.audit_user_created(uuid, public.user_role) from public, anon;
grant execute on function public.audit_user_created(uuid, public.user_role) to authenticated;

-- ---------- Triggers on existing records ----------

create or replace function public.audit_clinical_record_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    new.recorded_by,
    case when new.revision = 1 then 'clinical_record_created' else 'clinical_record_edited' end,
    'clinical_record',
    new.id,
    jsonb_build_object(
      'pet_id', new.pet_id,
      'appointment_id', new.appointment_id,
      'lineage_id', new.lineage_id,
      'revision', new.revision
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_clinical_records on public.clinical_records;
create trigger audit_clinical_records
  after insert on public.clinical_records
  for each row execute function public.audit_clinical_record_insert();

create or replace function public.audit_vaccination_record_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    new.recorded_by,
    case when new.revision = 1 then 'vaccination_created' else 'vaccination_edited' end,
    'vaccination_record',
    new.id,
    jsonb_build_object(
      'pet_id', new.pet_id,
      'appointment_id', new.appointment_id,
      'lineage_id', new.lineage_id,
      'revision', new.revision
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_vaccination_records on public.vaccination_records;
create trigger audit_vaccination_records
  after insert on public.vaccination_records
  for each row execute function public.audit_vaccination_record_insert();

create or replace function public.audit_appointment_slot_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.capacity is not distinct from old.capacity
     and new.is_blocked is not distinct from old.is_blocked then
    return new;
  end if;

  perform public.write_audit_log(
    auth.uid(),
    'appointment_slot_changed',
    'appointment_slot',
    new.id,
    jsonb_build_object(
      'slot_date', new.slot_date,
      'capacity', new.capacity,
      'previous_capacity', old.capacity,
      'is_blocked', new.is_blocked,
      'previous_is_blocked', old.is_blocked
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_appointment_slots on public.appointment_slots;
create trigger audit_appointment_slots
  after update on public.appointment_slots
  for each row execute function public.audit_appointment_slot_update();

create or replace function public.audit_appointment_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.new_status is distinct from 'CANCELLED' then
    return new;
  end if;

  perform public.write_audit_log(
    new.actor_id,
    'appointment_cancelled',
    'appointment',
    new.appointment_id,
    jsonb_build_object('previous_status', new.previous_status)
  );
  return new;
end;
$$;

drop trigger if exists audit_appointment_cancellations on public.appointment_status_events;
create trigger audit_appointment_cancellations
  after insert on public.appointment_status_events
  for each row execute function public.audit_appointment_cancellation();

create or replace function public.audit_inventory_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.movement_type::text not in ('ADJUSTMENT', 'STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'MISSING', 'EXPIRED') then
    return new;
  end if;

  perform public.write_audit_log(
    new.created_by,
    'inventory_adjusted',
    'product',
    new.product_id,
    jsonb_build_object(
      'movement_id', new.id,
      'movement_type', new.movement_type,
      'quantity_delta', new.quantity_delta
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_inventory_adjustments on public.product_stock_movements;
create trigger audit_inventory_adjustments
  after insert on public.product_stock_movements
  for each row execute function public.audit_inventory_adjustment();

create or replace function public.audit_loyalty_program_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    auth.uid(),
    'loyalty_configuration_changed',
    'loyalty_program',
    new.id,
    jsonb_build_object(
      'kind', 'program',
      'stamp_limit', new.stamp_limit,
      'is_active', new.is_active,
      'cycle_policy', new.cycle_policy
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_loyalty_programs on public.loyalty_programs;
create trigger audit_loyalty_programs
  after insert or update on public.loyalty_programs
  for each row execute function public.audit_loyalty_program_change();

create or replace function public.audit_loyalty_reward_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    auth.uid(),
    'loyalty_configuration_changed',
    'loyalty_reward',
    new.id,
    jsonb_build_object(
      'kind', 'reward',
      'program_id', new.program_id,
      'milestone_stamps', new.milestone_stamps,
      'reward_type', new.reward_type,
      'is_active', new.is_active
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_loyalty_rewards on public.loyalty_rewards;
create trigger audit_loyalty_rewards
  after insert or update on public.loyalty_rewards
  for each row execute function public.audit_loyalty_reward_change();

create or replace function public.audit_loyalty_redemption_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'APPLIED' then
    return new;
  end if;

  perform public.write_audit_log(
    coalesce(new.redeemed_by, auth.uid()),
    'reward_redeemed',
    'loyalty_redemption',
    new.id,
    jsonb_build_object('grant_id', new.grant_id, 'transaction_id', new.transaction_id)
  );
  return new;
end;
$$;

drop trigger if exists audit_loyalty_redemptions on public.loyalty_redemptions;
create trigger audit_loyalty_redemptions
  after insert on public.loyalty_redemptions
  for each row execute function public.audit_loyalty_redemption_insert();

create or replace function public.audit_pos_transaction_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status or new.status not in ('COMPLETED', 'VOIDED') then
    return new;
  end if;

  perform public.write_audit_log(
    case
      when new.status = 'VOIDED' then coalesce(new.voided_by, auth.uid())
      else coalesce(new.processed_by, auth.uid())
    end,
    case when new.status = 'VOIDED' then 'pos_voided' else 'pos_completed' end,
    'pos_transaction',
    new.id,
    jsonb_build_object('reference', new.reference, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_pos_transactions on public.pos_transactions;
create trigger audit_pos_transactions
  after update on public.pos_transactions
  for each row execute function public.audit_pos_transaction_update();

revoke all on function public.audit_clinical_record_insert() from public, anon;
grant execute on function public.audit_clinical_record_insert() to authenticated;

revoke all on function public.audit_vaccination_record_insert() from public, anon;
grant execute on function public.audit_vaccination_record_insert() to authenticated;

revoke all on function public.audit_appointment_slot_update() from public, anon;
grant execute on function public.audit_appointment_slot_update() to authenticated;

revoke all on function public.audit_appointment_cancellation() from public, anon;
grant execute on function public.audit_appointment_cancellation() to authenticated;

revoke all on function public.audit_inventory_adjustment() from public, anon;
grant execute on function public.audit_inventory_adjustment() to authenticated;

revoke all on function public.audit_loyalty_program_change() from public, anon;
grant execute on function public.audit_loyalty_program_change() to authenticated;

revoke all on function public.audit_loyalty_reward_change() from public, anon;
grant execute on function public.audit_loyalty_reward_change() to authenticated;

revoke all on function public.audit_loyalty_redemption_insert() from public, anon;
grant execute on function public.audit_loyalty_redemption_insert() to authenticated;

revoke all on function public.audit_pos_transaction_update() from public, anon;
grant execute on function public.audit_pos_transaction_update() to authenticated;
