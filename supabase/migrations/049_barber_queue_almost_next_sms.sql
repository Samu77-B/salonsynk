-- Track when a walk-in was notified they are second in line (~20 min warning).
alter table public.barber_queue
  add column if not exists almost_next_sms_sent_at timestamptz;

comment on column public.barber_queue.almost_next_sms_sent_at is
  'When an automated second-in-line SMS was sent to guest_phone.';
