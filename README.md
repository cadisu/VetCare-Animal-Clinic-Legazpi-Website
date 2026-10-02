# Vetcare - Veterinary Clinic Management System

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL).
See `PROJECT_SPECIFICATION.md` (what) and `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` (how/when).

**Current status: Phase 1** - public website, authentication, roles, protected role dashboards.

## Setup

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run `supabase/migrations/20261001000000_phase1_profiles.sql`.
3. Copy `.env.example` to `.env.local` and fill in your project URL, anon key and service-role key.
4. In Supabase **Authentication -> URL Configuration**, set **Site URL** to `NEXT_PUBLIC_SITE_URL`
   and add `<site-url>/auth/callback` to **Redirect URLs** (for both localhost and production).
5. `npm install`, then `npm run dev` and open http://localhost:3000.

## Creating Staff / Senior Vet accounts

Public sign-up only creates `CLIENT` accounts. Create privileged accounts with:

```bash
npm run create-privileged-user -- --email vet@clinic.test --password "Str0ngPass1" --name "Dr. Alex Sample" --role SENIOR_VET
npm run create-privileged-user -- --email staff@clinic.test --password "Str0ngPass1" --name "Taylor Example" --role STAFF
```

To deactivate an account (Phase 1 has no UI for this), run in the SQL Editor:
`update public.profiles set status = 'INACTIVE' where email = 'someone@example.com';`

## Scripts

`npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck`

## Replacing placeholder content

All clinic name/tagline/hours/contact/services/team text is in `src/config/clinic.ts`.
