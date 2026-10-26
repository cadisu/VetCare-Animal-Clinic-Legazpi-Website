-- Phase 8: inventory batches
-- Run AFTER 20261023000000_phase7_pos_retail.sql.
-- Does not edit earlier migrations. POS_SALE, POS_VOID, POS_EDIT_RESTORE, and
-- ADJUSTMENT stay. A sale still writes one POS_SALE row and does not also
-- write STOCK_OUT. Batch rows record which receipt the units came from.

alter type public.product_stock_movement_type add value if not exists 'STOCK_IN';
alter type public.product_stock_movement_type add value if not exists 'STOCK_OUT';
alter type public.product_stock_movement_type add value if not exists 'DAMAGED';
alter type public.product_stock_movement_type add value if not exists 'MISSING';
alter type public.product_stock_movement_type add value if not exists 'EXPIRED';

alter table public.products
  add column if not exists supplier text,
  add column if not exists unit_cost numeric(12, 2);

alter table public.products drop constraint if exists products_supplier_len;
alter table public.products
  add constraint products_supplier_len
  check (supplier is null or char_length(btrim(supplier)) between 1 and 120);

alter table public.products drop constraint if exists products_unit_cost_range;
alter table public.products
  add constraint products_unit_cost_range
  check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 9999999999.99));

alter table public.product_stock_movements
  add column if not exists batch_id uuid,
  add column if not exists supplier text,
  add column if not exists reference_note text,
  add column if not exists unit_cost numeric(12, 2);

alter table public.product_stock_movements drop constraint if exists product_stock_movements_supplier_len;
alter table public.product_stock_movements
  add constraint product_stock_movements_supplier_len
  check (supplier is null or char_length(btrim(supplier)) between 1 and 120);

alter table public.product_stock_movements drop constraint if exists product_stock_movements_reference_len;
alter table public.product_stock_movements
  add constraint product_stock_movements_reference_len
  check (reference_note is null or char_length(btrim(reference_note)) between 1 and 80);

alter table public.product_stock_movements drop constraint if exists product_stock_movements_unit_cost_range;
alter table public.product_stock_movements
  add constraint product_stock_movements_unit_cost_range
  check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 9999999999.99));

create table if not exists public.product_batches (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products (id) on delete restrict,
  quantity_remaining   int not null check (quantity_remaining >= 0 and quantity_remaining <= 1000000),
  expiration_date      date,
  supplier             text check (supplier is null or char_length(btrim(supplier)) between 1 and 120),
  unit_cost            numeric(12, 2) check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 9999999999.99)),
  received_at          timestamptz not null default now(),
  created_by           uuid references public.profiles (id) on delete restrict,
  created_at           timestamptz not null default now()
);

comment on table public.product_batches is
  'One receipt of a product. Remaining quantity and expiration belong to this batch. The product on-hand total is the sum of these rows.';

create index if not exists product_batches_product_idx
  on public.product_batches (product_id, expiration_date, received_at);

create table if not exists public.product_batch_allocations (
  id           uuid primary key default gen_random_uuid(),
  movement_id  uuid not null references public.product_stock_movements (id) on delete restrict,
  batch_id     uuid not null references public.product_batches (id) on delete restrict,
  quantity     int not null check (quantity > 0 and quantity <= 1000000),
  direction    text not null check (direction in ('OUT', 'IN')),
  created_at   timestamptz not null default now()
);

comment on table public.product_batch_allocations is
  'How a POS sale, void, edit, or adjustment split units across batches. Rows are not edited.';

create index if not exists product_batch_allocations_movement_idx
  on public.product_batch_allocations (movement_id);
create index if not exists product_batch_allocations_batch_idx
  on public.product_batch_allocations (batch_id);

alter table public.product_stock_movements drop constraint if exists product_stock_movements_batch_fk;
alter table public.product_stock_movements
  add constraint product_stock_movements_batch_fk
  foreign key (batch_id) references public.product_batches (id) on delete restrict;

create table if not exists public.clinic_settings (
  id                    int primary key check (id = 1),
  expiry_warning_days   int not null default 30 check (expiry_warning_days between 1 and 365),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete restrict
);

comment on table public.clinic_settings is
  'Clinic-wide inventory settings. expiry_warning_days marks a batch as expiring soon.';

insert into public.clinic_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.product_batches (product_id, quantity_remaining, received_at, created_at)
select id, quantity_on_hand, created_at, created_at
from public.products p
where quantity_on_hand > 0
  and not exists (
    select 1 from public.product_batches b where b.product_id = p.id
  );

-- ---------- helpers ----------

create or replace function public.clinic_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Manila', now()))::date;
$$;

create or replace function public.product_sellable_quantity(p_product_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(quantity_remaining), 0)::int
  from public.product_batches
  where product_id = p_product_id
    and quantity_remaining > 0
    and (expiration_date is null or expiration_date >= public.clinic_today());
$$;

