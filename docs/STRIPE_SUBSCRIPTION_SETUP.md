# Stripe setup — platform monthly subscriptions (3 tiers)

SalonSynk bills salons on the **platform Stripe account** (`STRIPE_SECRET_KEY`). This is separate from **Stripe Connect** (salon in-salon payments).

## 1. Create one product and three prices

In [Stripe Dashboard](https://dashboard.stripe.com) → **Product catalog** → **Add product**:

- **Name:** SalonSynk Platform (or similar)
- **Description:** Monthly SalonSynk subscription

Add **three recurring prices** (GBP, monthly):

| Plan           | Suggested amount | Env variable                    |
|----------------|------------------|---------------------------------|
| Essentials     | £29              | `STRIPE_PRICE_ESSENTIALS`       |
| Professional   | £49              | `STRIPE_PRICE_PROFESSIONAL`     |
| Complete       | £69              | `STRIPE_PRICE_COMPLETE`         |

Copy each **Price ID** (`price_...`).

**Legacy:** If you already have a £50/mo price, set `STRIPE_FLAT_FEE_PRICE_ID` to that Price ID — it maps to **Professional**.

Optional: `STRIPE_FLAT_FEE_PRODUCT_ID` = Product ID (`prod_...`) for your records only (not required for Checkout).

## 2. Environment variables

Add to `.env.local` and **Vercel → Settings → Environment Variables** (Production):

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_ESSENTIALS=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_COMPLETE=price_...

# Optional legacy (same as Professional if you only had one price before)
STRIPE_FLAT_FEE_PRICE_ID=price_...
```

Redeploy after changing env vars.

## 3. Webhook endpoint

**Developers → Webhooks → Add endpoint**

- **URL:** `https://salonsynk.com/api/webhooks/stripe` (or your Vercel URL)
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded` (in-salon / shop — existing)
  - `invoice.paid` (tax vault — existing)

Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

## 4. Customer billing portal (optional but recommended)

**Settings → Billing → Customer portal** — enable so owners can update card or cancel.

Owners use **Settings → Manage billing** in the app (`/api/stripe/billing-portal`).

## 5. Assign tier per salon (master admin)

1. **Admin → Salons → Edit** → **Platform plan** → choose Essentials / Professional / Complete → **Save plan**
2. Salon **owner** goes to **Settings → Subscription** → **Pay subscription (card)**
3. Checkout uses the Stripe Price for that salon’s `plan_tier`
4. Webhook sets `subscription_status` and syncs `plan_tier` from the paid price

## 6. Test in Stripe test mode

1. Use test keys (`sk_test_...`, `pk_test_...`)
2. Create test prices (same three amounts)
3. Use test card `4242 4242 4242 4242`
4. Confirm in Supabase: `salons.subscription_status` = `active`, `plan_tier` matches

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Subscription checkout is not configured for the X plan” | Set `STRIPE_PRICE_*` for that tier in Vercel and redeploy |
| Paid but status still inactive | Check webhook deliveries in Stripe; verify `STRIPE_WEBHOOK_SECRET` and `salon_id` in subscription metadata |
| Wrong tier after payment | Ensure admin saved `plan_tier` before checkout; webhook resolves tier from Price ID |
| Owner can’t see Subscribe | Must be **owner** role; status must be `inactive` or `canceled` |

See also [`SESSION_HANDOFF_PLAN_TIERS.md`](SESSION_HANDOFF_PLAN_TIERS.md).
