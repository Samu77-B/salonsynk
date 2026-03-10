-- Allow users to read their own salon_members row.
-- Fixes edge case where get_my_salon_ids() in "Members can read salon_members" 
-- could fail to bootstrap (user needs to read own row to establish membership).
create policy "Users can read own membership"
  on public.salon_members for select
  using (user_id = auth.uid());
