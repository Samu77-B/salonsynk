-- Configurable reminder intervals and skin test tracking.

-- Add last_skin_test_at to clients for 12-month skin/patch test reminders.
alter table public.clients
  add column if not exists last_skin_test_at timestamptz;