create or replace function public.assert_stock_balanced(p_product_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_on_hand int;
  v_batches int;
begin
  select quantity_on_hand into v_on_hand
  from public.products
  where id = p_product_id;
  select coalesce(sum(quantity_remaining), 0)::int into v_batches
  from public.product_batches
  where product_id = p_product_id;
  if v_on_hand is distinct from v_batches then
    raise exception 'Stock is out of balance';
  end if;
end;
$$;

create or replace function public.allocate_fefo(
  p_movement_id uuid,
  p_product_id uuid,
  p_qty int
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_left int := p_qty;
  v_batch record;
  v_take int;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Enter a valid quantity';
  end if;
  for v_batch in
    select id, quantity_remaining
    from public.product_batches
    where product_id = p_product_id
      and quantity_remaining > 0
      and (expiration_date is null or expiration_date >= public.clinic_today())
    order by expiration_date nulls last, received_at, id
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_batch.quantity_remaining);
    update public.product_batches
    set quantity_remaining = quantity_remaining - v_take
    where id = v_batch.id;
    insert into public.product_batch_allocations (movement_id, batch_id, quantity, direction)
    values (p_movement_id, v_batch.id, v_take, 'OUT');
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'Not enough stock';
  end if;
end;
$$;

create or replace function public.restore_to_opening_batch(
  p_movement_id uuid,
  p_product_id uuid,
  p_qty int
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_batch uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Enter a valid quantity';
  end if;
  select id into v_batch
  from public.product_batches
  where product_id = p_product_id
  order by expiration_date nulls first, received_at, id
  limit 1
  for update;
  if v_batch is null then
    insert into public.product_batches (product_id, quantity_remaining, created_by)
    values (p_product_id, p_qty, auth.uid())
    returning id into v_batch;
  else
    update public.product_batches
    set quantity_remaining = quantity_remaining + p_qty
    where id = v_batch;
  end if;
  insert into public.product_batch_allocations (movement_id, batch_id, quantity, direction)
  values (p_movement_id, v_batch, p_qty, 'IN');
end;
$$;

create or replace function public.restore_transaction_batches(
  p_movement_id uuid,
  p_transaction_id uuid,
  p_product_id uuid,
  p_qty int
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_left int := p_qty;
  v_row record;
  v_take int;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Enter a valid quantity';
  end if;
  for v_row in
    select batch_id, net
    from (
      select a.batch_id,
             sum(case when a.direction = 'OUT' then a.quantity else -a.quantity end)::int as net,
             b.expiration_date,
             b.received_at
      from public.product_batch_allocations a
      join public.product_stock_movements m on m.id = a.movement_id
      join public.product_batches b on b.id = a.batch_id
      where m.transaction_id = p_transaction_id
        and m.product_id = p_product_id
      group by a.batch_id, b.expiration_date, b.received_at
    ) nets
    where net > 0
    order by expiration_date desc nulls first, received_at desc, batch_id desc
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_row.net);
    update public.product_batches
    set quantity_remaining = quantity_remaining + v_take
    where id = v_row.batch_id;
    insert into public.product_batch_allocations (movement_id, batch_id, quantity, direction)
    values (p_movement_id, v_row.batch_id, v_take, 'IN');
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    perform public.restore_to_opening_batch(p_movement_id, p_product_id, v_left);
  end if;
end;
$$;

create or replace function public.inventory_sync_opening_batch(p_product_id uuid, p_qty int)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_batch uuid;
begin
  perform set_config('app.pos_opening_stock', 'on', true);
  select id into v_batch
  from public.product_batches
  where product_id = p_product_id
  order by received_at, id
  limit 1
  for update;
  if p_qty = 0 then
    if v_batch is not null then
      update public.product_batches
      set quantity_remaining = 0
      where id = v_batch;
    end if;
    return;
  end if;
  if v_batch is null then
    insert into public.product_batches (product_id, quantity_remaining, created_by)
    values (p_product_id, p_qty, auth.uid());
  else
    update public.product_batches
    set quantity_remaining = p_qty
    where id = v_batch;
  end if;
end;
$$;

-- ---------- guards ----------

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
  if new.movement_type::text = 'POS_SALE' and (new.quantity_delta >= 0 or new.transaction_id is null) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text = 'POS_VOID' and (new.quantity_delta <= 0 or new.transaction_id is null) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text = 'POS_EDIT_RESTORE' and (new.quantity_delta <= 0 or new.transaction_id is null) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text = 'ADJUSTMENT' and (new.transaction_id is not null or new.reason is null or new.quantity_delta = 0) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text = 'STOCK_IN' and (
    new.quantity_delta <= 0 or new.transaction_id is not null or new.reason is null or new.batch_id is null
  ) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text in ('STOCK_OUT', 'DAMAGED', 'MISSING', 'EXPIRED') and (
    new.quantity_delta >= 0 or new.transaction_id is not null or new.reason is null or new.batch_id is null
  ) then
    raise exception 'Stock history cannot be modified';
  end if;
  if new.movement_type::text not in (
    'POS_SALE', 'POS_VOID', 'POS_EDIT_RESTORE', 'ADJUSTMENT',
    'STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'MISSING', 'EXPIRED'
  ) then
    raise exception 'Stock history cannot be modified';
  end if;
  return new;
end;
$$;

create or replace function public.protect_product_batch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Stock history cannot be modified';
  end if;
  if current_setting('app.pos_stock', true) is distinct from 'on'
     and current_setting('app.pos_opening_stock', true) is distinct from 'on' then
    raise exception 'Stock history cannot be modified';
  end if;
  if tg_op = 'UPDATE' and (
    new.product_id is distinct from old.product_id
    or new.expiration_date is distinct from old.expiration_date
    or new.supplier is distinct from old.supplier
    or new.unit_cost is distinct from old.unit_cost
    or new.received_at is distinct from old.received_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.id is distinct from old.id
  ) then
    raise exception 'Stock history cannot be modified';
  end if;
  return new;
end;
$$;

drop trigger if exists product_batches_protect on public.product_batches;
create trigger product_batches_protect
  before insert or update or delete on public.product_batches
  for each row execute function public.protect_product_batch();

create or replace function public.protect_product_batch_allocation()
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
  return new;
end;
$$;

drop trigger if exists product_batch_allocations_protect on public.product_batch_allocations;
create trigger product_batch_allocations_protect
  before insert or update or delete on public.product_batch_allocations
  for each row execute function public.protect_product_batch_allocation();

create or replace function public.protect_clinic_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'Clinic settings cannot be changed directly';
  end if;
  if current_setting('app.inventory_settings', true) is distinct from 'on' then
    raise exception 'Clinic settings cannot be changed directly';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Clinic settings cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists clinic_settings_protect on public.clinic_settings;
create trigger clinic_settings_protect
  before insert or update or delete on public.clinic_settings
  for each row execute function public.protect_clinic_settings();

-- ---------- products ----------

drop function if exists public.upsert_product(uuid, text, text, numeric, int, boolean, text, text, int);

create or replace function public.upsert_product(
  p_product_id uuid,
  p_name text,
  p_unit text,
  p_price numeric,
  p_quantity_on_hand int,
  p_is_active boolean,
  p_category text,
  p_description text,
  p_minimum_stock int,
  p_supplier text,
  p_unit_cost numeric
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
  v_category text;
  v_description text;
  v_supplier text;
  v_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_qty int;
begin
  perform public.pos_assert_staff();

  v_name := btrim(coalesce(p_name, ''));
  v_unit := btrim(coalesce(p_unit, ''));
  v_category := btrim(coalesce(p_category, ''));
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  v_supplier := nullif(btrim(coalesce(p_supplier, '')), '');
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Enter a product name';
  end if;
  if char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    raise exception 'Enter a unit';
  end if;
  if char_length(v_category) < 1 or char_length(v_category) > 40 then
    raise exception 'Enter a category';
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'Description is too long';
  end if;
  if v_supplier is not null and char_length(v_supplier) > 120 then
    raise exception 'Supplier name is too long';
  end if;
  if p_price is null or p_price < 0 or p_price > 9999999999.99 then
    raise exception 'Enter a valid price';
  end if;
  v_price := round(p_price, 2);
  if p_unit_cost is not null and (p_unit_cost < 0 or p_unit_cost > 9999999999.99) then
    raise exception 'Enter a valid cost';
  end if;
  v_cost := case when p_unit_cost is null then null else round(p_unit_cost, 2) end;
  if p_minimum_stock is not null and (p_minimum_stock < 0 or p_minimum_stock > 1000000) then
    raise exception 'Enter a valid minimum stock';
  end if;
  if p_quantity_on_hand is null or p_quantity_on_hand < 0 or p_quantity_on_hand > 1000000 then
    raise exception 'Enter a valid quantity';
  end if;
  v_qty := p_quantity_on_hand;

  perform set_config('app.pos_write', 'on', true);

  if p_product_id is null then
    insert into public.products (
      name, unit, price, quantity_on_hand, is_active, category, description, minimum_stock, supplier, unit_cost
    )
    values (
      v_name, v_unit, v_price, v_qty, coalesce(p_is_active, true), v_category, v_description, p_minimum_stock, v_supplier, v_cost
    )
    returning id into v_id;
    perform public.inventory_sync_opening_batch(v_id, v_qty);
    perform public.assert_stock_balanced(v_id);
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
        is_active = coalesce(p_is_active, true),
        category = v_category,
        description = v_description,
        minimum_stock = p_minimum_stock,
        supplier = v_supplier,
        unit_cost = v_cost
    where id = p_product_id;
  else
    perform set_config('app.pos_opening_stock', 'on', true);
    update public.products
    set name = v_name,
        unit = v_unit,
        price = v_price,
        quantity_on_hand = v_qty,
        is_active = coalesce(p_is_active, true),
        category = v_category,
        description = v_description,
        minimum_stock = p_minimum_stock,
        supplier = v_supplier,
        unit_cost = v_cost
    where id = p_product_id;
    perform public.inventory_sync_opening_batch(p_product_id, v_qty);
    perform public.assert_stock_balanced(p_product_id);
  end if;

  return p_product_id;
exception
  when unique_violation then
    raise exception 'A product with this name already exists';
end;
$$;

create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_stock int;
  v_batch uuid;
  v_movement uuid;
  v_left int;
  v_take int;
  v_row record;
begin
  perform public.pos_assert_staff();
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Enter a reason for the adjustment';
  end if;
  if p_delta is null or p_delta = 0 or p_delta < -1000000 or p_delta > 1000000 then
    raise exception 'Enter a valid quantity';
  end if;

  select quantity_on_hand into v_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'This product is not available';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'Not enough stock';
  end if;

  perform set_config('app.pos_write', 'on', true);
  perform set_config('app.pos_stock', 'on', true);
  update public.products
  set quantity_on_hand = quantity_on_hand + p_delta
  where id = p_product_id;

  if p_delta > 0 then
    insert into public.product_batches (product_id, quantity_remaining, created_by)
    values (p_product_id, p_delta, auth.uid())
    returning id into v_batch;
    insert into public.product_stock_movements (
      product_id, transaction_id, movement_type, quantity_delta, reason, created_by, batch_id
    )
    values (p_product_id, null, 'ADJUSTMENT', p_delta, v_reason, auth.uid(), v_batch);
  else
    insert into public.product_stock_movements (
      product_id, transaction_id, movement_type, quantity_delta, reason, created_by
    )
    values (p_product_id, null, 'ADJUSTMENT', p_delta, v_reason, auth.uid())
    returning id into v_movement;
    v_left := abs(p_delta);
    for v_row in
      select id, quantity_remaining
      from public.product_batches
      where product_id = p_product_id
        and quantity_remaining > 0
      order by expiration_date nulls last, received_at, id
      for update
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_row.quantity_remaining);
      update public.product_batches
      set quantity_remaining = quantity_remaining - v_take
      where id = v_row.id;
      insert into public.product_batch_allocations (movement_id, batch_id, quantity, direction)
      values (v_movement, v_row.id, v_take, 'OUT');
      v_left := v_left - v_take;
    end loop;
    if v_left > 0 then
      raise exception 'Not enough stock';
    end if;
  end if;

  perform public.assert_stock_balanced(p_product_id);
end;
$$;

create or replace function public.record_inventory_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity int,
  p_reason text,
  p_batch_id uuid,
  p_supplier text,
  p_reference_note text,
  p_unit_cost numeric,
  p_expiration_date date,
  p_direction text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_direction text;
  v_reason text;
  v_supplier text;
  v_reference text;
  v_cost numeric(12, 2);
  v_batch uuid;
  v_movement uuid;
  v_remaining int;
  v_exp date;
  v_delta int;
begin
  perform public.pos_assert_staff();
  v_type := upper(btrim(coalesce(p_movement_type, '')));
  if v_type not in ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'DAMAGED', 'MISSING', 'EXPIRED') then
    raise exception 'Choose a stock movement';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Enter a valid quantity';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Enter a reason for this stock change';
  end if;

  v_supplier := nullif(btrim(coalesce(p_supplier, '')), '');
  v_reference := nullif(btrim(coalesce(p_reference_note, '')), '');
  if v_supplier is not null and char_length(v_supplier) > 120 then
    raise exception 'Supplier name is too long';
  end if;
  if v_reference is not null and char_length(v_reference) > 80 then
    raise exception 'Reference is too long';
  end if;
  if p_unit_cost is not null and (p_unit_cost < 0 or p_unit_cost > 9999999999.99) then
    raise exception 'Enter a valid cost';
  end if;
  v_cost := case when p_unit_cost is null then null else round(p_unit_cost, 2) end;
  if v_type <> 'STOCK_IN' then
    v_supplier := null;
    v_reference := null;
    v_cost := null;
  end if;

  v_direction := upper(btrim(coalesce(p_direction, '')));
  if v_type = 'STOCK_IN' then
    v_direction := 'IN';
  elsif v_type in ('STOCK_OUT', 'DAMAGED', 'MISSING', 'EXPIRED') then
    v_direction := 'OUT';
  elsif v_direction not in ('IN', 'OUT') then
    raise exception 'Choose whether to add or remove stock';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'This product is not available';
  end if;
  perform 1 from public.products where id = p_product_id for update;

  perform set_config('app.pos_write', 'on', true);
  perform set_config('app.pos_stock', 'on', true);

  if v_type = 'STOCK_IN' then
    insert into public.product_batches (
      product_id, quantity_remaining, expiration_date, supplier, unit_cost, created_by
    )
    values (p_product_id, p_quantity, p_expiration_date, v_supplier, v_cost, auth.uid())
    returning id into v_batch;
    update public.products
    set quantity_on_hand = quantity_on_hand + p_quantity,
        supplier = coalesce(v_supplier, supplier),
        unit_cost = coalesce(v_cost, unit_cost)
    where id = p_product_id;
    v_delta := p_quantity;
  elsif v_direction = 'IN' then
    if p_batch_id is null then
      insert into public.product_batches (product_id, quantity_remaining, created_by)
      values (p_product_id, p_quantity, auth.uid())
      returning id into v_batch;
    else
      update public.product_batches
      set quantity_remaining = quantity_remaining + p_quantity
      where id = p_batch_id and product_id = p_product_id
      returning id into v_batch;
      if v_batch is null then
        raise exception 'Choose a batch';
      end if;
    end if;
    update public.products
    set quantity_on_hand = quantity_on_hand + p_quantity
    where id = p_product_id;
    v_delta := p_quantity;
  else
    if p_batch_id is null then
      raise exception 'Choose a batch';
    end if;
    select quantity_remaining, expiration_date
      into v_remaining, v_exp
    from public.product_batches
    where id = p_batch_id and product_id = p_product_id
    for update;
    if not found then
      raise exception 'Choose a batch';
    end if;
    if v_type = 'EXPIRED' and (v_exp is null or v_exp >= public.clinic_today()) then
      raise exception 'This batch is not expired';
    end if;
    if v_remaining < p_quantity then
      raise exception 'Not enough stock';
    end if;
    update public.product_batches
    set quantity_remaining = quantity_remaining - p_quantity
    where id = p_batch_id;
    update public.products
    set quantity_on_hand = quantity_on_hand - p_quantity
    where id = p_product_id and quantity_on_hand >= p_quantity;
    if not found then
      raise exception 'Not enough stock';
    end if;
    v_batch := p_batch_id;
    v_delta := -p_quantity;
  end if;

  insert into public.product_stock_movements (
    product_id, transaction_id, movement_type, quantity_delta, reason, created_by,
    batch_id, supplier, reference_note, unit_cost
  )
  values (
    p_product_id, null, v_type::public.product_stock_movement_type, v_delta, v_reason, auth.uid(),
    v_batch, v_supplier, v_reference, v_cost
  )
  returning id into v_movement;

  perform public.assert_stock_balanced(p_product_id);
  return v_movement;
end;
$$;

create or replace function public.set_expiry_warning_days(p_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pos_assert_staff();
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Enter a valid warning period';
  end if;
  perform set_config('app.inventory_settings', 'on', true);
  update public.clinic_settings
  set expiry_warning_days = p_days,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;
end;
$$;

-- ---------- POS stock allocation ----------

create or replace function public.pos_save_cart(
  p_transaction_id uuid,
  p_client_id uuid,
  p_pet_id uuid,
  p_appointment_id uuid,
  p_walk_in_name text,
  p_walk_in_contact text,
  p_items jsonb,
  p_pay boolean,
  p_amount_tendered numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_client uuid;
  v_pet uuid;
  v_appointment uuid;
  v_walk_name text;
  v_walk_contact text;
  v_status public.appointment_status;
  v_visit_pet uuid;
  v_visit_client uuid;
  v_row record;
  v_name text;
  v_price numeric(12, 2);
  v_active boolean;
  v_unit text;
  v_qty int;
  v_stock int;
  v_line_pet uuid;
begin
  perform public.pos_assert_staff();
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'Add at least one item before recording payment';
  end if;

  v_appointment := p_appointment_id;
  if v_appointment is not null then
    select client_id, pet_id, status
      into v_visit_client, v_visit_pet, v_status
    from public.appointments
    where id = v_appointment;
    if not found then
      raise exception 'Appointment not found';
    end if;
    if v_status not in ('IN_CONSULTATION', 'COMPLETED') then
      raise exception 'This visit cannot be billed yet';
    end if;
    perform public.pos_assert_client(v_visit_client);
    v_client := v_visit_client;
    v_pet := v_visit_pet;
    v_walk_name := null;
    v_walk_contact := null;
  elsif p_client_id is not null then
    perform public.pos_assert_client(p_client_id);
    v_client := p_client_id;
    v_pet := p_pet_id;
    if v_pet is not null and not exists (
      select 1 from public.pets
      where id = v_pet and owner_id = v_client and is_archived = false
    ) then
      raise exception 'Choose a pet that belongs to this client';
    end if;
    v_walk_name := null;
    v_walk_contact := null;
  else
    v_client := null;
    v_pet := null;
    if p_pet_id is not null then
      raise exception 'A walk-in sale cannot be linked to a registered pet';
    end if;
    v_walk_name := btrim(coalesce(p_walk_in_name, ''));
    v_walk_contact := nullif(btrim(coalesce(p_walk_in_contact, '')), '');
    if char_length(v_walk_name) < 1 or char_length(v_walk_name) > 120 then
      raise exception 'Enter the customer name';
    end if;
    if v_walk_contact is not null and (char_length(v_walk_contact) < 1 or char_length(v_walk_contact) > 40) then
      raise exception 'Enter a valid contact';
    end if;
  end if;

  perform set_config('app.pos_write', 'on', true);

  if p_transaction_id is null then
    insert into public.pos_transactions (
      reference, client_id, pet_id, appointment_id, walk_in_name, walk_in_contact, status, created_by
    )
    values (
      public.pos_next_reference(), v_client, v_pet, v_appointment, v_walk_name, v_walk_contact, 'OPEN', auth.uid()
    )
    returning id into v_id;
  else
    select id into v_id
    from public.pos_transactions
    where id = p_transaction_id and status = 'OPEN'
    for update;
    if not found then
      raise exception 'This bill can no longer be changed';
    end if;
    update public.pos_transactions
    set client_id = v_client,
        pet_id = v_pet,
        appointment_id = v_appointment,
        walk_in_name = v_walk_name,
        walk_in_contact = v_walk_contact
    where id = v_id;
    delete from public.pos_transaction_items where transaction_id = v_id;
  end if;

  for v_row in
    select
      item_type,
      service_id,
      product_id,
      pet_id,
      sum(quantity)::int as quantity
    from jsonb_to_recordset(p_items) as x(
      item_type text,
      service_id uuid,
      product_id uuid,
      pet_id uuid,
      quantity int
    )
    group by item_type, service_id, product_id, pet_id
  loop
    v_qty := v_row.quantity;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'Enter a valid quantity';
    end if;
    v_line_pet := v_row.pet_id;
    if v_line_pet is not null then
      if v_client is null then
        raise exception 'A walk-in sale cannot be linked to a registered pet';
      end if;
      if not exists (
        select 1 from public.pets
        where id = v_line_pet and owner_id = v_client and is_archived = false
      ) then
        raise exception 'Choose a pet that belongs to this client';
      end if;
      if v_appointment is not null and v_line_pet is distinct from v_pet then
        raise exception 'Pet does not match this visit';
      end if;
    end if;

    if v_row.item_type = 'SERVICE' then
      if exists (
        select 1 from public.pos_transaction_items
        where transaction_id = v_id and service_id = v_row.service_id
      ) then
        raise exception 'This service is already on a bill for this visit';
      end if;
      if v_appointment is not null
         and public.pos_service_already_billed(v_appointment, v_row.service_id, v_id) then
        raise exception 'This service is already on a bill for this visit';
      end if;
      select name, price, is_active
        into v_name, v_price, v_active
      from public.services
      where id = v_row.service_id;
      if not found or not coalesce(v_active, false) then
        raise exception 'This service is not available';
      end if;
      if v_price is null then
        raise exception 'Set a price for this service before adding it';
      end if;
      insert into public.pos_transaction_items (
        transaction_id, item_type, service_id, appointment_id, pet_id,
        description, quantity, unit_price, subtotal
      )
      values (
        v_id, 'SERVICE', v_row.service_id, v_appointment, v_line_pet,
        v_name, v_qty, round(v_price, 2), round(round(v_price, 2) * v_qty, 2)
      );
    elsif v_row.item_type = 'PRODUCT' then
      select name, price, is_active
        into v_name, v_price, v_active
      from public.products
      where id = v_row.product_id
      for update;
      if not found or not coalesce(v_active, false) then
        raise exception 'This product is not available';
      end if;
      v_stock := public.product_sellable_quantity(v_row.product_id);
      if v_qty > v_stock then
        raise exception 'Not enough stock';
      end if;
      insert into public.pos_transaction_items (
        transaction_id, item_type, product_id, pet_id,
        description, quantity, unit_price, subtotal
      )
      values (
        v_id, 'PRODUCT', v_row.product_id, v_line_pet,
        v_name, v_qty, round(v_price, 2), round(round(v_price, 2) * v_qty, 2)
      );
    else
      raise exception 'This service is not available';
    end if;
  end loop;

  perform public.pos_recalculate(v_id);

  if exists (
    select 1
    from (
      select product_id, sum(quantity) as qty
      from public.pos_transaction_items
      where transaction_id = v_id and item_type = 'PRODUCT'
      group by product_id
    ) lines
    where lines.qty > public.product_sellable_quantity(lines.product_id)
  ) then
    raise exception 'Not enough stock';
  end if;

  if coalesce(p_pay, false) then
    perform public.pos_complete_transaction(v_id, p_amount_tendered);
  end if;

  return v_id;
end;
$$;

create or replace function public.pos_complete_transaction(
  p_transaction_id uuid,
  p_amount_tendered numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_total numeric(12, 2);
  v_tendered numeric(12, 2);
  v_item record;
  v_movement uuid;
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
      and mine.appointment_id is not null
      and ot.status <> 'VOIDED'
  ) then
    raise exception 'This service is already on a bill for this visit';
  end if;

  perform set_config('app.pos_write', 'on', true);
  v_total := public.pos_recalculate(p_transaction_id);
  if p_amount_tendered is null or p_amount_tendered < v_total or p_amount_tendered > 9999999999.99 then
    raise exception 'Amount received is less than the amount due';
  end if;
  v_tendered := round(p_amount_tendered, 2);
  if v_tendered < v_total then
    raise exception 'Amount received is less than the amount due';
  end if;

  perform set_config('app.pos_stock', 'on', true);
  for v_item in
    select product_id, sum(quantity)::int as qty
    from public.pos_transaction_items
    where transaction_id = p_transaction_id and item_type = 'PRODUCT'
    group by product_id
    order by product_id
  loop
    perform 1 from public.products where id = v_item.product_id for update;
    if public.product_sellable_quantity(v_item.product_id) < v_item.qty then
      raise exception 'Not enough stock';
    end if;
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
    values (v_item.product_id, p_transaction_id, 'POS_SALE', -v_item.qty, auth.uid())
    returning id into v_movement;
    perform public.allocate_fefo(v_movement, v_item.product_id, v_item.qty);
    perform public.assert_stock_balanced(v_item.product_id);
  end loop;

  update public.pos_transactions
  set status = 'COMPLETED',
      amount_paid = v_total,
      amount_tendered = v_tendered,
      change_amount = round(v_tendered - v_total, 2),
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
  v_movement uuid;
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
      values (v_item.product_id, p_transaction_id, 'POS_VOID', v_item.qty, auth.uid())
      returning id into v_movement;
      perform public.restore_transaction_batches(v_movement, p_transaction_id, v_item.product_id, v_item.qty);
      perform public.assert_stock_balanced(v_item.product_id);
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

create or replace function public.pos_edit_completed_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.pos_transactions;
  v_reason text;
  v_previous jsonb;
  v_total numeric(12, 2);
  v_row record;
  v_old record;
  v_name text;
  v_price numeric(12, 2);
  v_active boolean;
  v_stock int;
  v_qty int;
  v_line_pet uuid;
  v_delta int;
  v_movement uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can edit a completed transaction';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Enter a reason for the edit';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'Add at least one item before recording payment';
  end if;

  select * into v_txn from public.pos_transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.status <> 'COMPLETED' then
    raise exception 'This bill can no longer be changed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'item_type', item_type,
    'service_id', service_id,
    'product_id', product_id,
    'description', description,
    'quantity', quantity,
    'unit_price', unit_price,
    'subtotal', subtotal
  )), '[]'::jsonb)
  into v_previous
  from public.pos_transaction_items
  where transaction_id = p_transaction_id;

  perform set_config('app.pos_write', 'on', true);
  perform set_config('app.pos_edit', 'on', true);
  delete from public.pos_transaction_items where transaction_id = p_transaction_id;

  for v_row in
    select item_id, item_type, service_id, product_id, pet_id, quantity
    from jsonb_to_recordset(p_items) as x(
      item_id uuid,
      item_type text,
      service_id uuid,
      product_id uuid,
      pet_id uuid,
      quantity int
    )
  loop
    v_qty := v_row.quantity;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'Enter a valid quantity';
    end if;
    v_line_pet := v_row.pet_id;
    if v_line_pet is not null then
      if v_txn.client_id is null then
        raise exception 'A walk-in sale cannot be linked to a registered pet';
      end if;
      if not exists (
        select 1 from public.pets
        where id = v_line_pet and owner_id = v_txn.client_id and is_archived = false
      ) then
        raise exception 'Choose a pet that belongs to this client';
      end if;
      if v_txn.appointment_id is not null and v_line_pet is distinct from v_txn.pet_id then
        raise exception 'Pet does not match this visit';
      end if;
    end if;

    if v_row.item_id is not null then
      select *
      into v_old
      from jsonb_to_recordset(v_previous) as prev(
        id uuid,
        item_type text,
        service_id uuid,
        product_id uuid,
        description text,
        quantity int,
        unit_price numeric,
        subtotal numeric
      )
      where prev.id = v_row.item_id;
      if not found then
        raise exception 'Transaction not found';
      end if;
      if v_old.item_type = 'SERVICE' and exists (
        select 1 from public.pos_transaction_items
        where transaction_id = p_transaction_id and service_id = v_old.service_id
      ) then
        raise exception 'This service is already on a bill for this visit';
      end if;
      insert into public.pos_transaction_items (
        transaction_id, item_type, service_id, product_id, appointment_id, pet_id,
        description, quantity, unit_price, subtotal
      )
      values (
        p_transaction_id,
        v_old.item_type::public.pos_item_type,
        v_old.service_id,
        v_old.product_id,
        case when v_old.item_type = 'SERVICE' then v_txn.appointment_id else null end,
        v_line_pet,
        v_old.description,
        v_qty,
        v_old.unit_price,
        round(v_old.unit_price * v_qty, 2)
      );
    elsif v_row.item_type = 'SERVICE' then
      if exists (
        select 1 from public.pos_transaction_items
        where transaction_id = p_transaction_id and service_id = v_row.service_id
      ) then
        raise exception 'This service is already on a bill for this visit';
      end if;
      if v_txn.appointment_id is not null
         and public.pos_service_already_billed(v_txn.appointment_id, v_row.service_id, p_transaction_id) then
        raise exception 'This service is already on a bill for this visit';
      end if;
      select name, price, is_active into v_name, v_price, v_active
      from public.services where id = v_row.service_id;
      if not found or not coalesce(v_active, false) or v_price is null then
        raise exception 'This service is not available';
      end if;
      insert into public.pos_transaction_items (
        transaction_id, item_type, service_id, appointment_id, pet_id,
        description, quantity, unit_price, subtotal
      )
      values (
        p_transaction_id, 'SERVICE', v_row.service_id, v_txn.appointment_id, v_line_pet,
        v_name, v_qty, round(v_price, 2), round(round(v_price, 2) * v_qty, 2)
      );
    elsif v_row.item_type = 'PRODUCT' then
      select name, price, is_active into v_name, v_price, v_active
      from public.products where id = v_row.product_id;
      if not found or not coalesce(v_active, false) then
        raise exception 'This product is not available';
      end if;
      insert into public.pos_transaction_items (
        transaction_id, item_type, product_id, pet_id,
        description, quantity, unit_price, subtotal
      )
      values (
        p_transaction_id, 'PRODUCT', v_row.product_id, v_line_pet,
        v_name, v_qty, round(v_price, 2), round(round(v_price, 2) * v_qty, 2)
      );
    else
      raise exception 'This service is not available';
    end if;
  end loop;

  v_total := public.pos_recalculate(p_transaction_id);
  if v_total is distinct from v_txn.total then
    raise exception 'This edit would change the amount paid';
  end if;

  perform set_config('app.pos_stock', 'on', true);
  for v_row in
    with old_qty as (
      select product_id, sum(quantity)::int as qty
      from jsonb_to_recordset(v_previous) as prev(product_id uuid, item_type text, quantity int)
      where item_type = 'PRODUCT'
      group by product_id
    ),
    new_qty as (
      select product_id, sum(quantity)::int as qty
      from public.pos_transaction_items
      where transaction_id = p_transaction_id and item_type = 'PRODUCT'
      group by product_id
    )
    select
      coalesce(n.product_id, o.product_id) as product_id,
      coalesce(n.qty, 0) - coalesce(o.qty, 0) as delta
    from new_qty n
    full join old_qty o on o.product_id = n.product_id
    where coalesce(n.qty, 0) <> coalesce(o.qty, 0)
    order by 1
  loop
    if v_row.product_id is null or v_row.delta = 0 then
      continue;
    end if;
    select quantity_on_hand into v_stock from public.products where id = v_row.product_id for update;
    if v_row.delta > 0 then
      perform 1 from public.products where id = v_row.product_id for update;
      if public.product_sellable_quantity(v_row.product_id) < v_row.delta then
        raise exception 'Not enough stock';
      end if;
      update public.products
      set quantity_on_hand = quantity_on_hand - v_row.delta
      where id = v_row.product_id and quantity_on_hand >= v_row.delta;
      if not found then
        raise exception 'Not enough stock';
      end if;
      insert into public.product_stock_movements (
        product_id, transaction_id, movement_type, quantity_delta, created_by
      )
      values (v_row.product_id, p_transaction_id, 'POS_SALE', -v_row.delta, auth.uid())
      returning id into v_movement;
      perform public.allocate_fefo(v_movement, v_row.product_id, v_row.delta);
    else
      v_delta := abs(v_row.delta);
      update public.products
      set quantity_on_hand = quantity_on_hand + v_delta
      where id = v_row.product_id;
      if not found then
        raise exception 'This product is not available';
      end if;
      insert into public.product_stock_movements (
        product_id, transaction_id, movement_type, quantity_delta, created_by
      )
      values (v_row.product_id, p_transaction_id, 'POS_EDIT_RESTORE', v_delta, auth.uid())
      returning id into v_movement;
      perform public.restore_transaction_batches(v_movement, p_transaction_id, v_row.product_id, v_delta);
    end if;
    perform public.assert_stock_balanced(v_row.product_id);
  end loop;

  insert into public.pos_transaction_edits (
    transaction_id, reason, edited_by, previous_items, previous_total
  )
  values (p_transaction_id, v_reason, auth.uid(), v_previous, v_txn.total);

  return p_transaction_id;
