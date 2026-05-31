# Session handoff — Three-tier plans (May 2026)

Pick up here when you return. This summarizes the conversation and current implementation state.

---

## Goal

Three **platform membership tiers** for salons/barbers, each with:

- Its own **Stripe subscription price**
- A **bundle of product modules** (diary, checkout, campaigns, etc.) ranked by operational importance
- **Master admin control** (you) to assign tier and optional per-feature overrides per salon

**Not** about gating individual haircut “services” in the menu — that stays on all tiers that include the Service menu module.

---

## Tier names & pricing (config defaults)

| Internal ID      | Display name     | Suggested price | Features |
|------------------|------------------|-----------------|----------|
| `essentials`     | **Essentials**   | £29/mo          | 8 — run the floor (diary, team, clients, service menu, online booking, branding, staff logins, help) |
| `professional`   | **Professional** | £49/mo          | 16 — adds checkout, Stripe Connect, reports, reminders, reviews, deposits/no-show, appointment photos, processing time |
| `complete`       | **Complete**     | £69/mo          | 22 — adds campaigns, We Miss You, aftercare, targets/loyalty, **products/shop**, chair renter splits |

Source of truth: [`config/plans.ts`](../config/plans.ts)

**Existing salons** backfill to **Professional** (DB default). **New salons** also default to Professional until you change them in admin.

**Products & shop** is **Complete tier only** (not Professional or Essentials).

---

## What you asked for (latest session)

- When a plan tier is chosen for a salon (e.g. JoJo & Flo on **Essentials**), features like **Products & shop** should turn off — no “Shop products” link on the booking page.
- This should work for **all existing salons**, when **switching salons** in the admin header dropdown, and for **new salons**.
- Stripe is in **TEST** mode for subscription testing.

---

## Done in codebase

| Item | Location |
|------|----------|
| DB migration | [`supabase/migrations/039_salon_plan_tier.sql`](../supabase/migrations/039_salon_plan_tier.sql) — `plan_tier`, `feature_overrides` |
| Plan config & helpers | [`config/plans.ts`](../config/plans.ts) — `salonHasFeature()`, tier bundles |
| Salon feature helpers | [`lib/salon-features.ts`](../lib/salon-features.ts) — `fetchSalonPlanState`, `requireSalonFeature`, nav mapping |
| Admin: tier dropdown, feature checklist, overrides | [`app/(app)/admin/salons/[id]/admin-salon-plan-section.tsx`](../app/(app)/admin/salons/[id]/admin-salon-plan-section.tsx) |
| Admin: save plan action | `adminUpdateSalonPlan` in [`app/(app)/admin/salons/actions.ts`](../app/(app)/admin/salons/actions.ts) |
| Admin: Plan + Billing columns on salon list | [`app/(app)/admin/salons/page.tsx`](../app/(app)/admin/salons/page.tsx) |
| **Public booking page** — “Shop products” link gated | [`app/book/[slug]/page.tsx`](../app/book/[slug]/page.tsx) |
| **Public shop page** — 404 when no `products_shop` | [`components/salon-shop/salon-public-shop.tsx`](../components/salon-shop/salon-public-shop.tsx) |
| **Dashboard nav** — links filtered by salon’s enabled features | [`app/(app)/app-header.tsx`](../app/(app)/app-header.tsx) + [`app/(app)/layout.tsx`](../app/(app)/layout.tsx) |
| **Dashboard pages** — redirect to Diary if feature missing | checkout, reports, targets, campaigns, products, team, services pages |
| **Settings** — shop link + tier-gated sections (Stripe Connect, deposits, reminders, marketing) | [`app/(app)/(dashboard)/settings/settings-view.tsx`](../app/(app)/(dashboard)/settings/settings-view.tsx) |

**Embed booking** (`/book/[slug]/embed`) never showed a shop link — unchanged.

**You must run migration 039** in Supabase before the admin plan UI can save.

---

## How salon switching works (super admin)

