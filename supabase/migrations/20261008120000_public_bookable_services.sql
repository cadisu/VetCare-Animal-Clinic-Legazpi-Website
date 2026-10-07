-- Let anonymous visitors read only active, bookable services for the public site.

grant select on public.services to anon;

drop policy if exists "services_select_public" on public.services;
create policy "services_select_public"
  on public.services for select to anon
  using (is_active and is_bookable);
