-- Optional grouping for BarberSynk service catalogues (Cuts, Fades, Beard, etc.).

create table if not exists public.barber_service_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.barber_service_categories enable row level security;

drop policy if exists "Members can manage barber_service_categories" on public.barber_service_categories;
create policy "Members can manage barber_service_categories"
  on public.barber_service_categories for all
  using (shop_id in (select get_my_barber_shop_ids()))
  with check (shop_id in (select get_my_barber_shop_ids()));

alter table public.barber_services
  add column if not exists category_id uuid references public.barber_service_categories(id) on delete set null;

create index if not exists idx_barber_service_categories_shop
  on public.barber_service_categories(shop_id);

create index if not exists idx_barber_services_category_id
  on public.barber_services(category_id);
