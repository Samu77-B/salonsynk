-- Nail Synk module schema.
--
-- Hybrid vertical: walk-in queue (BarberSynk) + full appointment diary (SalonSynk).
-- Pre-booked nail_appointments take priority over the walk-in queue at scheduled time.

-- ============================================================================
-- 1. nail_salons — tenant
-- ============================================================================
create table public.nail_salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,

  stripe_connect_account_id text,
  stripe_billing_customer_id text,
  subscription_status text default 'inactive'
    check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  plan_tier text not null default 'professional'
    check (plan_tier in ('essentials', 'professional', 'complete')),
  feature_overrides jsonb not null default '{}',

  payment_gateway text not null default 'stripe'
    check (payment_gateway in ('stripe', 'worldpay', 'dojo', 'other_pos')),

  max_queue_size int not null default 20,
  estimated_wait_visible boolean not null default true,

  payment_invite_token text unique,
  subscription_required boolean not null default false,
  onboarding_welcome_sent_at timestamptz,
  onboarding_setup_email_sent_at timestamptz,

  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column public.nail_salons.max_queue_size is
  'Maximum customers allowed in the walk-in queue. 0 = unlimited.';

-- ============================================================================
-- 2. nail_members — staff (salon + queue fields)
-- ============================================================================
create table public.nail_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'technician',
  display_name text,
  avatar_url text,
  is_active boolean not null default true,
  is_accepting_walk_ins boolean not null default true,
  show_on_diary boolean not null default true,
  station_number int,
  employment_type text not null default 'EMPLOYEE'
    check (employment_type in ('EMPLOYEE', 'RENTER')),
  passcode_hash text,
  holiday_ranges daterange[] default '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(salon_id, user_id)
);

comment on column public.nail_members.user_id is
  'Optional auth user link. Null for queue-only technician profiles until they sign up.';
comment on column public.nail_members.station_number is
  'Optional physical station number for display on the queue screen.';

-- ============================================================================
-- 3. nail_service_categories
-- ============================================================================
create table public.nail_service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 4. nail_services
-- ============================================================================
create table public.nail_services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  category_id uuid references public.nail_service_categories(id) on delete set null,
  name text not null,
  duration_minutes int not null default 60,
  processing_time_minutes int not null default 0,
  price_minor int not null default 0,
  color text,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 5. nail_technician_service_overrides
-- ============================================================================
create table public.nail_technician_service_overrides (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.nail_members(id) on delete cascade,
  service_id uuid not null references public.nail_services(id) on delete cascade,
  duration_minutes int not null,
  unique (technician_id, service_id)
);

