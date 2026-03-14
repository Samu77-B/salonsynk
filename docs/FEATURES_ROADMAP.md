# SalonSynk – Features roadmap

This document maps requested features to current implementation and next steps.

---

## 1. No-Show Protection & Deposit System

| Item | Status | Notes |
|------|--------|------|
| Deposit settings (%, flat) | ✅ Added | Settings → No-Show & Deposit: toggle, type (percent/flat), value. Stored in `salons.settings`. |
| Card on file / Stripe Vaulting | ⏳ Not implemented | Requires SetupIntent + saving PaymentMethod to Customer; then charging that PM for deposit. |
| Cancellation policy checkbox | ✅ Added | Checkout: "I agree to the cancellation policy" required to proceed. |
| Charge No-Show Fee button | ✅ Added | Edit Appointment modal: "Charge No-Show Fee" for scheduled appointments; calls `POST /api/appointments/[id]/no-show` and captures existing `deposit_payment_intent_id` if set. |
| Flow to take deposit and set `deposit_payment_intent_id` | ⏳ Partial | Backend supports capturing deposit PI on no-show; the booking/checkout flow that creates a deposit PI and saves its ID on the appointment still needs to be wired (e.g. public book flow + Stripe Elements). |

---

## 2. Split-Payment Engine (Chair Renters)

| Item | Status | Notes |
|------|--------|------|
| Staff type (Employee vs Independent) | ✅ Exists | `salon_members.employment_type`: EMPLOYEE \| RENTER. (RENTER = Independent / chair renter.) |
| Stripe Connect for renters | ✅ Exists | Salon + renter Connect accounts; PaymentIntent with `transfer_data.destination` to stylist for RENTER. |
| Booth rent % to salon | ✅ Implemented | `admin_fee_percent` in salon settings; create-payment-intent uses it as `application_fee_amount` for RENTER. |
| Tax on total before split | ✅ Existing | Tax vault applied per Connect account; ensure VAT is calculated on full amount if required. |

---

## 3. Smart Gaps & Optimization

| Item | Status | Notes |
|------|--------|------|
| 15–30 min gap prevention | ✅ Exists | `lib/diary-rules.ts`: MIN_GAP_MINUTES = 15; getAllowedSlots / validateMove. |
| ProcessingTime on services | ✅ Added | `services.processing_time_minutes` (migration 015); Settings UI to set when adding/editing services. |
| Multi-service / “gap while color develops” | ⏳ Logic not wired | Slot logic does not yet treat the “processing” segment as bookable for another client. To add: when computing allowed slots, treat appointment as two blocks (active + processing) so a second client can be booked in the processing window. |

---

## 4. Automated Marketing & “We Miss You”

| Item | Status | Notes |
|------|--------|------|
| Review request 2h after completed | ✅ Exists | Cron: `send-review-requests`; optional **Google review URL** in Settings → Marketing (used in message when set). |
| We Miss You (6–10 weeks) | ✅ Added | Cron: `GET/POST /api/cron/send-we-miss-you`; `lib/we-miss-you.ts`; clients with last visit in configurable window get SMS/email with Book link + optional discount code. Settings: we_miss_you_weeks_min/max, we_miss_you_discount_code. |
| Discount codes | ⏳ UI only | Discount code is stored and sent in We Miss You; no redemption logic (e.g. at checkout) yet. |

---

## 5. Professional Technical Notes (Color Book)

| Item | Status | Notes |
|------|--------|------|
| Color History (structured) | ✅ Added | Client detail: Brand, Formula, Processing Time, result notes, image URL. Stored in `clients.color_formulas` (JSONB); backward compatible with legacy `text` / `image_url`. |
| Before/After photos per appointment | ✅ Added | `appointments.before_photo_url`, `after_photo_url` (migration 015); Edit Appointment modal: URL inputs. Optional: secure upload to storage and store URL. |

---

## 6. “2026 Edge” – Next steps

### AI Voice Receptionist

- **Status:** Not implemented.
- **Suggested:** Integrate **Vapi** or **Retell** for phone-in booking. Add env vars (e.g. `VAPI_API_KEY` or `RETELL_API_KEY`), a webhook that writes appointments into the same DB, and optional config in salon settings (e.g. “Enable voice booking”).

### Client Subscriptions (e.g. Blow-dry membership)

- **Status:** Not implemented. (Platform subscription for salons exists.)
- **Suggested:** Stripe Subscriptions for end clients: create Products/Prices per salon (e.g. “Blow-dry membership £60/month for 2 blow-dries”). New table e.g. `salon_membership_products` (salon_id, name, stripe_price_id, interval); checkout flow to create a Subscription; webhook to track active subscriptions and usage (e.g. 2 visits per month).

### Inventory & Barcode Scanner

- **Status:** Not implemented.
- **Suggested:** Add `products` (or `retail_products`) table (salon_id, name, sku, barcode, stock_quantity). Use a camera-based barcode lib (e.g. `react-qr-reader` or a barcode-specific scanner) to look up product and update stock or add to bill. Env/config only if needed for a specific scanner API.

---

## Env / config

- **CRON_SECRET:** Optional; set in production and pass as `Authorization: Bearer <CRON_SECRET>` when calling cron endpoints (see `.env.example`).
- **Optional placeholders** for future: AI voice (Vapi/Retell), client subscription Stripe price IDs, barcode API if any.
