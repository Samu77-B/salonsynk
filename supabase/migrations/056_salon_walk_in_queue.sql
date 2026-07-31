-- SalonSynk walk-in queue (QR join page + live queue dashboard), mirroring BarberSynk / NailSynk.

alter table public.salons
  add column if not exists max_queue_size int not null default 20,
  add column if not exists estimated_wait_visible boolean not null default true;

comment on column public.salons.max_queue_size is
  'Maximum customers in the walk-in queue. 0 = unlimited.';
comment on column public.salons.estimated_wait_visible is
  'Whether the public walk-in page shows estimated wait times.';

alter table public.salon_members
  add column if not exists is_accepting_walk_ins boolean not null default true;

comment on column public.salon_members.is_accepting_walk_ins is
  'When false, this stylist won''t appear on the public walk-in join page.';

create table if not exists public.salon_queue (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  guest_name text,
  guest_phone text,
  service_id uuid references public.services(id) on delete set null,
  preferred_stylist_id uuid references public.salon_members(id) on delete set null,
  assigned_stylist_id uuid references public.salon_members(id) on delete set null,
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

comment on column public.salon_queue.position is
  'Sort position in the queue. Lower = closer to front.';

create index if not exists idx_salon_queue_salon_status on public.salon_queue(salon_id, status);
create index if not exists idx_salon_queue_salon_position on public.salon_queue(salon_id, position)
  where status = 'waiting';

alter table public.salon_queue enable row level security;

drop policy if exists "Members can manage salon_queue" on public.salon_queue;
create policy "Members can manage salon_queue"
  on public.salon_queue for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));

alter table public.salon_queue replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.salon_queue;
exception
  when duplicate_object then null;
end $$;

-- Owners hidden from public stylist picker unless explicitly enabled (same as barber/nail).
update public.salon_members
set is_accepting_walk_ins = false
where lower(role) = 'owner'
  and is_accepting_walk_ins = true;
