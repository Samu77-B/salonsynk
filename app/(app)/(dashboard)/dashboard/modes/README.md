# Dashboard modes (Classic vs AI-Assisted)

The dashboard supports two interchangeable views. Staff choose a mode via the segmented control; the choice persists in `localStorage` under `salonsynk-dashboard-mode`.

## Architecture

| File | Role |
|------|------|
| `dashboard-mode.ts` | Types, labels, storage key |
| `mode-switch.tsx` | Classic / AI-Assisted toggle UI |
| `dashboard-mode-shell.tsx` | Orchestrator — reads/writes mode, renders the active view |
| `classic-mode-view.tsx` | Wrapper for the existing diary grid and widgets (unchanged behaviour) |
| `ai-assisted-mode-view.tsx` | AI booking chat + Quick Fill gap panel |
| `ai-booking-chat.tsx` | Staff AI chat (`/api/ai/booking-assistant`) |
| `ai-gap-fill-panel.tsx` | Calendar gap scanner + last-minute promotion templates |

## Classic Mode

Contains the full diary (`DiaryView`), targets widget, and the legacy **Gap Filler** (lapsed-client SMS for empty slots). No AI chat.

## AI-Assisted Mode

- **AI booking** — same scheduling backend as Classic (`lib/ai/slot-finder.ts`, `lib/appointments/create-guest-appointment.ts` for guest paths). Staff tools include client lookup, reschedule, and internal notes via `lib/ai/booking-tools.ts`.
- **Quick Fill** — scans 30–60 minute calendar gaps (`lib/ai/calendar-gaps.ts`) and generates SMS/email promotion copy (`/api/ai/gap-fill`). Distinct from Classic Gap Filler (lapsed clients).

After AI bookings or reschedules, `router.refresh()` keeps Classic Mode in sync.

## Public booking (client-facing)

Public pages at `/book/[slug]` and `/book/[slug]/embed` use `PublicBookingExperience`:

| Tab | Component | API |
|-----|-----------|-----|
| Book online | `GuestBookingForm` | Server action → `executeGuestBooking` |
| AI Concierge | `components/public/public-ai-concierge.tsx` | `/api/public/salon/[slug]/booking-concierge` |
| Salon QA | `components/public/public-salon-qa.tsx` | `/api/public/salon/[slug]/qa` |

Public AI uses `lib/ai/public-booking-tools.ts` — guest-safe subset (no client list, no reschedule). Shared chat UI: `components/ai/ai-chat-ui.tsx`.

## Environment

Staff and public AI require `OPENAI_API_KEY` on the server.

## Adding a third mode

1. Extend `DashboardMode` in `dashboard-mode.ts`.
2. Add a label in `DASHBOARD_MODE_LABELS`.
3. Handle the new value in `dashboard-mode-shell.tsx` and `mode-switch.tsx`.
