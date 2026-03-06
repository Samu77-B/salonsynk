-- Add super admin flag to profiles. Only these users can access /admin.
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

comment on column public.profiles.is_super_admin is 'When true, user can access the master admin area to manage salons and view signups.';

-- To set your first super admin, run in Supabase SQL Editor:
--   update public.profiles set is_super_admin = true where email = 'your-admin@example.com';
