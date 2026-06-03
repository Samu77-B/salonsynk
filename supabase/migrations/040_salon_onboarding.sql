-- Onboarding: payment invite token, welcome/setup email tracking, subscription gate for new salons.
alter table public.salons
  add column if not exists payment_invite_token text unique;

alter table public.salons
  add column if not exists subscription_required boolean not null default false;

alter table public.salons
  add column if not exists onboarding_welcome_sent_at timestamptz;

alter table public.salons
  add column if not exists onboarding_setup_email_sent_at timestamptz;

comment on column public.salons.payment_invite_token is
  'Secret token for pay-before-access Stripe Checkout link in welcome email.';
comment on column public.salons.subscription_required is
  'When true, salon owners must have active subscription before using the dashboard.';
comment on column public.salons.onboarding_welcome_sent_at is
  'When the welcome + payment invite email was sent to the owner.';
comment on column public.salons.onboarding_setup_email_sent_at is
  'When the post-payment setup guide email was sent.';
