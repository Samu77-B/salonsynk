-- Track when a walk-in was notified by SMS (avoid duplicate "you're next" texts).
alter table public.barber_queue
  add column if not exists next_sms_sent_at timestamptz;

comment on column public.barber_queue.next_sms_sent_at is
  'When an automated you-are-next SMS was sent to guest_phone.';
