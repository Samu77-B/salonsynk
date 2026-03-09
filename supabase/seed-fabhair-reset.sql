-- Fab Hair London: DELETE all data for the salon, then re-seed with team + services.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- OPTION A: Set v_salon_id_direct to your Fab Hair salon_id (copy from salon_members table) - most reliable
-- OPTION B: Set v_use_salon_id := false and change v_slug to look up by slug
-- WARNING: This deletes appointments, clients, team members, services, and invites for this salon.
-- You may need to reassign the owner via Admin after running (if Kiri had an account).

do $$
declare
  v_salon_id uuid;
  v_use_salon_id boolean := true;
  v_salon_id_direct uuid := 'e12c0356-0978-4ea0-9480-6bf17c8e8f5e';  -- Paste your Fab Hair salon_id here
  v_slug text := 'fabhair';
begin
  if v_use_salon_id and v_salon_id_direct is not null then
    v_salon_id := v_salon_id_direct;
    if not exists (select 1 from public.salons where id = v_salon_id) then
      raise exception 'Salon id % not found. Get the correct salon_id from salons table.', v_salon_id;
    end if;
  else
    select id into v_salon_id from public.salons where slug = v_slug limit 1;
    if v_salon_id is null then
      raise exception 'Salon with slug "%" not found. Set v_use_salon_id := true and paste salon_id.', v_slug;
    end if;
  end if;

  -- 1. Delete in order (respecting foreign keys)
  delete from public.appointments where salon_id = v_salon_id;
  delete from public.salon_invites where salon_id = v_salon_id;
  delete from public.salon_members where salon_id = v_salon_id;
  delete from public.services where salon_id = v_salon_id;
  delete from public.clients where salon_id = v_salon_id;

  raise notice 'Deleted all Fab Hair data for salon %.', v_salon_id;

  -- 2. Re-seed services
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  values
    (v_salon_id, 'Precision Haircut (Ladies)', 45, 0),
    (v_salon_id, 'Precision Haircut (Gentlemen)', 30, 0),
    (v_salon_id, 'Express Blow-dry', 30, 0),
    (v_salon_id, 'Glamorous Styling', 45, 0),
    (v_salon_id, 'Fringe Trim', 15, 0),
    (v_salon_id, 'Barbering & Male Grooming', 30, 0),
    (v_salon_id, 'Balayage (Freehand)', 120, 0),
    (v_salon_id, 'Balayage (Foil)', 120, 0),
    (v_salon_id, 'Full Head Highlights', 90, 0),
    (v_salon_id, 'Half Head Highlights', 75, 0),
    (v_salon_id, 'Partial Head Highlights', 60, 0),
    (v_salon_id, 'Permanent Colour (Full head)', 60, 0),
    (v_salon_id, 'Permanent Colour (Roots)', 45, 0),
    (v_salon_id, 'Semi-Permanent Colour (Full head)', 60, 0),
    (v_salon_id, 'Semi-Permanent Colour (Roots)', 45, 0),
    (v_salon_id, 'Bleach and Toner', 90, 0),
    (v_salon_id, 'Colour Correction / Bespoke Colour Change', 120, 0),
    (v_salon_id, 'Olaplex™ Treatment', 60, 0),
    (v_salon_id, 'BondRX Treatment', 60, 0),
    (v_salon_id, 'Luxury Awapuhi Treatment (KeraTriplex™)', 90, 0),
    (v_salon_id, 'Lavender Mint Hydrating Mineral Mask', 30, 0),
    (v_salon_id, 'Lemon & Sage Thickening Treatment', 30, 0),
    (v_salon_id, 'Hair Extensions (Keratin/K-Tips)', 120, 0),
    (v_salon_id, 'Hair Extensions (Tapes)', 120, 0);

  -- 3. Re-seed team members (display-only, user_id null)
  insert into public.salon_members (salon_id, user_id, role, display_name, is_active)
  values
    (v_salon_id, null, 'Salon Director', 'Kiri', true),
    (v_salon_id, null, 'Advanced Senior Stylist & Salon Manager', 'Christina', true),
    (v_salon_id, null, 'Advanced Senior Stylist', 'Andy', true),
    (v_salon_id, null, 'Advanced Senior Stylist', 'Angela', true),
    (v_salon_id, null, 'Advanced Senior Stylist', 'Elena', true),
    (v_salon_id, null, 'Senior Stylist', 'Baz', true),
    (v_salon_id, null, 'Stylist', 'Sara', true),
    (v_salon_id, null, 'Stylist', 'Molly', true);

  raise notice 'Fab Hair reset complete. Re-seeded 24 services and 8 team members.';
  raise notice 'If Kiri had an account, reassign owner via Admin → Salons → Edit → Add owner by email.';
end $$;
