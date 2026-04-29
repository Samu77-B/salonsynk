-- Optional link: retail products ↔ services (checkout suggestions / filtering).

create table if not exists public.product_services (
  product_id uuid not null references public.products(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  primary key (product_id, service_id)
);

create index if not exists idx_product_services_service_id on public.product_services(service_id);

comment on table public.product_services is 'When non-empty, checkout can highlight these products when matching services are on the bill. Empty for all products = universal retail.';

alter table public.product_services enable row level security;

create policy "Members can manage product_services for their salon products"
  on public.product_services for all
  using (
    exists (
      select 1 from public.products p
      where p.id = product_services.product_id
        and p.salon_id in (select public.get_my_salon_ids())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_services.product_id
        and p.salon_id in (select public.get_my_salon_ids())
    )
  );
