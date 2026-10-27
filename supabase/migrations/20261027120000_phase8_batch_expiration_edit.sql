-- Let Staff and Senior Vet correct a batch expiration date.
-- Quantity, cost, supplier, and movement history stay protected.
-- Does not change the clinic warning period.

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
    or (
      new.expiration_date is distinct from old.expiration_date
      and current_setting('app.batch_expiration', true) is distinct from 'on'
    )
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

create or replace function public.set_batch_expiration(p_batch_id uuid, p_expiration date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pos_assert_staff();
  if p_batch_id is null or not exists (
    select 1 from public.product_batches where id = p_batch_id
  ) then
    raise exception 'Choose a batch';
  end if;
  perform set_config('app.pos_stock', 'on', true);
  perform set_config('app.batch_expiration', 'on', true);
  update public.product_batches
  set expiration_date = p_expiration
  where id = p_batch_id;
end;
$$;

revoke all on function public.set_batch_expiration(uuid, date) from public, anon;
grant execute on function public.set_batch_expiration(uuid, date) to authenticated;
