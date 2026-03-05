-- SalonSynk initial schema: salons, members, clients, services, appointments.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Salons (tenants)
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  stripe_connect_account_id text,
  subscription_status text default 'inactive' check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Link auth.users to app; optional profile per user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Salon membership: which user belongs to which salon and their role
create table public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'stylist')),
  display_name text,
  avatar_url text,
  holiday_ranges daterange[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(salon_id, user_id)
);

-- Clients per salon
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text,
  email text,
  phone text,
  notes text,
  color_formulas jsonb default '[]',
  patch_test_due_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Services per salon
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  duration_minutes int not null default 60,
  price_minor int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  stylist_id uuid not null references public.salon_members(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'no_show', 'canceled')),
  deposit_payment_intent_id text,
  guest_name text,
  guest_email text,
  guest_phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index idx_salon_members_salon on public.salon_members(salon_id);
create index idx_salon_members_user on public.salon_members(user_id);
create index idx_clients_salon on public.clients(salon_id);
create index idx_services_salon on public.services(salon_id);
create index idx_appointments_salon on public.appointments(salon_id);
create index idx_appointments_stylist on public.appointments(stylist_id);
create index idx_appointments_start on public.appointments(start_time);

-- RLS: enable on all tables
alter table public.salons enable row level security;
alter table public.profiles enable row level security;
alter table public.salon_members enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- Helper: get salon_ids the current user is a member of
create or replace function public.get_my_salon_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select salon_id from public.salon_members
  where user_id = auth.uid() and is_active = true;
$$;

-- Policies: salons — members can read their salons
create policy "Members can read own salons"
  on public.salons for select
  using (id in (select get_my_salon_ids()));

create policy "Members can update own salon"
  on public.salons for update
  using (id in (select get_my_salon_ids()));

-- Owners can insert (first salon created via app or onboarding)
create policy "Authenticated users can create salons"
  on public.salons for insert
  with check (auth.uid() is not null);

-- Profiles: users can read/update own
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Salon members: only see members of salons you belong to
create policy "Members can read salon_members"
  on public.salon_members for select
  using (salon_id in (select get_my_salon_ids()));

create policy "Owners can manage salon_members"
  on public.salon_members for all
  using (
    salon_id in (select get_my_salon_ids())
    and exists (
      select 1 from public.salon_members sm
      where sm.salon_id = salon_members.salon_id and sm.user_id = auth.uid() and sm.role = 'owner'
    )
  );

-- Allow insert for own membership (e.g. owner adding themselves when creating salon)
create policy "Users can insert own membership"
  on public.salon_members for insert
  with check (user_id = auth.uid());

-- Clients: salon-scoped
create policy "Members can manage clients"
  on public.clients for all
  using (salon_id in (select get_my_salon_ids()));

-- Services: salon-scoped
create policy "Members can manage services"
  on public.services for all
  using (salon_id in (select get_my_salon_ids()));

-- Appointments: salon-scoped
create policy "Members can manage appointments"
  on public.appointments for all
  using (salon_id in (select get_my_salon_ids()));

-- Trigger: create profile on signup (optional)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
