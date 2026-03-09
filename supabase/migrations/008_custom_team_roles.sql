-- Allow custom roles: salon manager can add role names; role is no longer restricted to owner/stylist.
alter table public.salon_members drop constraint if exists salon_members_role_check;
alter table public.salon_invites drop constraint if exists salon_invites_role_check;
