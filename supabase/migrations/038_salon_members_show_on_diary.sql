-- Hide non-provider team members from diary columns / bookable stylist lists (e.g. front desk login-only).

alter table public.salon_members
  add column if not exists show_on_diary boolean not null default true;

comment on column public.salon_members.show_on_diary is
  'When false, this member does not appear on the diary or as a selectable stylist online (reception/front desk login only).';

-- Existing common label for reception-only profiles
update public.salon_members
set show_on_diary = false
where lower(trim(coalesce(display_name, ''))) in ('front desk', 'frontdesk', 'front-desk');
