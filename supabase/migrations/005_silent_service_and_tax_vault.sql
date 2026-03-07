-- Silent Service: when true, appointment is treated as silent (e.g. not shown on public confirmations).
alter table public.appointments
  add column if not exists silent_service boolean not null default false;

-- Tax Vault: running total of tax collected (in minor units, e.g. pence) for reporting.
alter table public.salons
  add column if not exists tax_vault_minor bigint not null default 0;
