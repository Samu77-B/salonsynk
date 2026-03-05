# SalonSynk setup

## 1. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase keys:

```bash
cp .env.example .env.local
```

In **Supabase Dashboard** → your project **Settings** → **API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret; server-only use)

## 2. Database schema

In **Supabase Dashboard** → **SQL Editor** → **New query**, paste the contents of  
`supabase/migrations/001_initial_schema.sql` and run it.  
This creates `salons`, `profiles`, `salon_members`, `clients`, `services`, `appointments` and RLS policies.

## 3. Auth redirect URL (email confirmation)

In **Supabase Dashboard** → **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000` (dev) or your production URL
- **Redirect URLs:** add  
  `http://localhost:3000/auth/callback`  
  and your production callback URL, e.g.  
  `https://salonsynk.com/auth/callback`

## 4. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use **Sign up** to create an account; confirm email if required by your Supabase Auth settings.

## 5. Deploy to production (salonsynk.com)

To host the app at **https://salonsynk.com** on Vercel and point your domain, see **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions (Git, Vercel project, env vars, domain DNS, Supabase production URLs).
