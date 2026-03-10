-- Fix infinite recursion: "Owners can manage salon_members" policy queried salon_members
-- in its USING clause, causing recursion. Use a security definer function instead.

create or replace function public.is_owner_of_salon(p_salon_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Drop and recreate salon_members policy to avoid recursion
drop policy if exists "Owners can manage salon_members" on public.salon_members;

create policy "Owners can manage salon_members"
  on public.salon_members for all
  using (
    salon_id in (select get_my_salon_ids())
    and is_owner_of_salon(salon_id)
  )
  with check (
    salon_id in (select get_my_salon_ids())
    and is_owner_of_salon(salon_id)
  );

-- salon_invites policy also queried salon_members; use helper for consistency
drop policy if exists "Owners can manage salon_invites" on public.salon_invites;

create policy "Owners can manage salon_invites"
  on public.salon_invites for all
  using (
    salon_id in (select get_my_salon_ids())
    and is_owner_of_salon(salon_id)
  )
  with check (
    salon_id in (select get_my_salon_ids())
    and is_owner_of_salon(salon_id)
  );
