-- Public images for marketing campaign emails (salon-scoped paths: {salon_id}/campaigns/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-assets',
  'campaign-assets',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Authenticated users can upload campaign assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-assets');

create policy "Authenticated users can update campaign assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campaign-assets');

create policy "Anyone can view campaign assets"
  on storage.objects for select
  to public
  using (bucket_id = 'campaign-assets');

create policy "Authenticated users can delete campaign assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campaign-assets');
