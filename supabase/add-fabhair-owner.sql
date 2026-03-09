-- Add owner to Fab Hair London so they can log in and manage the salon.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Change the email below to the owner's email. They must have signed up first.

do $$
declare
  v_salon_id uuid;
  v_user_id uuid;
  v_owner_email text := 'hello@salonsynk.com';  -- Change to owner's email
  v_display_name text;
begin
  select id into v_salon_id from public.salons where slug = 'fabhair' limit 1;
  if v_salon_id is null then
    raise exception 'Fab Hair salon not found. Run seed-fabhair-add.sql first.';
  end if;

  select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  into v_user_id, v_display_name
  from auth.users where email = v_owner_email limit 1;
  if v_user_id is null then
    raise exception 'No user found with email %. They must sign up first.', v_owner_email;
  end if;

  insert into public.salon_members (salon_id, user_id, role, display_name, is_active)
  values (v_salon_id, v_user_id, 'owner', v_display_name, true)
  on conflict (salon_id, user_id) do update set role = 'owner', display_name = excluded.display_name, is_active = true;

  raise notice 'Owner % added to Fab Hair. They can now log in and access the salon.', v_owner_email;
end $$;
