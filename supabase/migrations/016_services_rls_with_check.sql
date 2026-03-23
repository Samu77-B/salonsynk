-- Ensure INSERT/UPDATE on services pass RLS consistently (explicit WITH CHECK).
drop policy if exists "Members can manage services" on public.services;

create policy "Members can manage services"
  on public.services for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));
