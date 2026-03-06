-- Track when we sent a review request so we don't send twice.
alter table public.appointments
  add column if not exists review_request_sent_at timestamptz;
