-- Per-stylist custom duration overrides for services.
-- Falls back to services.duration_minutes when no override exists.
create table public.stylist_service_overrides (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.salon_members(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  custom_duration_minutes int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(stylist_id, service_id)
);

create index idx_stylist_overrides_stylist on public.stylist_service_overrides(stylist_id);
create index idx_stylist_overrides_service on public.stylist_service_overrides(service_id);

alter table public.stylist_service_overrides enable row level security;

create policy "Members can read overrides for their salon"
  on public.stylist_service_overrides for select
  using (
    stylist_id in (
      select id from public.salon_members
      where salon_id in (select get_my_salon_ids())
    )
  );

create policy "Members can manage overrides for their salon"
  on public.stylist_service_overrides for all
  using (
    stylist_id in (
      select id from public.salon_members
      where salon_id in (select get_my_salon_ids())
    )
  );
