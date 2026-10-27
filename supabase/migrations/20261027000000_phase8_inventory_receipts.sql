-- Phase 8 follow-up: remember how many units a batch was received with,
-- and treat 90 days as the documented expiry warning period.
-- Does not change Phase 7. Does not rewrite stock movements.
-- A saved warning period is left alone. Only the untouched system value of 30
-- (updated_by is null) moves to 90. The warning period is not an expiration date.

alter table public.product_batches
  add column if not exists quantity_received int;

comment on column public.product_batches.quantity_received is
  'Units on this receipt when the batch was created. Later sales and losses change quantity_remaining only.';

-- Opening batches created before movements have no receipt row. Their original
-- quantity is what remains, plus units already taken, minus units added later.
select set_config('app.pos_opening_stock', 'on', true);

update public.product_batches b
set quantity_received = least(1000000, greatest(0, coalesce(
  (
    select m.quantity_delta
    from public.product_stock_movements m
    where m.batch_id = b.id
      and m.quantity_delta > 0
      and m.created_at between b.created_at - interval '2 minutes' and b.created_at + interval '2 minutes'
    order by m.created_at, m.id
    limit 1
  ),
  b.quantity_remaining
    - coalesce((
        select sum(m.quantity_delta)
        from public.product_stock_movements m
        where m.batch_id = b.id
      ), 0)
    + coalesce((
        select sum(case when a.direction = 'OUT' then a.quantity else -a.quantity end)
        from public.product_batch_allocations a
        where a.batch_id = b.id
      ), 0)
)))
where quantity_received is null;

alter table public.product_batches
  alter column quantity_received set not null;

alter table public.product_batches drop constraint if exists product_batches_quantity_received_range;
alter table public.product_batches
  add constraint product_batches_quantity_received_range
  check (quantity_received >= 0 and quantity_received <= 1000000);

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
  if tg_op = 'INSERT' and new.quantity_received is null then
    new.quantity_received := new.quantity_remaining;
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
    or (
      new.quantity_received is distinct from old.quantity_received
      and current_setting('app.pos_opening_stock', true) is distinct from 'on'
    )
  ) then
    raise exception 'Stock history cannot be modified';
  end if;
  return new;
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
      set quantity_remaining = 0,
          quantity_received = 0
      where id = v_batch;
    end if;
    return;
  end if;
  if v_batch is null then
    insert into public.product_batches (product_id, quantity_remaining, quantity_received, created_by)
    values (p_product_id, p_qty, p_qty, auth.uid());
  else
    update public.product_batches
    set quantity_remaining = p_qty,
        quantity_received = p_qty
    where id = v_batch;
  end if;
end;
$$;

comment on column public.clinic_settings.expiry_warning_days is
  'Expiry warning period in days. A batch is expiring soon when its expiration date is today or later and within this many days. It is not the batch expiration date. Default is 90 days.';

alter table public.clinic_settings
  alter column expiry_warning_days set default 90;

select set_config('app.inventory_settings', 'on', true);

update public.clinic_settings
set expiry_warning_days = 90
where id = 1
  and expiry_warning_days = 30
  and updated_by is null;
