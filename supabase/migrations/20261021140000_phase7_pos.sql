-- Phase 7: point of sale
-- Run AFTER 20261021000000_phase6_clinic_date.sql.
--
-- Staff and Senior Vet record what was sold and the amount paid at the
-- counter. There is no online payment. Completing a bill does not change
-- the appointment status, and completing an appointment does not pay a bill.
-- Discount and reward stay 0 until the loyalty phase. Stock falls only when
-- a bill is completed, and a void puts it back. Completed rows are not deleted.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_transaction_status') then
    create type public.pos_transaction_status as enum ('OPEN', 'COMPLETED', 'VOIDED');
  end if;
  if not exists (select 1 from pg_type where typname = 'pos_item_type') then
    create type public.pos_item_type as enum ('SERVICE', 'PRODUCT');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_stock_movement_type') then
    create type public.product_stock_movement_type as enum ('POS_SALE', 'POS_VOID');
  end if;
end $$;

create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  unit              text not null check (char_length(btrim(unit)) between 1 and 40),
  price             numeric(12, 2) not null check (price >= 0),
  quantity_on_hand  int not null default 0 check (quantity_on_hand >= 0 and quantity_on_hand <= 1000000),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.products is
  'Sellable clinic products for POS. Opening quantity is set here. Later stock changes come from a completed or voided bill. Full inventory management is a later phase.';

create unique index if not exists products_name_unique on public.products (lower(btrim(name)));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.pos_transactions (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique check (reference ~ '^VC-[0-9]{8}-[0-9]{4}$'),
  client_id        uuid not null references public.profiles (id) on delete restrict,
  pet_id           uuid references public.pets (id) on delete restrict,
  appointment_id   uuid references public.appointments (id) on delete restrict,
  status           public.pos_transaction_status not null default 'OPEN',
  subtotal         numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_amount  numeric(12, 2) not null default 0 check (discount_amount = 0),
  reward_amount    numeric(12, 2) not null default 0 check (reward_amount = 0),
  total            numeric(12, 2) not null default 0 check (total >= 0),
  amount_paid      numeric(12, 2) check (amount_paid is null or amount_paid >= 0),
  created_by       uuid not null references public.profiles (id) on delete restrict,
  processed_by     uuid references public.profiles (id) on delete restrict,
  completed_at     timestamptz,
  voided_by        uuid references public.profiles (id) on delete restrict,
  voided_at        timestamptz,
  void_reason      text check (void_reason is null or char_length(btrim(void_reason)) between 3 and 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint pos_transactions_total_matches check (total = subtotal - discount_amount - reward_amount),
  constraint pos_transactions_status_shape check (
    (
      status = 'OPEN'
      and amount_paid is null
      and processed_by is null
      and completed_at is null
      and voided_by is null
      and voided_at is null
      and void_reason is null
    )
    or (
      status = 'COMPLETED'
      and amount_paid = total
      and processed_by is not null
      and completed_at is not null
      and voided_by is null
      and voided_at is null
      and void_reason is null
    )
    or (
      status = 'VOIDED'
      and voided_by is not null
      and voided_at is not null
      and void_reason is not null
    )
  )
);

comment on table public.pos_transactions is
  'Counter bills. amount_paid is the amount recorded when the client pays at the desk. It is not an online charge. Appointment status is stored separately.';

comment on column public.pos_transactions.discount_amount is
  'Reserved for a later loyalty phase. Phase 7 keeps this at 0.';
comment on column public.pos_transactions.reward_amount is
  'Reserved for a later loyalty phase. Phase 7 keeps this at 0.';

create unique index if not exists pos_transactions_one_open_appointment
  on public.pos_transactions (appointment_id)
  where status = 'OPEN' and appointment_id is not null;

create index if not exists pos_transactions_client_created_idx
  on public.pos_transactions (client_id, created_at desc);
create index if not exists pos_transactions_status_created_idx
  on public.pos_transactions (status, created_at desc);
create index if not exists pos_transactions_appointment_idx
  on public.pos_transactions (appointment_id);

drop trigger if exists pos_transactions_set_updated_at on public.pos_transactions;
create trigger pos_transactions_set_updated_at
  before update on public.pos_transactions
  for each row execute function public.set_updated_at();

create table if not exists public.pos_transaction_items (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.pos_transactions (id) on delete restrict,
  item_type       public.pos_item_type not null,
  service_id      uuid references public.services (id) on delete restrict,
  product_id      uuid references public.products (id) on delete restrict,
  appointment_id  uuid references public.appointments (id) on delete restrict,
  description     text not null check (char_length(btrim(description)) between 1 and 120),
  quantity        int not null check (quantity between 1 and 999),
  unit_price      numeric(12, 2) not null check (unit_price >= 0),
  subtotal        numeric(12, 2) not null check (subtotal >= 0),
  created_at      timestamptz not null default now(),
  constraint pos_transaction_items_kind check (
    (
      item_type = 'SERVICE'
      and service_id is not null
      and product_id is null
      and appointment_id is not null
    )
    or (
      item_type = 'PRODUCT'
      and product_id is not null
      and service_id is null
      and appointment_id is null
    )
  ),
  constraint pos_transaction_items_subtotal check (subtotal = round(unit_price * quantity, 2))
);

create index if not exists pos_transaction_items_transaction_idx
  on public.pos_transaction_items (transaction_id, created_at);
create index if not exists pos_transaction_items_service_visit_idx
  on public.pos_transaction_items (appointment_id, service_id)
  where item_type = 'SERVICE';

create table if not exists public.product_stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete restrict,
  transaction_id  uuid not null references public.pos_transactions (id) on delete restrict,
  movement_type   public.product_stock_movement_type not null,
  quantity_delta  int not null check (quantity_delta <> 0),
  created_by      uuid not null references public.profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  constraint product_stock_movements_sign check (
    (movement_type = 'POS_SALE' and quantity_delta < 0)
    or (movement_type = 'POS_VOID' and quantity_delta > 0)
  )
);

