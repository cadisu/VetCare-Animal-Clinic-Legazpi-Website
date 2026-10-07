# Vetcare - Veterinary Clinic Management System

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL).
See `PROJECT_SPECIFICATION.md` (what) and `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` (how/when).

**Current status: Phase 3** - appointment scheduling with slot capacity, per-veterinarian and
clinic-wide lanes, client booking, staff walk-ins / book-on-behalf, Senior Vet service CRUD and
schedule configuration. Phases 1–2 (auth, roles, clients, pets) remain unchanged in behavior.

## Setup

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run the migrations in order:
   `supabase/migrations/20261001000000_phase1_profiles.sql`, then
   `supabase/migrations/20261005000000_phase2_clients_pets.sql`, then
   `supabase/migrations/20261006000000_phase3_appointments.sql`, then
   `supabase/migrations/20261006100000_phase3_mark_complete.sql`, then
   `supabase/migrations/20261008000000_phase3_pet_slot_availability.sql`
   (appointments, slots, services, veterinarians, booking RPCs, mark-complete RPC,
   pet-specific already-booked slot state).
3. Copy `.env.example` to `.env.local` and fill in your project URL, anon key and service-role key.
4. In Supabase **Authentication -> URL Configuration**, set **Site URL** to `NEXT_PUBLIC_SITE_URL`
   and add `<site-url>/auth/callback` to **Redirect URLs** (for both localhost and production).
5. `npm install`, then `npm run dev` and open http://localhost:3000.

## Creating Staff / Senior Vet accounts

Public sign-up only creates `CLIENT` accounts. Create privileged accounts with:

```bash
npm run create-privileged-user -- --email vet@clinic.test --password "YOUR_PASSWORD" --first-name "Alex" --last-name "Sample" --role SENIOR_VET
npm run create-privileged-user -- --email staff@clinic.test --password "YOUR_PASSWORD" --first-name "Taylor" --last-name "Example" --role STAFF
```

**Clinic bootstrap (Phase 3)** — run **after** the Phase 3 migration. Login uses **email** (not a separate username). Suggested addresses:

| Role | Email | Link veterinarian row |
|------|--------|------------------------|
| Senior Vet | `dr.carmela@vetcare.clinic` | `--veterinarian-id a1000000-0000-4000-8000-000000000001` |
| Senior Vet | `dr.merlyn@vetcare.clinic` | `--veterinarian-id a1000000-0000-4000-8000-000000000002` |
| Senior Vet | `dr.john@vetcare.clinic` | `--veterinarian-id a1000000-0000-4000-8000-000000000003` |
| Staff | `rk.marie@vetcare.clinic` | (none) |

Re-run the same command if an account already exists; it will skip creation and still apply `--veterinarian-id` linking. Do not commit passwords.

To deactivate an account (Phase 1 has no UI for this), run in the SQL Editor:
`update public.profiles set status = 'INACTIVE' where email = 'someone@example.com';`

## Scripts

`npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck`

## Replacing placeholder content

All clinic name/tagline/hours/contact/services/team text is in `src/config/clinic.ts`.
