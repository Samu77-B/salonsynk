-- Idempotent: ensure diary colour and category columns exist on services.
-- Safe to run even if 028_service_color / 042_service_categories were already applied.

alter table public.services
  add column if not exists color text;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.service_categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'service_categories'
      and policyname = 'Members can manage service_categories'
  ) then
    create policy "Members can manage service_categories"
      on public.service_categories for all
      using (salon_id in (select get_my_salon_ids()))
      with check (salon_id in (select get_my_salon_ids()));
  end if;
end $$;

alter table public.services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;

alter table public.services
  add column if not exists sort_order int not null default 0;

create index if not exists idx_services_category_id on public.services(category_id);
create index if not exists idx_service_categories_salon_id on public.service_categories(salon_id);
