# Vetcare - Veterinary Clinic Management System

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL).
See `PROJECT_SPECIFICATION.md` (what) and `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` (how/when).

**Current status: Phase 2** - client registration (last/middle/first name, address, birthdate,
contact no.), optional "register your pets" step on first login, My Pets, pet profiles, client
profile editing, and Staff/Senior Vet client search with read-only client and pet views.

## Setup

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run the migrations in order:
   `supabase/migrations/20261001000000_phase1_profiles.sql`, then
   `supabase/migrations/20261005000000_phase2_clients_pets.sql`
   (creates the `pets` table and the private `pet-images` Storage bucket).
3. Copy `.env.example` to `.env.local` and fill in your project URL, anon key and service-role key.
4. In Supabase **Authentication -> URL Configuration**, set **Site URL** to `NEXT_PUBLIC_SITE_URL`
   and add `<site-url>/auth/callback` to **Redirect URLs** (for both localhost and production).
5. `npm install`, then `npm run dev` and open http://localhost:3000.

## Creating Staff / Senior Vet accounts

Public sign-up only creates `CLIENT` accounts. Create privileged accounts with:

```bash
npm run create-privileged-user -- --email vet@clinic.test --password "Str0ngPass1" --first-name "Alex" --last-name "Sample" --role SENIOR_VET
npm run create-privileged-user -- --email staff@clinic.test --password "Str0ngPass1" --first-name "Taylor" --last-name "Example" --role STAFF
```

To deactivate an account (Phase 1 has no UI for this), run in the SQL Editor:
`update public.profiles set status = 'INACTIVE' where email = 'someone@example.com';`

## Scripts

`npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck`

## Replacing placeholder content

All clinic name/tagline/hours/contact/services/team text is in `src/config/clinic.ts`.
