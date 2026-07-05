-- Allow admin-granted free trials (subscription_status = 'trialing') on all tenant tables.

alter table public.salons drop constraint if exists salons_subscription_status_check;
alter table public.salons add constraint salons_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'past_due', 'canceled', 'trialing'));

alter table public.barber_shops drop constraint if exists barber_shops_subscription_status_check;
alter table public.barber_shops add constraint barber_shops_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'past_due', 'canceled', 'trialing'));

alter table public.nail_salons drop constraint if exists nail_salons_subscription_status_check;
alter table public.nail_salons add constraint nail_salons_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'past_due', 'canceled', 'trialing'));