1. Header **Salon:** dropdown sets `admin_salon_id` cookie → [`app/(app)/admin/actions.ts`](../app/(app)/admin/actions.ts) `switchAdminSalon`
2. [`getCurrentUserSalon()`](../lib/supabase/salon.ts) resolves the selected salon
3. [`getEnabledFeaturesForSalon()`](../lib/salon-features.ts) loads that salon’s `plan_tier` + `feature_overrides`
4. Nav and pages reflect **that salon’s** tier — switch JoJo & Flo (Essentials) vs another salon (Complete) to compare

Regular salon owners see their own salon’s tier (no dropdown).

---

## Stripe billing (implemented in code)

- Checkout + webhook use tier price IDs; sync `plan_tier` from subscription
- Setup guide: [`docs/STRIPE_SUBSCRIPTION_SETUP.md`](STRIPE_SUBSCRIPTION_SETUP.md)
- Env: `STRIPE_PRICE_ESSENTIALS`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_COMPLETE` (+ legacy `STRIPE_FLAT_FEE_PRICE_ID`)

**TEST vs LIVE Stripe** does not change feature gating — only `plan_tier` in Supabase (admin-assigned or webhook-synced after payment) matters.

---

## Test checklist (when you return)

1. Confirm migration `039_salon_plan_tier.sql` has been run in Supabase
2. **Admin → Salons → JoJo & Flo → Platform plan** → set **Essentials** → **Save plan**
3. Switch to JoJo & Flo in header dropdown:
   - Nav should hide: Products, Campaigns, Targets, Checkout, Reports
   - Nav should show: Diary, Team, Clients, Services, Settings, Help
4. Open `/book/{their-slug}` — no “Shop products” link
5. Open `/shop/{their-slug}` — should 404
6. Switch to a **Complete** tier salon — Products + shop link should return
7. (Optional) TEST subscription from Settings → confirm `plan_tier` updates in Supabase after webhook

---

## Not done yet

1. **Server actions & crons** — API routes and background jobs (campaign sends, etc.) not hard-blocked by tier yet; UI + public pages are gated
2. **Marketing site** — three-column pricing on homepage (may be partially done; verify [`components/marketing/pricing-plans-section.tsx`](../components/marketing/pricing-plans-section.tsx))
3. **Create 3 Stripe TEST prices** in Dashboard and set env vars (if not already)
4. **Super admin bypass** — super admin currently sees the same gated nav as the impersonated salon (good for testing; optional bypass not implemented)
5. **Auto Stripe tier change** when admin saves a different tier in dropdown — v1 is manual; owner re-subscribes or you adjust in Stripe

---

## Your manual steps before go-live

1. Run `039_salon_plan_tier.sql` in Supabase SQL Editor
2. Create 3 monthly GBP prices in Stripe (TEST first, then LIVE); add env vars
3. Confirm final amounts (£29 / £49 / £69 or your choice) — update `config/plans.ts` `amountGbp` to match Stripe
4. Set each existing salon’s tier in **Admin → Salons → Edit → Platform plan**

---

## Admin UX (how to use it)

1. Go to **Admin → Salons → Edit** a salon
2. Scroll to **Platform plan**
3. Choose tier; review checklist
4. Optional: **Show per-feature overrides** → Force on/off for pilots/comps
5. **Save plan**

Salon list shows **Plan** (tier + price) and **Billing** (subscription status).

---

## Design notes

- **`plan_tier`**: bundle you assign (also synced from Stripe on subscription payment)
- **`feature_overrides`**: `{ "products_shop": true }` = force on; `{ "reports": false }` = force off; omit = use tier
- **v1**: Admin changes tier manually; owner re-subscribes or you adjust in Stripe — no auto Stripe tier change on dropdown save

---

## Related docs

- [`docs/STRIPE_SUBSCRIPTION_SETUP.md`](STRIPE_SUBSCRIPTION_SETUP.md) — Stripe TEST setup, env vars, webhook
- [`docs/FEATURES_ROADMAP.md`](FEATURES_ROADMAP.md) — product capabilities vs roadmap
- [`List of services.md`](../List%20of%20services.md) — marketing copy (platform, not haircut services)

---

*Last updated — plan tier feature enforcement (nav, public pages, settings); JoJo & Flo Essentials testing pending.*
