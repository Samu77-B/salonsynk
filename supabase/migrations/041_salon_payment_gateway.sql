-- Which card/POS provider the salon uses for in-salon payments (not platform subscription billing).
alter table public.salons
  add column if not exists payment_gateway text not null default 'stripe'
    check (payment_gateway in ('stripe', 'worldpay', 'dojo', 'other_pos'));

comment on column public.salons.payment_gateway is
  'In-salon payment provider: stripe = SalonSynk Stripe checkout; worldpay/dojo/other_pos = record sales from existing terminal.';

alter table public.sales_transactions
  add column if not exists payment_gateway text;

comment on column public.sales_transactions.payment_gateway is
  'Gateway used for this sale (stripe, worldpay, dojo, other_pos). stripe_payment_intent_id holds Stripe PI id or synthetic ext ref.';
