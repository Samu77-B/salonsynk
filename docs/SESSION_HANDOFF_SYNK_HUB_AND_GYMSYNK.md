# Session handoff — SmartSynk hub, brands, commerce & GymSynk (Sep 2026)

Pick up here when you return. Summarizes the architecture conversation and agreed direction.

---

## Agreed login model

| Situation | Where they sign in | Notes |
|-----------|-------------------|--------|
| One hair salon (booking only or booking + shop) | **SalonSynk** | Day-to-day: diary, clients, products if Complete tier |
| **Several hair salons** (same owner, salon-only) | **SalonSynk** | Multi-location **within one vertical** — location switcher in SalonSynk, not SmartSynk |
| One barber / one nail bar | **BarberSynk** / **NailSynk** | Today barber/nail `/login` redirects to SmartSynk; align routing so single-brand owners land on their product dashboard |
| Owner mixes **brands** (salon + barber + nail, etc.) | **SmartSynk** | Group overview (health, revenue, activity), then **Open** into each product via `owner-location-handoff` magic link |

**SmartSynk = cross-platform hub**, not “anyone with two salons.”

**PaySynk stays separate** for external / merch-only sites (no diary):

- [Saturday Love Funk merch](https://saturdaylovefunk.com/merch.html)
- paperboyja.com (planned)

Use **SalonSynk shop** (or future shared Synk commerce) when retail is tied to the same business as services. Use **PaySynk** when it’s embeddable ecom on a marketing site only.

**Rule of thumb:** If a purchase is **used up by a booking** (coaching packages, 10-blow-dry packs), it lives with bookings/commerce in Synk — not PaySynk-only.

---

## What SmartSynk does today (code)

- Host: `smartsynk.net` → marketing + `/smart/overview` dashboard
- **`core/auth/smart-access.ts`**: hub access requires **2+ owned locations** OR super admin (`qualifiesForOwnerHub`)
- **`SmartDashboardShell`**: redirects to login if no hub access
- Overview stats: **`core/smart/dashboard-stats.ts`** (fans out salon + barber + nail tables)
- Owners: **`OwnerLocationList`** + **`/api/auth/owner-location-handoff`** → product domain + switch route
- Single-location owners: **`/api/auth/smart-redirect`** sends them to product via magic link (they often never see the hub)

Key files: `middleware.ts`, `lib/platform-host.ts`, `core/auth/resolve-user-platform.ts`, `core/config/smart-site.ts`

---

## Commerce state (SalonSynk)

- **Booking**: mature — `/book/{slug}`, embed, AI concierge (`docs/INTEGRATION.md`)
- **Shop**: `/shop/{slug}`, `products` + variants in Supabase; **`products_shop`** = Complete tier only
- **Gap**: `ProductBuyButton` gets `clientSecret` from `/api/stripe/create-shop-payment-intent` but does **not** complete Stripe checkout; no cart/orders/embed shop yet
- **Barber/Nail**: no product tables or public shop yet

**Direction discussed:** Build **shared commerce** (location-scoped products, one checkout) rather than copy-paste `barber_products` / `nail_products`. Finish salon checkout on shared shape when ready.

---

## GymSynk & Reset Studios

- **Reset Studios** ([resetstudios.vercel.app](https://resetstudios.vercel.app/)): boutique studio — classes, workshops, 1:1 coaching, **packages** — not a classic 24/7 gym with DD memberships
- First GymSynk client can ship **classes + packages + 1:1 booking** before full membership/access control
- Reset **packages** → Synk commerce + booking (session balance), **not** PaySynk-only

**Immediate ask (not yet implemented):** Add **GymSynk to SmartSynk marketing website** (brand on hub landing — like PaySynk tab), not full product yet.

### GymSynk on SmartSynk website — checklist

1. Add **`core/config/gym-site.ts`** (name, url, email, tagline)
2. Extend **`core/config/smart-site.ts`**: `SmartMarketingPlatformId` + `gym`, FAQ, ABOUT, `SMART_HERO_SLIDES`, `SMART_SHOWCASE_TABS`, `SMART_PLATFORMS`, `platformIcons.gym`
3. **`components/smart/marketing/platform-icons.tsx`** — `gymsynk-platform-icon.png`
4. Assets: `public/imgs/smart/` — panel + hero + icon
5. **`components/marketing/synk-platform-footer.tsx`** — `SYNK_PLATFORM_LINKS`
6. Platform count **4 → 5** in `fetchLandingStats` / `app/smart/page.tsx` fallbacks
7. Optional: **`system-status.tsx`** — GymSynk “Coming soon”
8. CTA: choose coming soon vs gymsynk.com vs Reset case study

**Defer:** middleware, `gym_*` DB, `/gym` app routes until product build.

---

## Broader platform direction (later)

- **Stop triplicating** tenant tables per brand; shared **`locations`** + union views for hub stats
- **Platform registry** in config (hosts, paths, colours) before adding GymSynk as real product
- **Shared commerce + recurring plans** (packages/subscriptions) — gym work unlocks salon/barber package upsells
- **Single app domain** (`app.smartsynk.net`) optional long-term — removes magic-link hops between brands

---

## Suggested priority when you return

1. **GymSynk on SmartSynk marketing** (config + copy + assets) — quick win
2. **Login routing** — single-brand → product; cross-brand → SmartSynk (review `smart-redirect`, auth callback, salon login redirect)
3. **Salon shop checkout** — wire Stripe Payment Element + cart/orders + optional `/shop/{slug}/embed`
4. **GymSynk product** for Reset (timetable, class booking, packages)

---

## Related docs in repo

- [`phases.md`](../phases.md) — product feature phases (diary, reports, AI, etc.)
- [`docs/INTEGRATION.md`](INTEGRATION.md) — embed booking on client sites
- [`docs/SESSION_HANDOFF_PLAN_TIERS.md`](SESSION_HANDOFF_PLAN_TIERS.md) — plan tiers & Stripe

---

*Saved from Cursor chat — Sep 2026. Switch to Agent mode and reference this file to continue GymSynk marketing or hub work.*
