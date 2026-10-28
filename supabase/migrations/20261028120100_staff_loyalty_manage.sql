-- Staff manage the loyalty program alongside Senior Vet.
-- Clients still cannot change program settings.

create or replace function public.loyalty_assert_senior()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or public.current_user_role() not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Only clinic staff can change the loyalty program';
  end if;
end;
$fn$;
