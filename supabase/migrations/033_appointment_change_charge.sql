-- Record a charge when an appointment is changed (time, service, etc.)
alter table public.appointments
  add column if not exists change_charge_minor int default 0;
