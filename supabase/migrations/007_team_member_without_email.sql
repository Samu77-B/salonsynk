-- Allow adding team members without email (e.g. staff who don't have an account yet).
-- user_id becomes nullable; members without user_id are display-only until linked later.
alter table public.salon_members
  alter column user_id drop not null;

-- Storage bucket for team member profile images (public read).
-- If this fails (e.g. bucket already exists), create bucket "team-avatars" in Dashboard → Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-avatars',
  'team-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);