comment on table public.product_stock_movements is
  'POS stock history. POS_SALE reduces quantity when a bill is completed. POS_VOID restores it. Rows are not edited or deleted.';

create index if not exists product_stock_movements_product_idx
  on public.product_stock_movements (product_id, created_at desc);
create index if not exists product_stock_movements_transaction_idx
  on public.product_stock_movements (transaction_id);

-- ---------- guards ----------

create or replace function public.pos_write_allowed()
returns boolean
language sql
stable
as $$
  select current_setting('app.pos_write', true) = 'on';
$$;

create or replace function public.pos_assert_staff()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  v_role := public.current_user_role();
  if auth.uid() is null or v_role is null or v_role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;
end;
$$;

create or replace function public.protect_product()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Products cannot be deleted';
  end if;
  if not public.pos_write_allowed() then
    raise exception 'Products cannot be changed directly';
  end if;
  if tg_op = 'UPDATE' and new.quantity_on_hand is distinct from old.quantity_on_hand then
    if current_setting('app.pos_stock', true) = 'on' then
      return new;
    end if;
    if current_setting('app.pos_opening_stock', true) = 'on'
       and not exists (
         select 1 from public.product_stock_movements m where m.product_id = old.id
       ) then
      return new;
    end if;
    raise exception 'Stock can only change when a bill is completed or voided';
  end if;
  return new;
end;
$$;

drop trigger if exists products_protect on public.products;
create trigger products_protect
  before insert or update or delete on public.products
  for each row execute function public.protect_product();