-- ============================================================================
-- 6. nail_clients
-- ============================================================================
create table public.nail_clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  name text,
  email text,
  phone text,
  notes text,
  patch_test_due_at timestamptz,
  last_skin_test_at timestamptz,
  preferred_technician_id uuid references public.nail_members(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 7. nail_queue — walk-in queue
-- ============================================================================
create table public.nail_queue (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  client_id uuid references public.nail_clients(id) on delete set null,
  guest_name text,
  guest_phone text,
  service_id uuid references public.nail_services(id) on delete set null,
  preferred_technician_id uuid references public.nail_members(id) on delete set null,
  assigned_technician_id uuid references public.nail_members(id) on delete set null,
  position int not null default 0,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_chair', 'completed', 'no_show', 'left')),
  payment_method text check (payment_method in ('card', 'cash', 'other')),
  amount_paid_minor int,
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_wait_minutes int,
  next_sms_sent_at timestamptz,
  almost_next_sms_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 8. nail_appointments — diary
-- ============================================================================
create table public.nail_appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  technician_id uuid not null references public.nail_members(id) on delete restrict,
  client_id uuid references public.nail_clients(id) on delete set null,
  service_id uuid references public.nail_services(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'no_show', 'canceled')),
  guest_name text,
  guest_email text,
  guest_phone text,
  notes text,
  deposit_payment_intent_id text,
  bill_total_minor integer,
  deposit_amount_minor integer,
  confirmation_sent_at timestamptz,
  source text not null default 'booking'
    check (source in ('booking', 'walk_in', 'diary')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 9. nail_appointment_services
-- ============================================================================
create table public.nail_appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.nail_appointments(id) on delete cascade,
  service_id uuid not null references public.nail_services(id) on delete restrict,
  sort_order int not null default 0,
  price_override_minor integer,
  assigned_technician_id uuid references public.nail_members(id) on delete set null,
  unique (appointment_id, service_id)
);

-- ============================================================================
-- 10. nail_sales_transactions
-- ============================================================================
create table public.nail_sales_transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.nail_salons(id) on delete cascade,
  technician_id uuid references public.nail_members(id) on delete set null,
  client_id uuid references public.nail_clients(id) on delete set null,
  queue_entry_id uuid references public.nail_queue(id) on delete set null,
  appointment_id uuid references public.nail_appointments(id) on delete set null,
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
-- 11. Indexes
-- ============================================================================
create index idx_nail_members_salon on public.nail_members(salon_id);
create index idx_nail_members_user on public.nail_members(user_id);
create index idx_nail_service_categories_salon on public.nail_service_categories(salon_id);
create index idx_nail_services_salon on public.nail_services(salon_id);
create index idx_nail_services_category on public.nail_services(category_id);
create index idx_nail_technician_overrides_tech on public.nail_technician_service_overrides(technician_id);
create index idx_nail_clients_salon on public.nail_clients(salon_id);
create index idx_nail_queue_salon_status on public.nail_queue(salon_id, status);
create index idx_nail_queue_salon_position on public.nail_queue(salon_id, position)
  where status = 'waiting';
create index idx_nail_appointments_salon on public.nail_appointments(salon_id);
create index idx_nail_appointments_technician on public.nail_appointments(technician_id);
create index idx_nail_appointments_start on public.nail_appointments(start_time);
create index idx_nail_appointment_services_appt on public.nail_appointment_services(appointment_id);
create index idx_nail_sales_salon_paid on public.nail_sales_transactions(salon_id, paid_at);

-- ============================================================================
-- 12. RLS helpers
-- ============================================================================
create or replace function public.get_my_nail_salon_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select salon_id from public.nail_members
  where user_id = auth.uid() and is_active = true;
$$;

create or replace function public.is_owner_of_nail_salon(p_salon_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.nail_members
    where salon_id = p_salon_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================================================
-- 13. RLS policies
-- ============================================================================
alter table public.nail_salons enable row level security;
alter table public.nail_members enable row level security;
alter table public.nail_service_categories enable row level security;
alter table public.nail_services enable row level security;
alter table public.nail_technician_service_overrides enable row level security;
alter table public.nail_clients enable row level security;
alter table public.nail_queue enable row level security;
alter table public.nail_appointments enable row level security;
alter table public.nail_appointment_services enable row level security;
alter table public.nail_sales_transactions enable row level security;

create policy "Members can read own nail salons"
  on public.nail_salons for select
  using (id in (select get_my_nail_salon_ids()));

create policy "Members can update own nail salon"
  on public.nail_salons for update
  using (id in (select get_my_nail_salon_ids()));

create policy "Authenticated users can create nail salons"
  on public.nail_salons for insert
  with check (auth.uid() is not null);

create policy "Members can read nail_members"
  on public.nail_members for select
  using (salon_id in (select get_my_nail_salon_ids()));

create policy "Users can insert own nail membership"
  on public.nail_members for insert
  with check (user_id = auth.uid());

create policy "Owners can manage nail_members"
  on public.nail_members for all
  using (
    salon_id in (select get_my_nail_salon_ids())
    and is_owner_of_nail_salon(salon_id)
  )
  with check (
    salon_id in (select get_my_nail_salon_ids())
    and is_owner_of_nail_salon(salon_id)
  );

create policy "Members can manage nail_service_categories"
  on public.nail_service_categories for all
  using (salon_id in (select get_my_nail_salon_ids()))
  with check (salon_id in (select get_my_nail_salon_ids()));

create policy "Members can manage nail_services"
  on public.nail_services for all
  using (salon_id in (select get_my_nail_salon_ids()))
  with check (salon_id in (select get_my_nail_salon_ids()));

create policy "Members can manage nail_technician_service_overrides"
  on public.nail_technician_service_overrides for all
  using (
    exists (
      select 1 from public.nail_members m
      where m.id = nail_technician_service_overrides.technician_id
        and m.salon_id in (select get_my_nail_salon_ids())
    )
  )
  with check (
    exists (
      select 1 from public.nail_members m
      where m.id = nail_technician_service_overrides.technician_id
        and m.salon_id in (select get_my_nail_salon_ids())
    )
  );

create policy "Members can manage nail_clients"
  on public.nail_clients for all
  using (salon_id in (select get_my_nail_salon_ids()))
  with check (salon_id in (select get_my_nail_salon_ids()));

create policy "Members can manage nail_queue"
  on public.nail_queue for all
  using (salon_id in (select get_my_nail_salon_ids()))
  with check (salon_id in (select get_my_nail_salon_ids()));

create policy "Members can manage nail_appointments"
  on public.nail_appointments for all
  using (salon_id in (select get_my_nail_salon_ids()))
  with check (salon_id in (select get_my_nail_salon_ids()));

create policy "Members can manage nail_appointment_services"
  on public.nail_appointment_services for all
  using (
    exists (
      select 1 from public.nail_appointments a
      where a.id = nail_appointment_services.appointment_id
        and a.salon_id in (select get_my_nail_salon_ids())
    )
  )
  with check (
    exists (
      select 1 from public.nail_appointments a
      where a.id = nail_appointment_services.appointment_id
        and a.salon_id in (select get_my_nail_salon_ids())
    )
  );

create policy "Members can read nail_sales_transactions"
  on public.nail_sales_transactions for select
  using (salon_id in (select get_my_nail_salon_ids()));

-- Realtime for live queue
alter table public.nail_queue replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.nail_queue;
exception
  when duplicate_object then null;
end $$;

update public.nail_members
set is_accepting_walk_ins = false
where role = 'owner'
  and is_accepting_walk_ins = true;
