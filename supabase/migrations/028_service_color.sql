-- Diary colour per service (hex e.g. #3b82f6) so appointment blocks are
-- coloured by service type rather than by staff member.
alter table public.services
  add column if not exists color text;
