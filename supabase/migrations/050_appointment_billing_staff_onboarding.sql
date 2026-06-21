-- Appointment billing overrides and per-line stylist assignment
alter table public.appointments
  add column if not exists bill_total_minor integer,
  add column if not exists deposit_amount_minor integer,
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.appointments.bill_total_minor is 'Manual override for the final bill total in minor units (pence).';
comment on column public.appointments.deposit_amount_minor is 'Deposit collected for this appointment in minor units.';
comment on column public.appointments.confirmation_sent_at is 'When the booking confirmation message was sent.';

alter table public.appointment_services
  add column if not exists price_override_minor integer,
  add column if not exists assigned_stylist_id uuid references public.salon_members(id) on delete set null;

comment on column public.appointment_services.price_override_minor is 'Optional line-item price override in minor units.';
comment on column public.appointment_services.assigned_stylist_id is 'Stylist credited for this service line (e.g. colorist).';

alter table public.salon_members
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.salon_members.onboarding_completed_at is 'When the staff member completed the in-app onboarding wizard.';
