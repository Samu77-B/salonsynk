-- Retail products (separate from appointment services).
create table public.products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price_minor int not null default 0 check (price_minor >= 0),
  currency text not null default 'gbp',
  is_active boolean not null default true,
  sort_order int not null default 0,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_products_salon on public.products(salon_id);
create index idx_products_salon_active on public.products(salon_id, is_active);
create index idx_products_salon_sort on public.products(salon_id, sort_order, name);

alter table public.products enable row level security;

create policy "Members can manage products"
  on public.products for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));
