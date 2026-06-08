-- Allow barber shop members without a login (display on queue until linked later).
alter table public.barber_members
  alter column user_id drop not null;

comment on column public.barber_members.user_id is
  'Optional auth user link. Null for queue-only barber profiles until they sign up.';
