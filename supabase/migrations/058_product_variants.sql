-- Colour / size / stock variants for retail products.
-- Products with no rows here behave as before (no stock tracking).

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  color text not null default '',
  size text not null default '',
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_variants_product on public.product_variants(product_id);
create index if not exists idx_product_variants_salon on public.product_variants(salon_id);

create unique index if not exists product_variants_product_color_size_uidx
  on public.product_variants (product_id, lower(color), lower(size));

comment on table public.product_variants is
  'Optional SKUs per product. Empty color+size = stock-only. Missing row = that colour/size is not sold.';

alter table public.product_variants enable row level security;

drop policy if exists "Members can manage product variants" on public.product_variants;
create policy "Members can manage product variants"
  on public.product_variants for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));

alter table public.sales_transactions
  add column if not exists product_variant_ids uuid[] not null default '{}';

alter table public.sales_transactions
  add column if not exists stock_applied boolean not null default false;

create index if not exists idx_sales_transactions_product_variant_ids
  on public.sales_transactions using gin (product_variant_ids);

-- Idempotent: decrement stock once per recorded sale (Stripe webhook retries are safe).
create or replace function public.apply_product_variant_stock(p_payment_intent_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_applied boolean;
  vid uuid;
begin
  if p_payment_intent_id is null or btrim(p_payment_intent_id) = '' then
    return false;
  end if;

  select product_variant_ids, stock_applied
    into v_ids, v_applied
  from public.sales_transactions
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    return false;
  end if;

  if v_applied then
    return false;
  end if;

  update public.sales_transactions
  set stock_applied = true
  where stripe_payment_intent_id = p_payment_intent_id;

  if v_ids is not null then
    foreach vid in array v_ids loop
      update public.product_variants
      set
        stock_quantity = greatest(0, stock_quantity - 1),
        updated_at = now()
      where id = vid;
    end loop;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_product_variant_stock(text) from public;
grant execute on function public.apply_product_variant_stock(text) to service_role;
grant execute on function public.apply_product_variant_stock(text) to authenticated;
