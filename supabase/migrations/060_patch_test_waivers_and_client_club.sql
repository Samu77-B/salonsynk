-- Patch-test colour waivers, client club portal codes, and JoJo & Flo booking defaults.

alter table public.clients
  add column if not exists colour_waiver_signed_at timestamptz,
  add column if not exists colour_waiver_id uuid;

comment on column public.clients.colour_waiver_signed_at is
  'When the client last e-signed a colour patch-test waiver (declined patch test).';

create table if not exists public.client_waivers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  waiver_type text not null default 'colour_patch_test',
  declined_patch_test boolean not null default true,
  signer_name text not null,
  signer_email text,
  signer_phone text,
  signature_data text,
  signature_method text not null default 'typed'
    check (signature_method in ('typed', 'drawn', 'typed_and_drawn')),
  waiver_version text not null,
  waiver_text text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_waivers_salon_client
  on public.client_waivers(salon_id, client_id, signed_at desc);

alter table public.client_waivers enable row level security;

drop policy if exists "Members can read client waivers" on public.client_waivers;
create policy "Members can read client waivers"
  on public.client_waivers for select
  using (salon_id in (select get_my_salon_ids()));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_colour_waiver_id_fkey'
  ) then
    alter table public.clients
      add constraint clients_colour_waiver_id_fkey
      foreign key (colour_waiver_id) references public.client_waivers(id) on delete set null;
  end if;
end $$;

create table if not exists public.client_portal_codes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  contact text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_codes_lookup
  on public.client_portal_codes(salon_id, contact, expires_at desc);

alter table public.client_portal_codes enable row level security;

-- Enable JoJo & Flo booking rules when the salon row exists and policy is unset.
update public.salons
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'booking_policy', jsonb_build_object(
    'phone_required', true,
    'sms_confirmation', true,
    'new_client_colour_consultation', true,
    'patch_test_waiver', true,
    'club_portal_enabled', true,
    'club_name', 'JoJoFlo Club'
  )
)
where slug = 'jojoandflo'
  and (settings->'booking_policy') is null;

update public.salons
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{reminder_hours}',
  '[24, 48]'::jsonb,
  true
)
where slug = 'jojoandflo'
  and (
    settings->'reminder_hours' is null
    or jsonb_typeof(settings->'reminder_hours') <> 'array'
  );

update public.salons
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{loyalty}',
  coalesce(settings->'loyalty', '{}'::jsonb) || jsonb_build_object(
    'enabled', true,
    'program_name', 'JoJoFlo Club'
  ),
  true
)
where slug = 'jojoandflo';

-- New colour clients need a bookable consultation (JoJo currently lists Full Head / Balayage with no consult).
insert into public.services (salon_id, name, duration_minutes, price_minor)
select
  s.id,
  'Colour Consultation',
  30,
  0
from public.salons s
where s.slug = 'jojoandflo'
  and not exists (
    select 1
    from public.services svc
    where svc.salon_id = s.id
      and svc.name ilike '%consult%'
  );

