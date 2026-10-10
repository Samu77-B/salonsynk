-- services.description is selected by SynkAI. If 020 was skipped, the public
-- catalogue query errors and the assistant is given an empty menu.
alter table public.services
  add column if not exists description text;

comment on column public.services.description is 'Optional details shown in the dashboard and usable for client-facing copy later.';

-- Hours published on https://jojoandflo.vercel.app/ (footer).
update public.salons
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{opening_hours}',
  to_jsonb('Monday: closed. Tuesday to Friday: 10:00–18:00. Saturday: 09:00–18:00. Sunday: closed.'::text),
  true
)
where slug = 'jojoandflo'
  and coalesce(settings->>'opening_hours', '') = ''
  and coalesce(settings->>'opening_hours_note', '') = '';
