-- Fab Hair London: Create salon (if needed) and add team + services.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Creates "Fab Hair London" with slug "fabhair" if it doesn't exist, then seeds team and services.
-- After running, assign owner via Admin → Salons → Edit Fab Hair → Add owner by email (e.g. hello@salonsynk.com).

do $$
declare
  v_salon_id uuid;
  v_slug text := 'fabhair';
begin
  select id into v_salon_id from public.salons where slug = v_slug limit 1;
  if v_salon_id is null then
    insert into public.salons (name, slug)
    values ('Fab Hair London', v_slug)
    returning id into v_salon_id;
    raise notice 'Created salon Fab Hair London (%).', v_salon_id;
  else
    raise notice 'Salon already exists (%).', v_salon_id;
  end if;

  -- Delete existing data so we can re-seed cleanly
  delete from public.appointments where salon_id = v_salon_id;
  delete from public.salon_invites where salon_id = v_salon_id;
  delete from public.salon_members where salon_id = v_salon_id;
  delete from public.services where salon_id = v_salon_id;
  delete from public.clients where salon_id = v_salon_id;

  -- Services: Cutting & Styling
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  values
    (v_salon_id, 'Precision Haircut (Ladies)', 45, 0),
    (v_salon_id, 'Precision Haircut (Gentlemen)', 30, 0),
    (v_salon_id, 'Express Blow-dry', 30, 0),
    (v_salon_id, 'Glamorous Styling', 45, 0),
    (v_salon_id, 'Fringe Trim', 15, 0),
    (v_salon_id, 'Barbering & Male Grooming', 30, 0);

  -- Services: Colouring
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  values
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
    (v_salon_id, 'Colour Correction / Bespoke Colour Change', 120, 0);

  -- Services: Treatments & Extensions
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  values
    (v_salon_id, 'Olaplex™ Treatment', 60, 0),
    (v_salon_id, 'BondRX Treatment', 60, 0),
    (v_salon_id, 'Luxury Awapuhi Treatment (KeraTriplex™)', 90, 0),
    (v_salon_id, 'Lavender Mint Hydrating Mineral Mask', 30, 0),
    (v_salon_id, 'Lemon & Sage Thickening Treatment', 30, 0),
    (v_salon_id, 'Hair Extensions (Keratin/K-Tips)', 120, 0),
    (v_salon_id, 'Hair Extensions (Tapes)', 120, 0);

  -- Team
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

  raise notice 'Fab Hair London ready. 24 services, 8 team members. Booking: /book/fabhair';
  raise notice 'Assign owner: Admin → Salons → Edit Fab Hair → Add owner by email (hello@salonsynk.com)';
end $$;
