-- Security hardening: ensure RLS is enabled on salons and policies are controlled.
alter table public.salons enable row level security;

-- Clean up known legacy/temp policy names that may exist in production.
drop policy if exists "Authenticated users can create salons" on public.salons;
drop policy if exists "Members can read own salons" on public.salons;
drop policy if exists "Members can update own salon" on public.salons;
drop policy if exists "TEMP allow anyone to create salons" on public.salons;

-- Recreate the intended tenant-scoped policies.
create policy "Members can read own salons"
  on public.salons for select
  using (id in (select get_my_salon_ids()));

create policy "Members can update own salon"
  on public.salons for update
  using (id in (select get_my_salon_ids()));

create policy "Authenticated users can create salons"
  on public.salons for insert
  with check (auth.uid() is not null);

