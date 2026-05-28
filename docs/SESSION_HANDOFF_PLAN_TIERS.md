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
| `complete`       | **Complete**     | £69/mo          | 22 — adds campaigns, We Miss You, aftercare, targets/loyalty, products/shop, chair renter splits |

Source of truth: [`config/plans.ts`](../config/plans.ts)

Existing salons backfill to **Professional** (closest to today’s £50 flat fee).

---

## What you asked for

1. Three Stripe payment prices (Essentials / Professional / Complete)
2. Master admin dashboard control over tier + features
3. Price breaks tied to **how many platform modules** each tier includes, split by importance for running a salon/barber

---

## Done in codebase

| Item | Location |
|------|----------|
| DB migration | [`supabase/migrations/039_salon_plan_tier.sql`](../supabase/migrations/039_salon_plan_tier.sql) — `plan_tier`, `feature_overrides` |
| Plan config & helpers | [`config/plans.ts`](../config/plans.ts) |
| Admin: tier dropdown, feature checklist, overrides | [`app/(app)/admin/salons/[id]/admin-salon-plan-section.tsx`](../app/(app)/admin/salons/[id]/admin-salon-plan-section.tsx) |
| Admin: save plan action | `adminUpdateSalonPlan` in [`app/(app)/admin/salons/actions.ts`](../app/(app)/admin/salons/actions.ts) |
| Admin: Plan + Billing columns on salon list | [`app/(app)/admin/salons/page.tsx`](../app/(app)/admin/salons/page.tsx) |

**You must run migration 039** in Supabase before the admin plan UI can save.

---

## Not done yet (from full plan)

1. **Stripe billing** — checkout + webhook use tier price IDs; sync `plan_tier` from subscription  
   - Env: `STRIPE_PRICE_ESSENTIALS`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_COMPLETE`  
   - Keep `STRIPE_FLAT_FEE_PRICE_ID` → maps to Professional for legacy  
   - Files: `app/api/stripe/create-subscription-checkout/route.ts`, `app/api/webhooks/stripe/route.ts`

2. **Feature enforcement** — hide nav/routes, block server actions, skip crons, gate `/book` and `/shop` by `salonHasFeature()`  
   - Needs `lib/salon-features.ts` + layout/header wiring

3. **Settings billing UX** — show assigned tier/price; subscribe uses salon’s `plan_tier`

4. **Marketing site** — three-column pricing on homepage / features (replace single £50)

5. **Create 3 Stripe prices** in Dashboard and set env vars

---

## Your manual steps before go-live

1. Run `039_salon_plan_tier.sql` in Supabase SQL Editor  
2. Create 3 monthly GBP prices in Stripe; add env vars  
3. Confirm final amounts (£29 / £49 / £69 or your choice) — update `config/plans.ts` `amountGbp` to match Stripe  

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

- **`plan_tier`**: bundle you assign (also synced from Stripe later)  
- **`feature_overrides`**: `{ "campaigns": true }` = force on; `{ "reports": false }` = force off; omit = use tier  
- **v1**: Admin changes tier manually; owner re-subscribes or you adjust in Stripe — no auto Stripe tier change on dropdown save  
- **Super admin** impersonating salons: recommend gating same as salon (or bypass only for `isSuperAdmin` when testing) — not implemented yet  

---

## Full plan file (Cursor)

Detailed plan with mermaid diagram: `.cursor/plans/three-tier_plans_45a93fcc.plan.md` (or search workspace for `three-tier_plans`).

---

## Related docs

- [`docs/FEATURES_ROADMAP.md`](FEATURES_ROADMAP.md) — product capabilities vs roadmap  
- [`List of services.md`](../List%20of%20services.md) — marketing copy (platform, not haircut services)  
- [`config/subscription.ts`](../config/subscription.ts) — still single £50 flat fee until Stripe step is done  

---

*Last updated from agent session — platform tiers / master admin UI.*
