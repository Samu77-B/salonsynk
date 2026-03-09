-- Remove signups except hello@salonsynk.com
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Deletes banningp@gmail.com and banning@hotmail.com from auth.users.
-- Cascades will remove their profiles and salon_members rows.

delete from auth.users
where email in ('banningp@gmail.com', 'banning@hotmail.com');
