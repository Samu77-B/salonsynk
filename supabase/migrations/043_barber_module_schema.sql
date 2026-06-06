-- Barber Synk module schema.
--
-- Barber shops differ from salons in three key ways:
--   1. Walk-in-first workflow: customers join a live queue rather than pre-booking a time slot.
--   2. Queue management: barbers pull the next customer from a real-time ordered queue.
--   3. Hybrid booking: pre-booked appointments coexist with the walk-in queue —
--      a pre-booked slot takes priority over the queue at its scheduled time.
--
-- This migration adds barber-specific tables alongside the existing salon tables.
-- The shared `profiles`, `salon_members`, `clients`, `services`, and `sales_transactions`
-- tables are reused via the tenant column `shop_id` (FK to `barber_shops`).

-- ============================================================================
-- 1. barber_shops — the barber tenant (mirrors `salons` for the barber module)
-- ============================================================================
create table public.barber_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,

  -- Stripe
  stripe_connect_account_id text,
  stripe_billing_customer_id text,
  subscription_status text default 'inactive'
    check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  plan_tier text not null default 'professional'
    check (plan_tier in ('essentials', 'professional', 'complete')),
  feature_overrides jsonb not null default '{}',

  -- Payment gateway for in-shop sales (card machine, cash, etc.)
  payment_gateway text not null default 'stripe'
    check (payment_gateway in ('stripe', 'worldpay', 'dojo', 'other_pos')),

  -- Queue settings
  max_queue_size int not null default 20,
  estimated_wait_visible boolean not null default true,

  -- Onboarding
  payment_invite_token text unique,
  subscription_required boolean not null default false,
  onboarding_welcome_sent_at timestamptz,
  onboarding_setup_email_sent_at timestamptz,

  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column public.barber_shops.max_queue_size is
  'Maximum customers allowed in the walk-in queue. 0 = unlimited.';
comment on column public.barber_shops.estimated_wait_visible is
  'Whether the public queue screen shows estimated wait times.';

-- ============================================================================
-- 2. barber_members — which user belongs to which barber shop
-- ============================================================================
create table public.barber_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'barber',
  display_name text,
  avatar_url text,
  is_active boolean not null default true,
  is_accepting_walk_ins boolean not null default true,
  chair_number int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shop_id, user_id)
);

comment on column public.barber_members.is_accepting_walk_ins is
  'When false, this barber won''t appear on the walk-in queue screen.';
comment on column public.barber_members.chair_number is
  'Optional physical chair/station number for display on the queue screen.';

-- ============================================================================
-- 3. barber_services — service catalogue per shop
-- ============================================================================
create table public.barber_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  duration_minutes int not null default 30,
  price_minor int not null default 0,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 4. barber_clients — client records per shop
