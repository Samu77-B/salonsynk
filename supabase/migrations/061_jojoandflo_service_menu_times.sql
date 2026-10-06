-- JoJo & Flo service menu timings from the salon list.
-- Duration = application + process. Processing = process only.

do $$
declare
  sid uuid;
  cat_cut uuid;
  cat_treat uuid;
  cat_colour uuid;
  full_head_count int;
begin
  select id into sid from public.salons where slug = 'jojoandflo';
  if sid is null then
    raise notice 'Salon slug jojoandflo not found — skipped.';
    return;
  end if;

  select category_id into cat_cut
  from public.services
  where salon_id = sid and lower(trim(name)) = 'cut & blow dry'
  limit 1;

  select category_id into cat_treat
  from public.services
  where salon_id = sid and lower(trim(name)) like '%olaplex%'
  limit 1;

  select category_id into cat_colour
  from public.services
  where salon_id = sid and lower(trim(name)) = 'toner'
  limit 1;

  -- Existing services: set application + process times
  update public.services
  set duration_minutes = 20, processing_time_minutes = 10, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'toner';

  update public.services
  set duration_minutes = 180, processing_time_minutes = 90, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'half head';

  update public.services
  set duration_minutes = 95, processing_time_minutes = 50, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'root tint';

  update public.services
  set duration_minutes = 75, processing_time_minutes = 0, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'cut & blow dry';

  update public.services
  set duration_minutes = 60, processing_time_minutes = 0, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'blow dry';

  update public.services
  set duration_minutes = 85, processing_time_minutes = 40, updated_at = now()
  where salon_id = sid and lower(trim(name)) = 'brazilian blow dry';

  -- Two "Full Head" rows: longer highlights first, shorter colour second
  with ranked as (
    select id, row_number() over (order by sort_order nulls last, created_at, id) as rn
    from public.services
    where salon_id = sid and lower(trim(name)) = 'full head'
  )
  update public.services s
  set
    duration_minutes = case when r.rn = 1 then 240 else 110 end,
    processing_time_minutes = case when r.rn = 1 then 120 else 50 end,
    updated_at = now()
  from ranked r
  where s.id = r.id and r.rn <= 2;

  select count(*) into full_head_count
  from public.services
  where salon_id = sid and lower(trim(name)) = 'full head';

  if full_head_count = 1 then
    insert into public.services (
      salon_id, name, duration_minutes, processing_time_minutes, price_minor, category_id
    )
    values (sid, 'Full Head', 110, 50, 0, cat_colour);
  end if;

  -- Missing services
  if not exists (
    select 1 from public.services where salon_id = sid and lower(trim(name)) = 'cut & finish'
  ) then
    insert into public.services (
      salon_id, name, duration_minutes, processing_time_minutes, price_minor, category_id
    )
    values (sid, 'Cut & Finish', 60, 0, 0, cat_cut);
  else
    update public.services
    set duration_minutes = 60, processing_time_minutes = 0, updated_at = now()
    where salon_id = sid and lower(trim(name)) = 'cut & finish';
  end if;

  if not exists (
    select 1 from public.services where salon_id = sid and lower(trim(name)) = 'lux treat'
  ) then
    insert into public.services (
      salon_id, name, duration_minutes, processing_time_minutes, price_minor, category_id
    )
    values (sid, 'Lux treat', 50, 30, 0, cat_treat);
  else
    update public.services
    set duration_minutes = 50, processing_time_minutes = 30, updated_at = now()
    where salon_id = sid and lower(trim(name)) = 'lux treat';
  end if;

  if not exists (
    select 1 from public.services where salon_id = sid and lower(trim(name)) = 'treat'
  ) then
    insert into public.services (
      salon_id, name, duration_minutes, processing_time_minutes, price_minor, category_id
    )
    values (sid, 'Treat', 30, 20, 0, cat_treat);
  else
    update public.services
    set duration_minutes = 30, processing_time_minutes = 20, updated_at = now()
    where salon_id = sid and lower(trim(name)) = 'treat';
  end if;

  if not exists (
    select 1 from public.services where salon_id = sid and lower(trim(name)) = 'olaplex'
  ) then
    insert into public.services (
      salon_id, name, duration_minutes, processing_time_minutes, price_minor, category_id
    )
    values (sid, 'Olaplex', 30, 20, 0, cat_treat);
  else
    update public.services
    set duration_minutes = 30, processing_time_minutes = 20, updated_at = now()
    where salon_id = sid and lower(trim(name)) = 'olaplex';
  end if;
end $$;
