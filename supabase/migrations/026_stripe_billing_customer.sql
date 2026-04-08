-- Stripe Customer ID for SalonSynk platform subscription (monthly fee), not Stripe Connect.
alter table public.salons
  add column if not exists stripe_billing_customer_id text;

comment on column public.salons.stripe_billing_customer_id is
  'Stripe Customer id for platform subscription billing (distinct from Connect payouts).';