-- ============================================================================
create table public.barber_clients (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  name text,
  email text,
  phone text,
  notes text,
  preferred_barber_id uuid references public.barber_members(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column public.barber_clients.preferred_barber_id is
  'If set, walk-in check-in can auto-assign this barber when available.';

-- ============================================================================
-- 5. barber_queue — the live walk-in queue
-- ============================================================================
create table public.barber_queue (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  client_id uuid references public.barber_clients(id) on delete set null,

  -- Guest walk-ins (no client record)
  guest_name text,
  guest_phone text,

  service_id uuid references public.barber_services(id) on delete set null,
  preferred_barber_id uuid references public.barber_members(id) on delete set null,
  assigned_barber_id uuid references public.barber_members(id) on delete set null,

  position int not null default 0,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_chair', 'completed', 'no_show', 'left')),

  -- Payment
  payment_method text check (payment_method in ('card', 'cash', 'other')),
  amount_paid_minor int,

  joined_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_wait_minutes int,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column public.barber_queue.position is
  'Sort position in the queue. Lower = closer to front.';
comment on column public.barber_queue.status is
  'waiting = in queue; in_chair = being served; completed/no_show/left = terminal states.';
comment on column public.barber_queue.called_at is
  'When the barber called this customer from the queue.';
comment on column public.barber_queue.started_at is
  'When the cut/service actually started (customer sat in chair).';
comment on column public.barber_queue.payment_method is
  'How the customer paid: card, cash, or other.';

-- ============================================================================
-- 6. barber_appointments — pre-booked appointments (hybrid model)
-- ============================================================================
create table public.barber_appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  barber_id uuid not null references public.barber_members(id) on delete restrict,
  client_id uuid references public.barber_clients(id) on delete set null,
  service_id uuid references public.barber_services(id) on delete set null,

  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_chair', 'completed', 'no_show', 'canceled')),

  -- Guest bookings (no client record)
  guest_name text,
  guest_email text,
  guest_phone text,

  -- Payment
  payment_method text check (payment_method in ('card', 'cash', 'other')),
  amount_paid_minor int,
  deposit_payment_intent_id text,

  notes text,
  source text not null default 'booking'
    check (source in ('booking', 'walk_in')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column public.barber_appointments.source is
  'booking = pre-booked online/phone; walk_in = promoted from the walk-in queue.';
comment on column public.barber_appointments.status is
  'in_chair mirrors the queue status so diary view stays consistent.';

-- ============================================================================
-- 7. barber_sales_transactions — ledger for finance reporting
-- ============================================================================
create table public.barber_sales_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barber_shops(id) on delete cascade,
  barber_id uuid references public.barber_members(id) on delete set null,
  client_id uuid references public.barber_clients(id) on delete set null,
  queue_entry_id uuid references public.barber_queue(id) on delete set null,
  appointment_id uuid references public.barber_appointments(id) on delete set null,
  stripe_payment_intent_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'gbp',
  payment_method text check (payment_method in ('card', 'cash', 'other')),
  payment_gateway text,
  service_ids text[] not null default '{}',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. Indexes
-- ============================================================================
create index idx_barber_members_shop on public.barber_members(shop_id);
create index idx_barber_members_user on public.barber_members(user_id);
create index idx_barber_services_shop on public.barber_services(shop_id);
create index idx_barber_clients_shop on public.barber_clients(shop_id);
create index idx_barber_queue_shop_status on public.barber_queue(shop_id, status);
create index idx_barber_queue_shop_position on public.barber_queue(shop_id, position)
  where status = 'waiting';
create index idx_barber_appointments_shop on public.barber_appointments(shop_id);
create index idx_barber_appointments_barber on public.barber_appointments(barber_id);
create index idx_barber_appointments_start on public.barber_appointments(start_time);
create index idx_barber_sales_shop_paid on public.barber_sales_transactions(shop_id, paid_at);

-- ============================================================================
-- 9. RLS
-- ============================================================================
alter table public.barber_shops enable row level security;
alter table public.barber_members enable row level security;
alter table public.barber_services enable row level security;
alter table public.barber_clients enable row level security;
alter table public.barber_queue enable row level security;
alter table public.barber_appointments enable row level security;
alter table public.barber_sales_transactions enable row level security;

-- Helper: get barber_shop IDs the current user belongs to
create or replace function public.get_my_barber_shop_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select shop_id from public.barber_members
  where user_id = auth.uid() and is_active = true;
$$;

-- barber_shops
create policy "Members can read own barber shops"
  on public.barber_shops for select
  using (id in (select get_my_barber_shop_ids()));

create policy "Members can update own barber shop"
  on public.barber_shops for update
  using (id in (select get_my_barber_shop_ids()));

create policy "Authenticated users can create barber shops"
  on public.barber_shops for insert
  with check (auth.uid() is not null);

-- barber_members
create policy "Members can read barber_members"
  on public.barber_members for select
  using (shop_id in (select get_my_barber_shop_ids()));

create policy "Users can insert own barber membership"
  on public.barber_members for insert
  with check (user_id = auth.uid());

create policy "Owners can manage barber_members"
  on public.barber_members for all
  using (
    shop_id in (select get_my_barber_shop_ids())
    and exists (
      select 1 from public.barber_members bm
      where bm.shop_id = barber_members.shop_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

-- barber_services
create policy "Members can manage barber_services"
  on public.barber_services for all
  using (shop_id in (select get_my_barber_shop_ids()))
  with check (shop_id in (select get_my_barber_shop_ids()));

-- barber_clients
create policy "Members can manage barber_clients"
  on public.barber_clients for all
  using (shop_id in (select get_my_barber_shop_ids()))
  with check (shop_id in (select get_my_barber_shop_ids()));

-- barber_queue
create policy "Members can manage barber_queue"
  on public.barber_queue for all
  using (shop_id in (select get_my_barber_shop_ids()))
  with check (shop_id in (select get_my_barber_shop_ids()));

-- barber_appointments
create policy "Members can manage barber_appointments"
  on public.barber_appointments for all
  using (shop_id in (select get_my_barber_shop_ids()))
  with check (shop_id in (select get_my_barber_shop_ids()));

-- barber_sales_transactions
create policy "Members can read barber_sales_transactions"
  on public.barber_sales_transactions for select
  using (shop_id in (select get_my_barber_shop_ids()));
