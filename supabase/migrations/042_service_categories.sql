-- Service categories: optional grouping for the service catalogue.

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.service_categories enable row level security;

create policy "Members can manage service_categories"
  on public.service_categories for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));

-- Add optional category FK and sort_order to services.
alter table public.services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null,
  add column if not exists sort_order int not null default 0;

create index if not exists idx_services_category_id on public.services(category_id);
create index if not exists idx_service_categories_salon_id on public.service_categories(salon_id);
