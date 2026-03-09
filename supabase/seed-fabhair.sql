-- Fab Hair London seed: team members and services.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Change the slug below if your Fab Hair salon uses a different URL slug.

do $$
declare
  v_salon_id uuid;
  v_slug text := 'fabhair';  -- Change to 'fab-hair' or 'fab-hair-london' if needed
begin
  select id into v_salon_id from public.salons where slug = v_slug limit 1;
  if v_salon_id is null then
    raise notice 'Salon with slug "%" not found. Create the salon first or change v_slug.', v_slug;
    return;
  end if;

  -- Services ( Cutting & Styling )
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  select v_salon_id, n, d, 0 from (values
    ('Precision Haircut (Ladies)', 45),
    ('Precision Haircut (Gentlemen)', 30),
    ('Express Blow-dry', 30),
    ('Glamorous Styling', 45),
    ('Fringe Trim', 15),
    ('Barbering & Male Grooming', 30)
  ) as t(n, d)
  where not exists (select 1 from public.services where salon_id = v_salon_id and name = t.n);

  -- Services ( Colouring )
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  select v_salon_id, n, d, 0 from (values
    ('Balayage (Freehand)', 120),
    ('Balayage (Foil)', 120),
    ('Full Head Highlights', 90),
    ('Half Head Highlights', 75),
    ('Partial Head Highlights', 60),
    ('Permanent Colour (Full head)', 60),
    ('Permanent Colour (Roots)', 45),
    ('Semi-Permanent Colour (Full head)', 60),
    ('Semi-Permanent Colour (Roots)', 45),
    ('Bleach and Toner', 90),
    ('Colour Correction / Bespoke Colour Change', 120)
  ) as t(n, d)
  where not exists (select 1 from public.services where salon_id = v_salon_id and name = t.n);

  -- Services ( Treatments & Extensions )
  insert into public.services (salon_id, name, duration_minutes, price_minor)
  select v_salon_id, n, d, 0 from (values
    ('Olaplex™ Treatment', 60),
    ('BondRX Treatment', 60),
    ('Luxury Awapuhi Treatment (KeraTriplex™)', 90),
    ('Lavender Mint Hydrating Mineral Mask', 30),
    ('Lemon & Sage Thickening Treatment', 30),
    ('Hair Extensions (Keratin/K-Tips)', 120),
    ('Hair Extensions (Tapes)', 120)
  ) as t(n, d)
  where not exists (select 1 from public.services where salon_id = v_salon_id and name = t.n);

  -- Team members (display-only, user_id null; owner can link accounts later)
  insert into public.salon_members (salon_id, user_id, role, display_name, is_active)
  select v_salon_id, null, r, d, true from (values
    ('Salon Director', 'Kiri'),
    ('Advanced Senior Stylist & Salon Manager', 'Christina'),
    ('Advanced Senior Stylist', 'Andy'),
    ('Advanced Senior Stylist', 'Angela'),
    ('Advanced Senior Stylist', 'Elena'),
    ('Senior Stylist', 'Baz'),
    ('Stylist', 'Sara'),
    ('Stylist', 'Molly')
  ) as t(r, d)
  where not exists (
    select 1 from public.salon_members
    where salon_id = v_salon_id and user_id is null and display_name = t.d
  );

  raise notice 'Fab Hair seed complete for salon %.', v_salon_id;
end $$;
