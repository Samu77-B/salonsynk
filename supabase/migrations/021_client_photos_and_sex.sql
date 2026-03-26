-- Add sex column to clients (used for default avatar selection)
alter table public.clients
  add column if not exists sex text check (sex in ('male', 'female'));

-- Client photos table: each client can have up to 4 photos
-- slot 'profile' is the main avatar; 'photo_2', 'photo_3', 'photo_4' are extras
create table if not exists public.client_photos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  salon_id    uuid not null references public.salons(id) on delete cascade,
  slot        text not null check (slot in ('profile', 'photo_2', 'photo_3', 'photo_4')),
  url         text not null,
  created_at  timestamptz not null default now(),
  unique (client_id, slot)
);

alter table public.client_photos enable row level security;

create policy "Salon members can view client photos"
  on public.client_photos for select
  to authenticated
  using (
    salon_id in (
      select salon_id from public.salon_members
      where user_id = auth.uid()
    )
  );

create policy "Salon members can insert client photos"
  on public.client_photos for insert
  to authenticated
  with check (
    salon_id in (
      select salon_id from public.salon_members
      where user_id = auth.uid()
    )
  );

create policy "Salon members can update client photos"
  on public.client_photos for update
  to authenticated
  using (
    salon_id in (
      select salon_id from public.salon_members
      where user_id = auth.uid()
    )
  );

create policy "Salon members can delete client photos"
  on public.client_photos for delete
  to authenticated
  using (
    salon_id in (
      select salon_id from public.salon_members
      where user_id = auth.uid()
    )
  );

-- Create the client-photos storage bucket (public, 5MB limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-photos', 'client-photos', true, 5242880)
on conflict (id) do nothing;

-- Storage policies for client-photos bucket
create policy "Authenticated users can upload client photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'client-photos');

create policy "Authenticated users can update client photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'client-photos');

create policy "Anyone can view client photos"
  on storage.objects for select
  to public
  using (bucket_id = 'client-photos');

create policy "Authenticated users can delete client photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'client-photos');
