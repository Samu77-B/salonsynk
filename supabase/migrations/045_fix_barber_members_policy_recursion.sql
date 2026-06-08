-- Fix infinite recursion: owner policy queried barber_members inside its own USING clause.

create or replace function public.is_owner_of_barber_shop(p_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.barber_members
    where shop_id = p_shop_id and user_id = auth.uid() and role = 'owner'
  );
$$;

drop policy if exists "Owners can manage barber_members" on public.barber_members;

create policy "Owners can manage barber_members"
  on public.barber_members for all
  using (
    shop_id in (select get_my_barber_shop_ids())
    and is_owner_of_barber_shop(shop_id)
  )
  with check (
    shop_id in (select get_my_barber_shop_ids())
    and is_owner_of_barber_shop(shop_id)
  );
