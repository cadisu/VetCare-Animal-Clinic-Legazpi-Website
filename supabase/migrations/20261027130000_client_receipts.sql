-- Clients can read their own completed and voided bills.
-- Staff and Senior Vet policies stay as they are.
-- Open bills, walk-in bills, stock, and costs stay hidden.
-- No insert, update, or delete is granted.

drop policy if exists "pos_transactions_select_own" on public.pos_transactions;
create policy "pos_transactions_select_own"
  on public.pos_transactions for select to authenticated
  using (
    public.current_user_role() = 'CLIENT'
    and client_id = auth.uid()
    and status in ('COMPLETED', 'VOIDED')
  );

drop policy if exists "pos_transaction_items_select_own" on public.pos_transaction_items;
create policy "pos_transaction_items_select_own"
  on public.pos_transaction_items for select to authenticated
  using (
    exists (
      select 1
      from public.pos_transactions t
      where t.id = pos_transaction_items.transaction_id
        and public.current_user_role() = 'CLIENT'
        and t.client_id = auth.uid()
        and t.status in ('COMPLETED', 'VOIDED')
    )
  );
