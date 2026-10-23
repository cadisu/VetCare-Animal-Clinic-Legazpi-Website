-- Phase 7 retail POS
-- Run AFTER 20261021140000_phase7_pos.sql.
-- Does not edit that migration. Adds walk-in sales, cash tendered and change,
-- product catalog fields, optional images, audited stock adjustments, and
-- Senior Vet edits of a completed bill that cannot change the amount paid.
-- Payment still does not change an appointment or a clinical record.

alter type public.product_stock_movement_type add value if not exists 'ADJUSTMENT';
alter type public.product_stock_movement_type add value if not exists 'POS_EDIT_RESTORE';

alter table public.products
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists minimum_stock int,
  add column if not exists image_path text;

update public.products
set category = 'General'
where category is null;

alter table public.products
  alter column category set not null;

alter table public.products drop constraint if exists products_category_len;
alter table public.products
  add constraint products_category_len check (char_length(btrim(category)) between 1 and 40);

alter table public.products drop constraint if exists products_description_len;
alter table public.products
  add constraint products_description_len
  check (description is null or char_length(description) <= 500);

alter table public.products drop constraint if exists products_minimum_stock_range;
alter table public.products
  add constraint products_minimum_stock_range
  check (minimum_stock is null or (minimum_stock >= 0 and minimum_stock <= 1000000));

alter table public.products drop constraint if exists products_image_path_len;
alter table public.products
  add constraint products_image_path_len
  check (image_path is null or char_length(image_path) <= 255);

alter table public.pos_transactions
  add column if not exists walk_in_name text,
  add column if not exists walk_in_contact text,
  add column if not exists amount_tendered numeric(12, 2),
  add column if not exists change_amount numeric(12, 2);

alter table public.pos_transactions alter column client_id drop not null;

alter table public.pos_transactions drop constraint if exists pos_transactions_customer;
alter table public.pos_transactions
  add constraint pos_transactions_customer check (
    (
      client_id is not null
      and walk_in_name is null
      and walk_in_contact is null
    )
    or (
      client_id is null
      and walk_in_name is not null
      and char_length(btrim(walk_in_name)) between 1 and 120
      and (walk_in_contact is null or char_length(btrim(walk_in_contact)) between 1 and 40)
    )
  );

alter table public.pos_transaction_items
  add column if not exists pet_id uuid references public.pets (id) on delete restrict;

alter table public.pos_transaction_items drop constraint if exists pos_transaction_items_kind;
alter table public.pos_transaction_items
  add constraint pos_transaction_items_kind check (
    (
      item_type = 'SERVICE'
      and service_id is not null
      and product_id is null
    )
    or (
      item_type = 'PRODUCT'
      and product_id is not null
      and service_id is null
      and appointment_id is null
    )
  );

alter table public.product_stock_movements
  alter column transaction_id drop not null;

alter table public.product_stock_movements
  add column if not exists reason text;

alter table public.product_stock_movements drop constraint if exists product_stock_movements_sign;
alter table public.product_stock_movements drop constraint if exists product_stock_movements_reason_len;
alter table public.product_stock_movements
  add constraint product_stock_movements_reason_len
  check (reason is null or char_length(btrim(reason)) between 3 and 500);

create table if not exists public.pos_transaction_edits (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.pos_transactions (id) on delete restrict,
  reason           text not null check (char_length(btrim(reason)) between 3 and 500),
  edited_by        uuid not null references public.profiles (id) on delete restrict,
  previous_items   jsonb not null,
  previous_total   numeric(12, 2) not null check (previous_total >= 0),
  created_at       timestamptz not null default now()
);

comment on table public.pos_transaction_edits is
  'Snapshot taken before a Senior Vet edits a completed bill. The amount paid does not change.';

create index if not exists pos_transaction_edits_transaction_idx
  on public.pos_transaction_edits (transaction_id, created_at desc);

-- ---------- guards ----------

create or replace function public.protect_pos_transaction()
returns trigger
language plpgsql
set search_path = public
as $$
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
     or new.reward_amount <> 0
     or new.discount_amount is distinct from old.discount_amount
     or new.reward_amount is distinct from old.reward_amount then
    raise exception 'This bill can no longer be changed';
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
       or new.void_reason is not null then
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
       or new.total is distinct from old.total then
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
$$;

