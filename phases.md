Phase 1 — Service Colours & Stylist Photos on Diary
Phase 1: Add service category colours to the diary, add stylist avatar photos to diary column headers, and remove the staff colour system.
- Add a "color" column to the services table (migration)
- Add a colour picker to the service management UI so salon owners can assign colours to services
- In the diary view, colour appointment blocks by service instead of by staff member
- Remove the stylistColorMap and replace with a serviceColorMap
- Add stylist avatar_url to the diary member query and show the photo in each column header (with initials fallback if no photo)
- Remove the "Diary colour" picker from the add/edit team member modals
- Keep the calendar_color column in the DB for now (just stop using it)
Phase 2 — Diary Interactions (Right-Click & Click)
Phase 2: Add right-click context menu and normal click behaviour to diary appointment entries.
- Right-clicking an appointment in the diary shows a context menu with: "Mark Status" (submenu: completed, no-show, cancelled), "Make Sale", "Running Late"
- Normal click on an appointment opens the appointment detail/edit modal where you can change time, add/change charges, etc.
- Make sure the context menu closes when clicking elsewhere

Phase 3 — Stylist Timing Overrides
Phase 3: Allow each stylist to have custom timing per service.
- Create a new table "stylist_service_overrides" with columns: stylist_id (FK to salon_members), service_id (FK to services), custom_duration_minutes (integer). Add migration with RLS.
- In the stylist's profile or team settings, add a UI where they can set their own duration for each service (falls back to default service duration if no override)
- When booking or displaying appointments on the diary, use the stylist's custom duration if one exists, otherwise use the default service duration

Phase 4 — Notification & Reminder Flexibility
Phase 4: Make appointment reminder timing configurable.
- Add a salon-level setting for reminder intervals (e.g. 12h, 24h, 48h) — could be a column on the salons table or a settings table
- Add UI in salon settings to choose which reminder intervals to send (checkboxes or multi-select)
- Update the reminder cron logic to use the configured intervals instead of hardcoded values
- Add skin test tracking: flag clients whose last skin test was over 12 months ago, show a warning when booking them

Phase 5 — Client Notes & Appointment Prompts
Phase 5: Add client notes and appointment prompts.
- Create a "client_notes" table with: id, client_id, salon_id, note text, note_type (general, colour_formula, skin_test), created_by, created_at. Add migration with RLS.
- Add a notes section on the client profile page where staff can add/view/delete notes
- When creating an appointment, show prompts like: "Client hasn't visited in X weeks", "Skin test due", "Last colour formula: ..."
- Include colour notes API integration placeholder if applicable

Phase 6 — Staff Passcode for Admin Access
Phase 6: Add a 4-digit passcode system for staff to access the admin panel.
- Add a "passcode_hash" column to salon_members (store bcrypt/hashed, never plain text). Add migration.
- Add a passcode setup UI in team settings where the salon owner can set/reset passcodes for each staff member (including themselves)
- Add a PIN entry screen that appears before accessing the admin/dashboard area
- This is an in-app access gate, separate from Supabase Auth login

Phase 7 — Reports & Business Snapshot
Phase 7: Add a "Snapshot of your business" section to the reports page with three basic reports.
- "General" report: total revenue, appointment count, new clients, rebooking rate for selected period
- "Staff Report": per-stylist breakdown — revenue, number of appointments, average spend
- "Gone Aways": clients who haven't returned in a configurable number of weeks/months
- Add weekly/monthly toggle and inc/exc VAT toggle for money figures
- Use clean card-based layout with key metrics prominently displayed

Phase 8 — Chargeable Appointment Changes
Phase 8: When an appointment is changed, show a popup asking if the change is chargeable.
- When a user modifies an appointment's time or service in the diary or appointment edit modal, show a confirmation dialog: "Is this change chargeable?" with Yes/No options
- If yes, prompt for the charge amount or auto-calculate based on cancellation policy
- Record the charge against the appointment

Phase 9 — Incentives & Targets
Phase 9: Add incentives for clients and staff targets.
- Create an "incentives" or "targets" table with: target type (revenue, appointments, retail), target value, period (weekly/monthly), assigned_to (staff member or client segment). Add migration with RLS.
- Add UI for salon owners to set targets for staff members
- Add a dashboard widget showing progress against targets
- Consider client incentives (e.g. loyalty points, visit-based rewards) as a basic structure

Phase 10 — AI Help Agent
Phase 10: Add a page-aware AI help agent.
- Add an AI chat widget (floating button) that appears on dashboard pages
- The agent should detect which page the user is on (diary, team, clients, settings, etc.) and offer contextual help
- Use Vercel AI SDK for the chat interface
- The agent should have knowledge about each page's features and be able to guide users
- Include a "Need help?" prompt that's contextual to the current page