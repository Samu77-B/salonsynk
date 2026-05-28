-- Platform membership tier per salon (Essentials / Professional / Complete).
alter table public.salons
  add column if not exists plan_tier text not null default 'professional'
    check (plan_tier in ('essentials', 'professional', 'complete'));

alter table public.salons
  add column if not exists feature_overrides jsonb not null default '{}';

comment on column public.salons.plan_tier is 'Platform plan bundle assigned by master admin or synced from Stripe subscription price.';
comment on column public.salons.feature_overrides is 'Per-feature overrides: true = force on, false = force off, omit = use plan_tier bundle.';

update public.salons set plan_tier = 'professional' where plan_tier is null;
