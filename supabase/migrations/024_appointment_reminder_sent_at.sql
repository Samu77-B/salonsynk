-- Track when the pre-appointment reminder was sent so cron runs do not duplicate.

alter table public.appointments
  add column if not exists reminder_sent_at timestamptz null;

comment on column public.appointments.reminder_sent_at is 'Set when the reminder (SMS/WhatsApp/email) was sent; null means not yet sent.';
