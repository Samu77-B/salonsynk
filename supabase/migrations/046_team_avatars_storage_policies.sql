-- team-avatars bucket had no storage policies; raise size limit for portrait photos.

update storage.buckets
set file_size_limit = 5242880
where id = 'team-avatars';

drop policy if exists "Authenticated users can upload team avatars" on storage.objects;
drop policy if exists "Authenticated users can update team avatars" on storage.objects;
drop policy if exists "Anyone can view team avatars" on storage.objects;
drop policy if exists "Authenticated users can delete team avatars" on storage.objects;

create policy "Authenticated users can upload team avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'team-avatars');

create policy "Authenticated users can update team avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'team-avatars');

create policy "Anyone can view team avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'team-avatars');

create policy "Authenticated users can delete team avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'team-avatars');
