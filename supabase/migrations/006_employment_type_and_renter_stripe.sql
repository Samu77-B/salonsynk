-- Stylist employment type: EMPLOYEE (salon receives 100%) vs RENTER (split: stylist + admin fee to salon).
alter table public.salon_members
  add column if not exists employment_type text not null default 'EMPLOYEE'
    check (employment_type in ('EMPLOYEE', 'RENTER'));
alter table public.salon_members
  add column if not exists stripe_connect_account_id text;
alter table public.salon_members
  add column if not exists tax_vault_minor bigint not null default 0;

comment on column public.salon_members.employment_type is 'EMPLOYEE: payment goes 100% to salon. RENTER: split to stylist + admin fee to salon.';
comment on column public.salon_members.stripe_connect_account_id is 'For RENTER only: Stripe Connect account ID to receive their share of payments.';
comment on column public.salon_members.tax_vault_minor is 'For RENTER only: personal tax savings running total (minor units).';
