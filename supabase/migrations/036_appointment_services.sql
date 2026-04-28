-- Many-to-many: one appointment visit can include multiple services (combined block on the diary).

create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  sort_order int not null default 0,
  unique (appointment_id, service_id)
);

create index if not exists idx_appointment_services_appointment_id on public.appointment_services(appointment_id);
create index if not exists idx_appointment_services_service_id on public.appointment_services(service_id);

comment on table public.appointment_services is 'Services included in a single visit; order matches sort_order. appointments.service_id remains the primary/first for legacy joins.';

-- Backfill from legacy single FK
insert into public.appointment_services (appointment_id, service_id, sort_order)
select id, service_id, 0
from public.appointments
where service_id is not null
on conflict do nothing;

alter table public.appointment_services enable row level security;

create policy "Members can manage appointment_services"
  on public.appointment_services for all
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.salon_id in (select public.get_my_salon_ids())
    )
  )
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.salon_id in (select public.get_my_salon_ids())
    )
  );
