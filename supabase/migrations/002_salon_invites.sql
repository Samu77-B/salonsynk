-- Optional: salon invites so owners can invite by email before user exists.
create table if not exists public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'stylist')),
  display_name text,
  token text unique,
  created_at timestamptz default now(),
  unique(salon_id, email)
);

alter table public.salon_invites enable row level security;

create policy "Members can read salon_invites"
  on public.salon_invites for select
  using (salon_id in (select get_my_salon_ids()));

create policy "Owners can manage salon_invites"
  on public.salon_invites for all
  using (
    salon_id in (select get_my_salon_ids())
    and exists (
      select 1 from public.salon_members sm
      where sm.salon_id = salon_invites.salon_id and sm.user_id = auth.uid() and sm.role = 'owner'
    )
  );