create or replace function public.protect_pos_transaction()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Completed transactions cannot be deleted';
  end if;
  if tg_op = 'INSERT' then
    if not public.pos_write_allowed() then
      raise exception 'Transactions cannot be changed directly';
    end if;
    return new;
  end if;
  if not public.pos_write_allowed() then
    raise exception 'Transactions cannot be changed directly';
  end if;

  if new.client_id is distinct from old.client_id
     or new.pet_id is distinct from old.pet_id
     or new.appointment_id is distinct from old.appointment_id
     or new.reference is distinct from old.reference
     or new.created_by is distinct from old.created_by
     or new.discount_amount <> 0
     or new.reward_amount <> 0
     or new.discount_amount is distinct from old.discount_amount
     or new.reward_amount is distinct from old.reward_amount then
    raise exception 'This bill can no longer be changed';
  end if;

  if new.status = old.status and old.status = 'OPEN' then
    if new.amount_paid is not null
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
       or new.processed_by is null
       or new.completed_at is null
       or new.voided_by is not null
       or new.voided_at is not null
       or new.void_reason is not null then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if old.status = 'OPEN' and new.status = 'VOIDED' then
    if new.amount_paid is not null
       or new.processed_by is not null
       or new.completed_at is not null
       or new.voided_by is null
       or new.voided_at is null
       or new.void_reason is null
       or new.subtotal is distinct from old.subtotal
       or new.total is distinct from old.total then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  if old.status = 'COMPLETED' and new.status = 'VOIDED' then
    if new.amount_paid is distinct from old.amount_paid
       or new.subtotal is distinct from old.subtotal
       or new.total is distinct from old.total
       or new.processed_by is distinct from old.processed_by
       or new.completed_at is distinct from old.completed_at
       or new.voided_by is null
       or new.voided_at is null
       or new.void_reason is null then
      raise exception 'This bill can no longer be changed';
    end if;
    return new;
  end if;

  raise exception 'This bill can no longer be changed';
end;
$$;

drop trigger if exists pos_transactions_protect on public.pos_transactions;
create trigger pos_transactions_protect
  before insert or update or delete on public.pos_transactions
  for each row execute function public.protect_pos_transaction();

create or replace function public.protect_pos_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.pos_transaction_status;
  v_txn uuid;
begin
  if not public.pos_write_allowed() then
    raise exception 'Transactions cannot be changed directly';
  end if;
  v_txn := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
  select status into v_status from public.pos_transactions where id = v_txn;
  if v_status is distinct from 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;
  if tg_op = 'UPDATE' then
    if new.transaction_id is distinct from old.transaction_id
       or new.item_type is distinct from old.item_type
       or new.service_id is distinct from old.service_id
       or new.product_id is distinct from old.product_id
       or new.appointment_id is distinct from old.appointment_id
       or new.description is distinct from old.description
       or new.unit_price is distinct from old.unit_price then
      raise exception 'This bill can no longer be changed';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists pos_transaction_items_protect on public.pos_transaction_items;
create trigger pos_transaction_items_protect
  before insert or update or delete on public.pos_transaction_items
  for each row execute function public.protect_pos_item();

create or replace function public.protect_product_stock_movement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Stock history cannot be modified';
  end if;
  if current_setting('app.pos_stock', true) is distinct from 'on' then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type = 'POS_SALE' and new.quantity_delta >= 0 then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type = 'POS_VOID' and new.quantity_delta <= 0 then
    raise exception 'Stock history cannot be modified';
  end if;
  return new;
end;
$$;

drop trigger if exists product_stock_movements_protect on public.product_stock_movements;
create trigger product_stock_movements_protect
  before insert or update or delete on public.product_stock_movements
  for each row execute function public.protect_product_stock_movement();

-- ---------- internal helpers ----------

create or replace function public.pos_assert_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_client_id and role = 'CLIENT' and status = 'ACTIVE'
  ) then
    raise exception 'Client not found';
  end if;
end;
$$;

create or replace function public.pos_next_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day text;
  v_seq int;
begin
  v_day := to_char((timezone('Asia/Manila', now()))::date, 'YYYYMMDD');
  perform pg_advisory_xact_lock(hashtext('vetcare-pos-' || v_day)::bigint);
  select coalesce(max(right(reference, 4)::int), 0) + 1
    into v_seq
  from public.pos_transactions
  where reference like 'VC-' || v_day || '-%';
  if v_seq > 9999 then
    raise exception 'Transaction reference is unavailable';
  end if;
  return 'VC-' || v_day || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

create or replace function public.pos_recalculate(p_transaction_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2);
begin
  select coalesce(round(sum(subtotal), 2), 0)
    into v_subtotal
  from public.pos_transaction_items
  where transaction_id = p_transaction_id;

  update public.pos_transactions
  set subtotal = v_subtotal,
      discount_amount = 0,
      reward_amount = 0,
      total = v_subtotal
  where id = p_transaction_id;

  return v_subtotal;
