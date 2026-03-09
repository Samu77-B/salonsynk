-- Super admins can access and manage any salon (RLS bypass for master admin).
-- get_my_salon_ids returns all salon ids when user has is_super_admin = true.
-- Extra policy on salon_members so super admins can manage without being owner.

create or replace function public.get_my_salon_ids()
returns setof uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true) then
    return query select id from public.salons;
    return;
  end if;
  return query select salon_id from public.salon_members
  where user_id = auth.uid() and is_active = true;
end;
$$;

-- Super admins can manage salon_members in any salon (owners policy requires owner role)
create policy "Super admins can manage salon_members"
  on public.salon_members for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_super_admin = true));