end;
$$;

-- ---------- access ----------

alter table public.product_batches enable row level security;
alter table public.product_batch_allocations enable row level security;
alter table public.clinic_settings enable row level security;

drop policy if exists "product_batches_select" on public.product_batches;
create policy "product_batches_select"
  on public.product_batches for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "product_batch_allocations_select" on public.product_batch_allocations;
create policy "product_batch_allocations_select"
  on public.product_batch_allocations for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

drop policy if exists "clinic_settings_select" on public.clinic_settings;
create policy "clinic_settings_select"
  on public.clinic_settings for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

revoke all on public.product_batches from public, anon, authenticated;
revoke all on public.product_batch_allocations from public, anon, authenticated;
revoke all on public.clinic_settings from public, anon, authenticated;
grant select on public.product_batches to authenticated;
grant select on public.product_batch_allocations to authenticated;
grant select on public.clinic_settings to authenticated;

revoke all on function public.clinic_today() from public, anon, authenticated;
revoke all on function public.product_sellable_quantity(uuid) from public, anon, authenticated;
revoke all on function public.assert_stock_balanced(uuid) from public, anon, authenticated;
revoke all on function public.allocate_fefo(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.restore_to_opening_batch(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.restore_transaction_batches(uuid, uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.inventory_sync_opening_batch(uuid, int) from public, anon, authenticated;
revoke all on function public.protect_product_batch() from public, anon, authenticated;
revoke all on function public.protect_product_batch_allocation() from public, anon, authenticated;
revoke all on function public.protect_clinic_settings() from public, anon, authenticated;

revoke all on function public.upsert_product(uuid, text, text, numeric, int, boolean, text, text, int, text, numeric) from public, anon;
grant execute on function public.upsert_product(uuid, text, text, numeric, int, boolean, text, text, int, text, numeric) to authenticated;

revoke all on function public.record_inventory_movement(uuid, text, int, text, uuid, text, text, numeric, date, text) from public, anon;
grant execute on function public.record_inventory_movement(uuid, text, int, text, uuid, text, text, numeric, date, text) to authenticated;

revoke all on function public.set_expiry_warning_days(int) from public, anon;
grant execute on function public.set_expiry_warning_days(int) to authenticated;
