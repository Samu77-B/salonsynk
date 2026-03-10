-- Per-appointment options for SMS/WhatsApp: reminder before, review request after, aftercare after.
alter table public.appointments
  add column if not exists send_reminder_sms boolean not null default true,
  add column if not exists send_review_request boolean not null default true,
  add column if not exists send_aftercare boolean not null default false,
  add column if not exists aftercare_sent_at timestamptz;

comment on column public.appointments.send_reminder_sms is 'When true, send SMS/WhatsApp reminder before the appointment (if client has phone).';
comment on column public.appointments.send_review_request is 'When true, send experience/review request after the appointment.';
comment on column public.appointments.send_aftercare is 'When true, send aftercare instructions after the appointment.';
