# Vetcare - Veterinary Clinic Management System

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL).
See `PROJECT_SPECIFICATION.md` (what) and `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` (how/when).

**Current status: Phase 5** - SMS appointment reminders, SMS status tracking, and appointment rescheduling. Phases 1–4 (auth, pets, booking, and the appointment status workflow) remain in place.

## Setup

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run the migrations in filename order from `supabase/migrations/`. That includes the Phase 4 status workflow and `20261016000000_phase5_sms_and_reschedule.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, and service-role key.
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

`npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck` | `npm run test`

## Phase 5 SMS reminders

Server-only environment variables:

- `UNISMS_API_SECRET_KEY` — UniSMS API secret. Sent as the Basic auth username with an empty password.
- `UNISMS_SENDER_ID` — sender id from the UniSMS dashboard. The default test sender cannot reach every Philippine network.
- `UNISMS_WEBHOOK_SECRET_KEY` — compared with the `webhook-secret-key` header. Leave it empty until the webhook is registered; the endpoint rejects every delivery until it is set.
- `CRON_SECRET` — Vercel sends `Authorization: Bearer <CRON_SECRET>` to the reminder job.
- `SUPABASE_SERVICE_ROLE_KEY` — used only on the server by the reminder job and the webhook. Do not expose it to the browser.

The daily job is `0 1 * * *` in `vercel.json`, which is 09:00 Asia/Manila (UTC+8, no daylight saving). Vercel Cron calls `GET /api/cron/appointment-reminders`.

After the UniSMS account exists:

1. Apply `supabase/migrations/20261016000000_phase5_sms_and_reschedule.sql` if it is not already applied.
2. Set the environment variables in Vercel and redeploy.
3. Register `https://<production-host>/api/webhooks/unisms` in the UniSMS dashboard. UniSMS posts JSON and sends `webhook-secret-key` and `webhook-id`.

Automated tests use mocked UniSMS responses. They do not send a live SMS, and they do not prove that the provider, the webhook, or the Vercel schedule has run.

## Replacing placeholder content

All clinic name/tagline/hours/contact/services/team text is in `src/config/clinic.ts`.
