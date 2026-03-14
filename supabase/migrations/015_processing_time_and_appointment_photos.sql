-- Processing time: for services like hair color, time when client is processing (stylist can book another client).
alter table public.services
  add column if not exists processing_time_minutes int not null default 0;

comment on column public.services.processing_time_minutes is 'Minutes during the service when the client is processing (e.g. color developing). Another client can be booked in this gap.';

-- Before/after photos for appointments (Color Book / technical notes).
alter table public.appointments
  add column if not exists before_photo_url text,
  add column if not exists after_photo_url text;

comment on column public.appointments.before_photo_url is 'Before photo URL for this appointment (e.g. color/formula documentation).';
comment on column public.appointments.after_photo_url is 'After photo URL for this appointment.';
