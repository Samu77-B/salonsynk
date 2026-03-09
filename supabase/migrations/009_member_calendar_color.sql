-- Calendar colour per team member for diary view (hex e.g. #3b82f6).
alter table public.salon_members
  add column if not exists calendar_color text;
