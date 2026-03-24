-- Ledger of successful Stripe sales for finance-accurate reporting.
create table if not exists public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  stylist_id uuid references public.salon_members(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  stripe_payment_intent_id text not null unique,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'gbp',
  employment_type text,
  service_ids text[] not null default '{}',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_transactions_salon_paid_at
  on public.sales_transactions(salon_id, paid_at);

create index if not exists idx_sales_transactions_stylist
  on public.sales_transactions(stylist_id);

alter table public.sales_transactions enable row level security;

drop policy if exists "Members can read sales transactions" on public.sales_transactions;
create policy "Members can read sales transactions"
  on public.sales_transactions for select
  using (salon_id in (select get_my_salon_ids()));

