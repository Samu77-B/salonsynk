-- Fix: salon_members had RLS policies but RLS was not enabled.
-- Ensures row level security is enforced on the table.
alter table public.salon_members enable row level security;
