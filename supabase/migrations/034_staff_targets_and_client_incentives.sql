-- Staff performance targets (revenue, appointments, retail)
create table public.staff_targets (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  member_id uuid not null references public.salon_members(id) on delete cascade,
  target_type text not null check (target_type in ('revenue', 'appointments', 'retail')),
  target_value int not null,
  period text not null check (period in ('weekly', 'monthly')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(salon_id, member_id, target_type, period)
);

create index idx_staff_targets_salon on public.staff_targets(salon_id);
create index idx_staff_targets_member on public.staff_targets(member_id);

alter table public.staff_targets enable row level security;

create policy "Members can read targets for their salon"
  on public.staff_targets for select
  using (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = staff_targets.salon_id
        and sm.user_id = (select auth.uid())
        and sm.is_active = true
    )
  );

create policy "Owners can manage targets for their salon"
  on public.staff_targets for all
  using (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = staff_targets.salon_id
        and sm.user_id = (select auth.uid())
        and sm.role = 'owner'
    )
  );

-- Client loyalty / incentive tracking
create table public.client_incentives (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  points int not null default 0,
  total_visits int not null default 0,
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  last_reward_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(salon_id, client_id)
);

create index idx_client_incentives_salon on public.client_incentives(salon_id);
create index idx_client_incentives_client on public.client_incentives(client_id);

alter table public.client_incentives enable row level security;

create policy "Members can read incentives for their salon"
  on public.client_incentives for select
  using (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = client_incentives.salon_id
        and sm.user_id = (select auth.uid())
        and sm.is_active = true
    )
  );

create policy "Members can manage incentives for their salon"
  on public.client_incentives for all
  using (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = client_incentives.salon_id
        and sm.user_id = (select auth.uid())
        and sm.is_active = true
    )
  );
