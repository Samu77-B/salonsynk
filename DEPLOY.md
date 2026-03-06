# Deploy SalonSynk to salonsynk.com (Vercel)

Use **Vercel** to host the Next.js app and point **salonsynk.com** at it. Backend stays on Supabase.

---

## 1. Push your code to Git

If you haven’t already, create a repo (e.g. on GitHub) and push this project:

```bash
git init
git add .
git commit -m "Initial SalonSynk app"
git remote add origin https://github.com/YOUR_USERNAME/salonsynk.git
git push -u origin main
```

(Use your real repo URL and branch name.)

---

## 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New** → **Project**.
3. **Import** your Git repository (e.g. GitHub).
4. Leave **Framework Preset** as Next.js and **Root Directory** as `.`.
5. **Environment Variables** — add the same ones you use in `.env.local` (Vercel will use these in production):

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` (if you use Stripe)
   - `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - Optional: `CRON_SECRET` for reminder and review-request crons
   - Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (and `TWILIO_WHATSAPP_NUMBER`) for SMS/WhatsApp reminders and review requests

   Do **not** commit `.env.local`; set these in the Vercel project **Settings → Environment Variables**.

6. Click **Deploy**. Vercel will build and give you a URL like `salonsynk-xxx.vercel.app`.

---

## 3. Use your domain (salonsynk.com)

1. In the Vercel project: **Settings** → **Domains**.
2. Add **salonsynk.com** (and optionally **www.salonsynk.com**).
3. Vercel will show the DNS records you need (usually an **A** record or **CNAME**).
4. In **Hostinger** (or wherever salonsynk.com is registered):
   - Open **DNS** / **Domain management** for salonsynk.com.
   - Add the record Vercel shows, e.g.:
     - **A** record: name `@`, value `76.76.21.21` (Vercel’s IP), or
     - **CNAME**: name `@` or `www`, value `cname.vercel-dns.com`.
   - Save and wait for DNS to propagate (up to 24–48 hours, often minutes).
5. Back in Vercel, confirm the domain and enable **HTTPS** if prompted.

Your app will then be live at **https://salonsynk.com**.

---

## 4. Supabase: production auth URLs

In **Supabase** → **Authentication** → **URL Configuration**:

- **Site URL:** `https://salonsynk.com`
- **Redirect URLs:** add:
  - `https://salonsynk.com/auth/callback`
  - Keep `http://localhost:3000/auth/callback` for local dev

---

## 5. Optional: run migrations and invite table

- In Supabase **SQL Editor**, run `supabase/migrations/001_initial_schema.sql` if you haven’t already.
- If you use team invites, run `supabase/migrations/002_salon_invites.sql`.
- For review-request tracking, run `supabase/migrations/003_appointment_review_request.sql`.

---

## 6. Carry on the build

After deploy:

- Test sign up / sign in at **https://salonsynk.com**.
- Complete onboarding (create salon, add services).
- Use **Dashboard**, **Team**, **Clients**, **Checkout**, **Settings** as built.
- Configure Stripe Connect and webhooks when you’re ready for payments.
- Set up crons (e.g. Vercel Cron or external):
  - **Reminders:** hit `GET /api/cron/send-reminders` (e.g. daily). Sends email and/or SMS/WhatsApp to clients with upcoming appointments (24h ahead). Configure Twilio for SMS/WhatsApp.
  - **Review requests:** hit `GET /api/cron/send-review-requests` (e.g. every few hours). Sends email and/or SMS/WhatsApp ~2 hours after a completed appointment asking for a review. Use the same `Authorization: Bearer <CRON_SECRET>` header for both.

Future code changes: push to your Git branch; Vercel will redeploy automatically if the project is connected to the repo.
