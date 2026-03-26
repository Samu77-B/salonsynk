-- Create the appointment-photos storage bucket (public, 5MB limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('appointment-photos', 'appointment-photos', true, 5242880)
on conflict (id) do nothing;

-- Allow authenticated users to upload photos (scoped to their salon folder)
create policy "Authenticated users can upload appointment photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'appointment-photos');

-- Allow authenticated users to overwrite their uploads
create policy "Authenticated users can update appointment photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'appointment-photos');

-- Allow anyone to view appointment photos (public bucket)
create policy "Anyone can view appointment photos"
  on storage.objects for select
  to public
  using (bucket_id = 'appointment-photos');

-- Allow authenticated users to delete their photos
create policy "Authenticated users can delete appointment photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'appointment-photos');
