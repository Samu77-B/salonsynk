-- Client loyalty programme: split point buckets + audit ledger.

alter table public.client_incentives
  add column if not exists service_points int not null default 0,
  add column if not exists product_points int not null default 0;

update public.client_incentives
set service_points = greatest(service_points, points)
where points > 0 and service_points = 0;

create table if not exists public.client_points_ledger (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_type text not null check (entry_type in ('earn', 'redeem', 'adjust')),
  service_points_delta int not null default 0,
  product_points_delta int not null default 0,
  sale_reference text,
  note text,
  created_by uuid references public.salon_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_points_ledger_client
  on public.client_points_ledger(salon_id, client_id, created_at desc);

create unique index if not exists idx_client_points_ledger_sale_earn
  on public.client_points_ledger(salon_id, sale_reference, entry_type)
  where sale_reference is not null and entry_type = 'earn';

alter table public.client_points_ledger enable row level security;

drop policy if exists "Members can read loyalty ledger" on public.client_points_ledger;
create policy "Members can read loyalty ledger"
  on public.client_points_ledger for select
  using (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = client_points_ledger.salon_id
        and sm.user_id = (select auth.uid())
        and sm.is_active = true
    )
  );

drop policy if exists "Members can insert loyalty ledger" on public.client_points_ledger;
create policy "Members can insert loyalty ledger"
  on public.client_points_ledger for insert
  with check (
    exists (
      select 1 from public.salon_members sm
      where sm.salon_id = client_points_ledger.salon_id
        and sm.user_id = (select auth.uid())
        and sm.is_active = true
    )
  );

comment on column public.client_incentives.service_points is 'Points earned on service spend; redeemed on services.';
comment on column public.client_incentives.product_points is 'Points earned on product spend; redeemed on products in blocks.';
