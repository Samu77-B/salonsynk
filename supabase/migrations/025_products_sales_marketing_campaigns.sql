-- Retail product line items on Stripe sales ledger
alter table public.sales_transactions
  add column if not exists product_ids uuid[] not null default '{}';

create index if not exists idx_sales_transactions_product_ids
  on public.sales_transactions using gin (product_ids);

-- Marketing email consent (default true for existing salons; staff can toggle per client)
alter table public.clients
  add column if not exists marketing_opt_in boolean not null default true;

-- Salon-scoped marketing campaigns
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  subject text not null default '',
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  recipient_count int not null default 0,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_campaigns_salon_created
  on public.email_campaigns(salon_id, created_at desc);

alter table public.email_campaigns enable row level security;

drop policy if exists "Members manage email campaigns" on public.email_campaigns;
create policy "Members manage email campaigns"
  on public.email_campaigns for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));
