# Session handoff — SynkAI / PAR-8 (Sep 2026)

Pick up here when you return. Linear: **[PAR-8 Synk AI](https://linear.app/paradigm-studio/issue/PAR-8/synk-ai)** (High, SmartSynk project — work is in **SalonSynk** public + staff AI, not the SmartSynk hub UI).

---

## Problem we were solving

Public (and staff) **SynkAI** understood casual booking language (“mens haircut”, “blow dry”) but often **failed to book** because:

1. The model **invented service names** (e.g. “Gentleman’s Haircut”, “Gents Cut”) instead of using **exact names** from the salon menu.
2. **Fuzzy matching** in code didn’t handle “gents cut” vs “Gents Haircut”, or confirm messages like “yes make it a gents cut for 11am tomorrow”.
3. **`resolveService`** sometimes blocked booking when alternatives existed, even after the client picked a name.
4. The model confused **“service not found”** with **“no slots that day”**.

`phases.md` is **not** connected to SynkAI (dev roadmap only).

---

## Where SynkAI gets data

| Source | Role |
|--------|------|
| Supabase **`services`** (name, description, category) | Catalogue + tool matching |
| **`load-public-salon-catalog.ts`** / **`salon-booking-catalog.ts`** | Loads menu for public / staff |
| **`lib/ai/synkai-hair-jargon.ts`** | Global UK jargon → injected into system prompt |
| **`lib/ai/synkai-service-prompts.ts`** | Shared prompt block for all three surfaces |
| **`lib/ai/booking-resolvers.ts`** | `matchServiceForBooking`, `resolveService` |
| **`app/api/public/salon/[slug]/booking-concierge`** | Public booking chat |
| **`app/api/public/salon/[slug]/qa`** | Public Q&A (no live availability) |
| **`app/api/ai/booking-assistant`** | Staff SynkAI Mode |

Optional salon teaching (no Settings UI yet):

- **`services.description`** (“More info” in Settings → Services) — used in prompt + fuzzy match.
- **`salons.settings.synkai_hints`** (string in JSON) — injected into prompts when set.

---

## Code changes (this arc)

### Deployed earlier on `main`

- `lib/ai/synkai-hair-jargon.ts` (new)
- Improved matching, confirmation flow, full service list in public prompt
- `settings.synkai_hints` support
- Service form placeholders mention SynkAI
- Build fix: duplicate `trim` key in `TERM_EXPANSIONS`

### Follow-up (gents cut / confirm phrasing) — deploy with this handoff

- **`normalizeServiceIntent()`** — strips “yes make it a…”, dates/times from service text
- **`queryImpliesGentsCut` / `findGentsCutService`** — maps mens/gents wording to the real gents/mens service row
- Jargon: **no example menu names**; must use catalogue or `match_service.serviceName`
- Public **`check_availability`** errors include `matchedServiceName` + `failureReason` (`service_not_found` vs `no_availability`)

Key files to read first:

- `lib/ai/booking-resolvers.ts`
- `lib/ai/synkai-hair-jargon.ts`
- `lib/ai/public-booking-tools.ts`

---

## How to test after deploy

1. Open the salon **public booking** page → **SynkAI** tab.
2. Try: `book mens haircut tomorrow 11am` → should offer/check the **exact** service name from Settings → Services.
3. Confirm with: `yes make it a gents cut for 11am tomorrow` (if menu says “Gents Haircut”, tools should still resolve).
4. If it says “no openings”, that’s availability — not a missing service. Try another day or check diary hours.

**Per-salon:** In Settings → Services, put client phrases in **More info** (e.g. “also called mens cut, gents haircut”).

---

## Commits (reference)

- `37c8a92` — SynkAI matching + salon hints
- `d4d72d8` — TERM_EXPANSIONS build fix
- *(next)* — gents intent normalization + tool failure reasons + jargon fix

---

## Possible next steps

- Settings UI for **`synkai_hints`** (salon-wide AI notes).
- Require **`match_service`** before the model suggests an alternative name (stricter tool policy).
- Unit tests for `booking-resolvers.ts` (no test suite yet).
- Re-test PAR-8 on production salon with real service names; note any menu labels that still fail.

---

## Deploy

Vercel project **salonsynk** (production aliases: salonsynk.com, barbersynk.com, nailsynk.com, smartsynk.net). Push **`main`** → auto deploy.
