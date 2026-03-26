-- Optional longer notes for each service (staff / booking context).
alter table public.services
  add column if not exists description text;

comment on column public.services.description is 'Optional details shown in the dashboard and usable for client-facing copy later.';