create or replace function public.protect_pos_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.pos_transaction_status;
  v_txn uuid;
begin
  if not public.pos_write_allowed() and current_setting('app.pos_edit', true) is distinct from 'on' then
    raise exception 'Transactions cannot be changed directly';
  end if;
  if current_setting('app.pos_edit', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
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
  if new.movement_type::text = 'ADJUSTMENT' and (new.transaction_id is not null or new.reason is null) then
    raise exception 'Stock history cannot be modified';
  end if;
  return new;
end;
$$;

create or replace function public.protect_pos_transaction_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Edit history cannot be modified';
  end if;
  if current_setting('app.pos_edit', true) is distinct from 'on' then
    raise exception 'Edit history cannot be modified';
  end if;
  return new;
end;
$$;

drop trigger if exists pos_transaction_edits_protect on public.pos_transaction_edits;
create trigger pos_transaction_edits_protect
  before insert or update or delete on public.pos_transaction_edits
  for each row execute function public.protect_pos_transaction_edit();

-- Backfill cash fields for bills paid before tendered cash existed.
select set_config('app.pos_write', 'on', true);
select set_config('app.pos_backfill', 'on', true);
update public.pos_transactions
set amount_tendered = total,
    change_amount = 0
where status in ('COMPLETED', 'VOIDED')
  and amount_paid is not null
  and amount_tendered is null;

alter table public.pos_transactions drop constraint if exists pos_transactions_status_shape;
alter table public.pos_transactions
  add constraint pos_transactions_status_shape check (
    (
      status = 'OPEN'
      and amount_paid is null
      and amount_tendered is null
      and change_amount is null
      and processed_by is null
      and completed_at is null
      and voided_by is null
      and voided_at is null
      and void_reason is null
    )
    or (
      status = 'COMPLETED'
      and amount_paid = total
      and amount_tendered >= total
      and change_amount = round(amount_tendered - total, 2)
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
      and (
        (
          amount_paid is null
          and amount_tendered is null
          and change_amount is null
          and processed_by is null
          and completed_at is null
        )
        or (
          amount_paid = total
          and amount_tendered >= total
          and change_amount = round(amount_tendered - total, 2)
          and processed_by is not null
          and completed_at is not null
        )
      )
    )
  );

-- ---------- products ----------

drop function if exists public.upsert_product(uuid, text, text, numeric, int, boolean);

create or replace function public.upsert_product(
  p_product_id uuid,
  p_name text,
  p_unit text,
  p_price numeric,
  p_quantity_on_hand int,
  p_is_active boolean,
  p_category text,
  p_description text,
  p_minimum_stock int
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
  v_price numeric(12, 2);
  v_qty int;
begin
  perform public.pos_assert_staff();

  v_name := btrim(coalesce(p_name, ''));
  v_unit := btrim(coalesce(p_unit, ''));
  v_category := btrim(coalesce(p_category, ''));
  v_description := nullif(btrim(coalesce(p_description, '')), '');
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
  if p_price is null or p_price < 0 or p_price > 9999999999.99 then
    raise exception 'Enter a valid price';
  end if;
  v_price := round(p_price, 2);
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
      name, unit, price, quantity_on_hand, is_active, category, description, minimum_stock
    )
    values (
      v_name, v_unit, v_price, v_qty, coalesce(p_is_active, true), v_category, v_description, p_minimum_stock
    )
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
        is_active = coalesce(p_is_active, true),
        category = v_category,
        description = v_description,
        minimum_stock = p_minimum_stock
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
        minimum_stock = p_minimum_stock
    where id = p_product_id;
  end if;

  return p_product_id;
exception
  when unique_violation then
    raise exception 'A product with this name already exists';
end;
$$;

create or replace function public.set_product_image(p_product_id uuid, p_image_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  perform public.pos_assert_staff();
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'This product is not available';
  end if;
  v_path := nullif(btrim(coalesce(p_image_path, '')), '');
  if v_path is not null and v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then
    raise exception 'Image path is not valid';
  end if;
  if v_path is not null and split_part(v_path, '/', 1) is distinct from p_product_id::text then
    raise exception 'Image path is not valid';
  end if;
  perform set_config('app.pos_write', 'on', true);
  update public.products set image_path = v_path where id = p_product_id;
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
  insert into public.product_stock_movements (
    product_id, transaction_id, movement_type, quantity_delta, reason, created_by
  )
  values (p_product_id, null, 'ADJUSTMENT', p_delta, v_reason, auth.uid());
end;
$$;

-- ---------- cart ----------

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
      select name, price, is_active, quantity_on_hand
        into v_name, v_price, v_active, v_stock
      from public.products
      where id = v_row.product_id
      for update;
      if not found or not coalesce(v_active, false) then
        raise exception 'This product is not available';
      end if;
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
    join public.products p on p.id = lines.product_id
    where lines.qty > p.quantity_on_hand
  ) then
    raise exception 'Not enough stock';
  end if;

  if coalesce(p_pay, false) then
    perform public.pos_complete_transaction(v_id, p_amount_tendered);
  end if;

  return v_id;
end;
$$;

drop function if exists public.pos_complete_transaction(uuid);

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
      amount_tendered = v_tendered,
      change_amount = round(v_tendered - v_total, 2),
      processed_by = auth.uid(),
      completed_at = now()
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
      update public.products
      set quantity_on_hand = quantity_on_hand - v_row.delta
      where id = v_row.product_id and quantity_on_hand >= v_row.delta;
      if not found then
        raise exception 'Not enough stock';
      end if;
      insert into public.product_stock_movements (
        product_id, transaction_id, movement_type, quantity_delta, created_by
      )
      values (v_row.product_id, p_transaction_id, 'POS_SALE', -v_row.delta, auth.uid());
    else
      v_delta := abs(v_row.delta);
      update public.products
      set quantity_on_hand = quantity_on_hand + v_delta
      where id = v_row.product_id;
      insert into public.product_stock_movements (
        product_id, transaction_id, movement_type, quantity_delta, created_by
      )
      values (v_row.product_id, p_transaction_id, 'POS_EDIT_RESTORE', v_delta, auth.uid());
    end if;
  end loop;

  insert into public.pos_transaction_edits (
    transaction_id, reason, edited_by, previous_items, previous_total
  )
  values (p_transaction_id, v_reason, auth.uid(), v_previous, v_txn.total);

  return p_transaction_id;
end;
$$;

-- ---------- access ----------

alter table public.pos_transaction_edits enable row level security;
drop policy if exists "pos_transaction_edits_select" on public.pos_transaction_edits;
create policy "pos_transaction_edits_select"
  on public.pos_transaction_edits for select to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

revoke all on public.pos_transaction_edits from public, anon, authenticated;
grant select on public.pos_transaction_edits to authenticated;

drop policy if exists "services_manage_senior_vet" on public.services;
drop policy if exists "services_manage_staff" on public.services;
create policy "services_manage_staff"
  on public.services for all to authenticated
  using (public.current_user_role() in ('STAFF', 'SENIOR_VET'))
  with check (public.current_user_role() in ('STAFF', 'SENIOR_VET'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_select" on storage.objects;
create policy "product_images_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

revoke all on function public.protect_pos_transaction_edit() from public, anon, authenticated;

revoke all on function public.upsert_product(uuid, text, text, numeric, int, boolean, text, text, int) from public, anon;
grant execute on function public.upsert_product(uuid, text, text, numeric, int, boolean, text, text, int) to authenticated;

revoke all on function public.set_product_image(uuid, text) from public, anon;
grant execute on function public.set_product_image(uuid, text) to authenticated;

revoke all on function public.adjust_product_stock(uuid, int, text) from public, anon;
grant execute on function public.adjust_product_stock(uuid, int, text) to authenticated;

revoke all on function public.pos_save_cart(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, numeric) from public, anon;
grant execute on function public.pos_save_cart(uuid, uuid, uuid, uuid, text, text, jsonb, boolean, numeric) to authenticated;

revoke all on function public.pos_complete_transaction(uuid, numeric) from public, anon;
grant execute on function public.pos_complete_transaction(uuid, numeric) to authenticated;

revoke all on function public.pos_edit_completed_transaction(uuid, text, jsonb) from public, anon;
grant execute on function public.pos_edit_completed_transaction(uuid, text, jsonb) to authenticated;
