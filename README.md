# Vetcare - Veterinary Clinic Management System

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL).
See `PROJECT_SPECIFICATION.md` (what) and `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` (how/when).

**Current status: Phase 12** — Senior Vet user management and an append-only audit log. Phases 1–10 stay in place: accounts, pets, appointments, SMS reminders, clinical records, POS, inventory, loyalty, and analytics. The pet weighing scale is not connected. Weight is still entered by hand.

A longer description of the system, security controls, and what is not finished is in `docs/SYSTEM.md`.

## Setup

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run the migrations in filename order from `supabase/migrations/`. The latest is `20261124000000_phase12_users_and_audit.sql`. Apply that file before using **Users** or **Audit logs**.
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

The script is how the first Senior Vet is created. After that, a Senior Vet can create more Staff and Senior Vet accounts at `/senior-vet/users`. Public registration still cannot create those roles. Email is the login identity and is not edited in that screen. The initial password is sent only to Supabase Auth. It is not stored on the profile and it is not written to the audit log.

Deactivate and reactivate accounts from that same page. Deactivation keeps appointments, bills, clinical records, and audit history. An inactive account cannot use the protected pages. Do not delete profile rows.

## Scripts

`npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck` | `npm run test`

## Phase 5 SMS reminders

Server-only environment variables:

- `UNISMS_API_SECRET_KEY` — UniSMS API secret. Sent as the Basic auth username with an empty password.
- `UNISMS_SENDER_ID` — sender id from the UniSMS dashboard. The default test sender cannot reach every Philippine network.
- `UNISMS_WEBHOOK_SECRET_KEY` — compared with the `webhook-secret-key` header. Leave it empty until the webhook is registered; the endpoint rejects every delivery until it is set.
- `CRON_SECRET` — Vercel sends `Authorization: Bearer <CRON_SECRET>` to the reminder job.
- `SUPABASE_SERVICE_ROLE_KEY` — used only on the server by the reminder job, the webhook, and Senior Vet account creation. Do not expose it to the browser.

The daily job is `0 1 * * *` in `vercel.json`, which is 09:00 Asia/Manila (UTC+8, no daylight saving). Vercel Cron calls `GET /api/cron/appointment-reminders`. That job still reminds only for the next Philippine calendar day. Staff and Senior Vet can also send the same appointment reminder early from an appointment detail page. A successful early send is stored for that schedule, so the daily job does not send a second one.

After the UniSMS account exists:

1. Apply `supabase/migrations/20261016000000_phase5_sms_and_reschedule.sql` if it is not already applied.
2. Set the environment variables in Vercel and redeploy.
3. Register `https://<production-host>/api/webhooks/unisms` in the UniSMS dashboard. UniSMS posts JSON and sends `webhook-secret-key` and `webhook-id`.

Automated tests use mocked UniSMS responses. They do not send a live SMS, and they do not prove that the provider, the webhook, or the Vercel schedule has run.

## Replacing placeholder content

All clinic name/tagline/hours/contact/services/team text is in `src/config/clinic.ts`.
