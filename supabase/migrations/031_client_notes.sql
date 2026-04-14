-- Structured client notes (general, colour formula, skin test, etc.)
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  note text not null,
  note_type text not null default 'general',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index idx_client_notes_client on public.client_notes(client_id);
create index idx_client_notes_salon on public.client_notes(salon_id);

alter table public.client_notes enable row level security;

create policy "Members can manage notes for their salon"
  on public.client_notes for all
  using (salon_id in (select get_my_salon_ids()))
  with check (salon_id in (select get_my_salon_ids()));