end;
$$;

create or replace function public.pos_service_already_billed(
  p_appointment_id uuid,
  p_service_id uuid,
  p_except_transaction_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.pos_transaction_items i
    join public.pos_transactions t on t.id = i.transaction_id
    where i.item_type = 'SERVICE'
      and i.appointment_id = p_appointment_id
      and i.service_id = p_service_id
      and t.status <> 'VOIDED'
      and (p_except_transaction_id is null or t.id <> p_except_transaction_id)
  );
end;
$$;

-- ---------- products ----------

create or replace function public.upsert_product(
  p_product_id uuid,
  p_name text,
  p_unit text,
  p_price numeric,
  p_quantity_on_hand int,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_unit text;
  v_price numeric(12, 2);
  v_qty int;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can manage products';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_unit := btrim(coalesce(p_unit, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Enter a product name';
  end if;
  if char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    raise exception 'Enter a unit';
  end if;
  if p_price is null or p_price < 0 or p_price > 9999999999.99 then
    raise exception 'Enter a valid price';
  end if;
  v_price := round(p_price, 2);
  if p_quantity_on_hand is null or p_quantity_on_hand < 0 or p_quantity_on_hand > 1000000 then
    raise exception 'Enter a valid quantity';
  end if;
  v_qty := p_quantity_on_hand;

  perform set_config('app.pos_write', 'on', true);

  if p_product_id is null then
    insert into public.products (name, unit, price, quantity_on_hand, is_active)
    values (v_name, v_unit, v_price, v_qty, coalesce(p_is_active, true))
    returning id into v_id;
    return v_id;
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'This product is not available';
  end if;

  if exists (select 1 from public.product_stock_movements where product_id = p_product_id) then
    update public.products
    set name = v_name,
        unit = v_unit,
        price = v_price,
        is_active = coalesce(p_is_active, true)
    where id = p_product_id;
  else
    perform set_config('app.pos_opening_stock', 'on', true);
    update public.products
    set name = v_name,
        unit = v_unit,
        price = v_price,
        quantity_on_hand = v_qty,
        is_active = coalesce(p_is_active, true)
    where id = p_product_id;
  end if;

  return p_product_id;
exception
  when unique_violation then
    raise exception 'A product with this name already exists';
end;
$$;

-- ---------- open a bill ----------

create or replace function public.pos_open_for_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_pet uuid;
  v_status public.appointment_status;
  v_service uuid;
  v_price numeric(12, 2);
  v_name text;
  v_active boolean;
  v_id uuid;
  v_subtotal numeric(12, 2);
begin
  perform public.pos_assert_staff();

  select client_id, pet_id, status, service_id
    into v_client, v_pet, v_status, v_service
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_status not in ('IN_CONSULTATION', 'COMPLETED') then
    raise exception 'This visit cannot be billed yet';
  end if;
  perform public.pos_assert_client(v_client);
  if not exists (
    select 1 from public.pets where id = v_pet and owner_id = v_client
  ) then
    raise exception 'Pet not found';
  end if;

  select id into v_id
  from public.pos_transactions
  where appointment_id = p_appointment_id and status = 'OPEN'
  for update;

  if v_id is not null then
    return v_id;
  end if;

  perform set_config('app.pos_write', 'on', true);

  insert into public.pos_transactions (
    reference, client_id, pet_id, appointment_id, status, created_by
  )
  values (
    public.pos_next_reference(), v_client, v_pet, p_appointment_id, 'OPEN', auth.uid()
  )
  returning id into v_id;

  select name, price, is_active
    into v_name, v_price, v_active
  from public.services
  where id = v_service;

  if v_active and v_price is not null
     and not public.pos_service_already_billed(p_appointment_id, v_service, null) then
    v_subtotal := round(round(v_price, 2) * 1, 2);
    insert into public.pos_transaction_items (
      transaction_id, item_type, service_id, appointment_id, description, quantity, unit_price, subtotal
    )
    values (
      v_id, 'SERVICE', v_service, p_appointment_id, v_name, 1, round(v_price, 2), v_subtotal
    );
    perform public.pos_recalculate(v_id);
  end if;

  return v_id;
end;
$$;

create or replace function public.pos_open_counter_sale(p_client_id uuid, p_pet_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.pos_assert_staff();
  perform public.pos_assert_client(p_client_id);

  if p_pet_id is not null then
    if not exists (
      select 1 from public.pets
      where id = p_pet_id and owner_id = p_client_id and is_archived = false
    ) then
      raise exception 'Choose a pet that belongs to this client';
    end if;
  end if;

  perform set_config('app.pos_write', 'on', true);

  insert into public.pos_transactions (
    reference, client_id, pet_id, appointment_id, status, created_by
  )
  values (
    public.pos_next_reference(), p_client_id, p_pet_id, null, 'OPEN', auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------- line items ----------

create or replace function public.pos_add_service_item(
  p_transaction_id uuid,
  p_service_id uuid,
  p_quantity int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_name text;
  v_price numeric(12, 2);
  v_active boolean;
  v_unit numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_id uuid;
begin
  perform public.pos_assert_staff();
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Enter a valid quantity';
  end if;

  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.status <> 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;
  if v_txn.appointment_id is null then
    raise exception 'This service must be billed on a visit';
  end if;

  select name, price, is_active into v_name, v_price, v_active
  from public.services where id = p_service_id;
  if not found or not v_active then
    raise exception 'This service is not available';
  end if;
  if v_price is null then
    raise exception 'Set a price for this service before adding it';
  end if;
  if public.pos_service_already_billed(v_txn.appointment_id, p_service_id, null) then
    raise exception 'This service is already on a bill for this visit';
  end if;

  v_unit := round(v_price, 2);
  v_subtotal := round(v_unit * p_quantity, 2);
  perform set_config('app.pos_write', 'on', true);

  insert into public.pos_transaction_items (
    transaction_id, item_type, service_id, appointment_id, description, quantity, unit_price, subtotal
  )
  values (
    p_transaction_id, 'SERVICE', p_service_id, v_txn.appointment_id, v_name, p_quantity, v_unit, v_subtotal
  )
  returning id into v_id;

  perform public.pos_recalculate(p_transaction_id);
  return v_id;
end;
$$;

create or replace function public.pos_add_product_item(
  p_transaction_id uuid,
  p_product_id uuid,
  p_quantity int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_name text;
  v_price numeric(12, 2);
  v_active boolean;
  v_stock int;
  v_existing_id uuid;
  v_existing_qty int;
  v_next int;
  v_unit numeric(12, 2);
  v_id uuid;
begin
  perform public.pos_assert_staff();
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Enter a valid quantity';
  end if;

  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.status <> 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;

  select name, price, is_active, quantity_on_hand
    into v_name, v_price, v_active, v_stock
  from public.products
  where id = p_product_id
  for update;

  if not found or not v_active then
    raise exception 'This product is not available';
  end if;

  select id, quantity into v_existing_id, v_existing_qty
  from public.pos_transaction_items
  where transaction_id = p_transaction_id and product_id = p_product_id
  for update;

  v_next := coalesce(v_existing_qty, 0) + p_quantity;
  if v_next > 999 then
    raise exception 'Enter a valid quantity';
  end if;
  if v_next > v_stock then
    raise exception 'Not enough stock';
  end if;

  perform set_config('app.pos_write', 'on', true);
  v_unit := round(v_price, 2);

  if v_existing_id is not null then
    update public.pos_transaction_items
    set quantity = v_next,
        subtotal = round(unit_price * v_next, 2)
    where id = v_existing_id;
    v_id := v_existing_id;
  else
    insert into public.pos_transaction_items (
      transaction_id, item_type, product_id, description, quantity, unit_price, subtotal
    )
    values (
      p_transaction_id,
      'PRODUCT',
      p_product_id,
      v_name,
      p_quantity,
      v_unit,
      round(v_unit * p_quantity, 2)
    )
    returning id into v_id;
  end if;

  perform public.pos_recalculate(p_transaction_id);
  return v_id;
end;
$$;

create or replace function public.pos_set_item_quantity(p_item_id uuid, p_quantity int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.pos_transaction_items;
  v_status public.pos_transaction_status;
  v_stock int;
begin
  perform public.pos_assert_staff();
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Enter a valid quantity';
  end if;

  select * into v_item from public.pos_transaction_items where id = p_item_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;

  select status into v_status from public.pos_transactions where id = v_item.transaction_id for update;
  if v_status is distinct from 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;

  if v_item.item_type = 'PRODUCT' then
    select quantity_on_hand into v_stock from public.products where id = v_item.product_id for update;
    if v_stock is null or p_quantity > v_stock then
      raise exception 'Not enough stock';
    end if;
  end if;

  perform set_config('app.pos_write', 'on', true);
  update public.pos_transaction_items
  set quantity = p_quantity,
      subtotal = round(unit_price * p_quantity, 2)
  where id = p_item_id;

  perform public.pos_recalculate(v_item.transaction_id);
end;
$$;

create or replace function public.pos_remove_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn uuid;
  v_status public.pos_transaction_status;
begin
  perform public.pos_assert_staff();
  select transaction_id into v_txn from public.pos_transaction_items where id = p_item_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  select status into v_status from public.pos_transactions where id = v_txn for update;
  if v_status is distinct from 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;

  perform set_config('app.pos_write', 'on', true);
  delete from public.pos_transaction_items where id = p_item_id;
  perform public.pos_recalculate(v_txn);
end;
$$;

-- ---------- pay and void ----------

create or replace function public.pos_complete_transaction(p_transaction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_total numeric(12, 2);
  v_item record;
begin
  perform public.pos_assert_staff();
  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.status <> 'OPEN' then
    raise exception 'This bill can no longer be changed';
  end if;
  if not exists (
    select 1 from public.pos_transaction_items where transaction_id = p_transaction_id
  ) then
    raise exception 'Add at least one item before recording payment';
  end if;

  if exists (
    select 1
    from public.pos_transaction_items mine
    join public.pos_transaction_items other
      on other.item_type = 'SERVICE'
     and other.appointment_id = mine.appointment_id
     and other.service_id = mine.service_id
     and other.id <> mine.id
    join public.pos_transactions ot on ot.id = other.transaction_id
    where mine.transaction_id = p_transaction_id
      and mine.item_type = 'SERVICE'
      and ot.status <> 'VOIDED'
  ) then
    raise exception 'This service is already on a bill for this visit';
  end if;

  perform set_config('app.pos_write', 'on', true);
  v_total := public.pos_recalculate(p_transaction_id);

  perform set_config('app.pos_stock', 'on', true);
  for v_item in
    select product_id, sum(quantity)::int as qty
    from public.pos_transaction_items
    where transaction_id = p_transaction_id and item_type = 'PRODUCT'
    group by product_id
    order by product_id
  loop
    update public.products
    set quantity_on_hand = quantity_on_hand - v_item.qty
    where id = v_item.product_id
      and quantity_on_hand >= v_item.qty;
    if not found then
      raise exception 'Not enough stock';
    end if;
    insert into public.product_stock_movements (
      product_id, transaction_id, movement_type, quantity_delta, created_by
    )
    values (v_item.product_id, p_transaction_id, 'POS_SALE', -v_item.qty, auth.uid());
  end loop;

  update public.pos_transactions
  set status = 'COMPLETED',
      amount_paid = v_total,
      processed_by = auth.uid(),
      completed_at = now()
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

create or replace function public.pos_void_transaction(p_transaction_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_reason text;
  v_role public.user_role;
  v_item record;
begin
  perform public.pos_assert_staff();
  v_role := public.current_user_role();
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Enter a reason for the void';
  end if;

  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_txn.status = 'COMPLETED' and v_role is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can void a completed transaction';
  end if;
  if v_txn.status not in ('OPEN', 'COMPLETED') then
    raise exception 'This bill can no longer be changed';
  end if;

  perform set_config('app.pos_write', 'on', true);

  if v_txn.status = 'COMPLETED' then
    perform set_config('app.pos_stock', 'on', true);
    for v_item in
      select product_id, sum(quantity)::int as qty
      from public.pos_transaction_items
      where transaction_id = p_transaction_id and item_type = 'PRODUCT'
      group by product_id
      order by product_id
    loop
      update public.products
      set quantity_on_hand = quantity_on_hand + v_item.qty
      where id = v_item.product_id;
      if not found then
        raise exception 'This product is not available';
      end if;
      insert into public.product_stock_movements (
        product_id, transaction_id, movement_type, quantity_delta, created_by
      )
      values (v_item.product_id, p_transaction_id, 'POS_VOID', v_item.qty, auth.uid());
    end loop;
  end if;

  update public.pos_transactions
  set status = 'VOIDED',
      voided_by = auth.uid(),
      voided_at = now(),
      void_reason = v_reason
  where id = p_transaction_id;

  return p_transaction_id;
end;
$$;

-- ---------- access ----------

alter table public.products enable row level security;
alter table public.pos_transactions enable row level security;
alter table public.pos_transaction_items enable row level security;
alter table public.product_stock_movements enable row level security;

drop policy if exists "products_select" on public.products;
create policy "products_select"
  on public.products for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "pos_transactions_select" on public.pos_transactions;
create policy "pos_transactions_select"
  on public.pos_transactions for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "pos_transaction_items_select" on public.pos_transaction_items;
create policy "pos_transaction_items_select"
  on public.pos_transaction_items for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "product_stock_movements_select" on public.product_stock_movements;
create policy "product_stock_movements_select"
  on public.product_stock_movements for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

revoke all on public.products from public, anon, authenticated;
revoke all on public.pos_transactions from public, anon, authenticated;
revoke all on public.pos_transaction_items from public, anon, authenticated;
revoke all on public.product_stock_movements from public, anon, authenticated;
grant select on public.products to authenticated;
grant select on public.pos_transactions to authenticated;
grant select on public.pos_transaction_items to authenticated;
grant select on public.product_stock_movements to authenticated;

revoke all on function public.pos_write_allowed() from public, anon, authenticated;
revoke all on function public.pos_assert_staff() from public, anon, authenticated;
revoke all on function public.protect_product() from public, anon, authenticated;
revoke all on function public.protect_pos_transaction() from public, anon, authenticated;
revoke all on function public.protect_pos_item() from public, anon, authenticated;
revoke all on function public.protect_product_stock_movement() from public, anon, authenticated;
revoke all on function public.pos_assert_client(uuid) from public, anon, authenticated;
revoke all on function public.pos_next_reference() from public, anon, authenticated;
revoke all on function public.pos_recalculate(uuid) from public, anon, authenticated;
revoke all on function public.pos_service_already_billed(uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.upsert_product(uuid, text, text, numeric, int, boolean) from public, anon;
grant execute on function public.upsert_product(uuid, text, text, numeric, int, boolean) to authenticated;

revoke all on function public.pos_open_for_appointment(uuid) from public, anon;
grant execute on function public.pos_open_for_appointment(uuid) to authenticated;

revoke all on function public.pos_open_counter_sale(uuid, uuid) from public, anon;
grant execute on function public.pos_open_counter_sale(uuid, uuid) to authenticated;

revoke all on function public.pos_add_service_item(uuid, uuid, int) from public, anon;
grant execute on function public.pos_add_service_item(uuid, uuid, int) to authenticated;

revoke all on function public.pos_add_product_item(uuid, uuid, int) from public, anon;
grant execute on function public.pos_add_product_item(uuid, uuid, int) to authenticated;

revoke all on function public.pos_set_item_quantity(uuid, int) from public, anon;
grant execute on function public.pos_set_item_quantity(uuid, int) to authenticated;

revoke all on function public.pos_remove_item(uuid) from public, anon;
grant execute on function public.pos_remove_item(uuid) to authenticated;

revoke all on function public.pos_complete_transaction(uuid) from public, anon;
grant execute on function public.pos_complete_transaction(uuid) to authenticated;

revoke all on function public.pos_void_transaction(uuid, text) from public, anon;
grant execute on function public.pos_void_transaction(uuid, text) to authenticated;
