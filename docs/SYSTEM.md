# VetCare system notes

This file describes the clinic system as it stands after Phase 12. `PROJECT_SPECIFICATION.md` remains the source of what the clinic is supposed to do. `VETERINARY_CLINIC_IMPLEMENTATION_PHASES.md` remains the build order.

Vercel on a free or entry plan is a thesis and prototype deployment. A real clinic should confirm the host's commercial terms before relying on it for daily operations.

## Architecture

The application is a Next.js App Router site. Supabase provides Auth, PostgreSQL, and private storage for pet, profile, and product images. The app is set up to deploy on Vercel. Appointment reminders are sent through UniSMS when that provider is configured. There is no connection to a weighing scale.

Staff and Senior Vet share the operational pages under `/staff`. Senior Vet-only pages live under `/senior-vet`. Clients use `/client`.

## Roles

| Role | What they can do |
|---|---|
| Client | Own profile, pets, appointments, loyalty card, and permitted clinical information for their own pets. |
| Staff | Operational work: appointments, walk-ins, clients and pets, manual weight, POS, inventory, analytics, and loyalty operation where the database allows it. |
| Senior Vet | Staff work, plus clinical and vaccination records, service and schedule setup, loyalty configuration, user management, and audit logs. |

Public registration always creates a client. It cannot create a staff or Senior Vet account. A person cannot change their own role.

## Modules

- Public site: home, services, about, team, booking entry, login, and registration. Clinic wording lives in `src/config/clinic.ts`.
- Accounts and pets.
- Appointments, capacity, walk-ins, and status changes.
- SMS reminders and rescheduling.
- Clinical records, vaccinations, and manual weight history.
- POS and inventory.
- 12-stamp loyalty card.
- Analytics at `/staff/analytics`.
- User management at `/senior-vet/users` and audit logs at `/senior-vet/audit`.

## Database

SQL files in `supabase/migrations/` are applied in filename order. The Phase 12 file is `20261124000000_phase12_users_and_audit.sql`.

Important writes go through database functions that check the caller's role. Sensitive tables do not grant insert, update, or delete to signed-in users. `audit_logs` can be read by an active Senior Vet and cannot be updated or deleted.

Deactivating an account sets `profiles.status` to `INACTIVE`. It does not delete appointments, bills, clinical rows, or audit rows.

## Authentication

Supabase Auth holds the password. The app profile holds the role and status. Login, middleware, and `requireRole` reject an inactive account. The email callback does the same after a confirmation or password-reset link is opened.

Password reset uses `/forgot-password` and `/reset-password`. The site URL and the auth callback must be set in Supabase, using `NEXT_PUBLIC_SITE_URL`.

## Authorization

A page under `/senior-vet` requires an active Senior Vet. A page under `/staff` allows Staff and Senior Vet. A page under `/client` allows a client. Hiding a link is not the only check. The database functions reject the wrong role as well.

A Senior Vet cannot deactivate their own account, cannot change their own role, and cannot leave the clinic with no active Senior Vet. Client accounts are not promoted into staff from the user screen. A new staff account is a separate login.

## Appointment workflow

A client books an open slot. The database enforces capacity. Staff can create a walk-in, including a same-day visit for a time that has already passed. Status moves through the allowed steps only: pending, confirmed, checked in, in consultation, completed, cancelled, or no-show. Cancelling a visit is recorded in the audit log. Changing a slot's capacity or blocked flag is recorded there too.

## SMS workflow

The daily job in `vercel.json` calls `/api/cron/appointment-reminders` with `CRON_SECRET`. It reminds for the next clinic day and skips a visit that was already reminded. Delivery updates can arrive at `/api/webhooks/unisms`. Live SMS is ready only after the UniSMS keys, sender id, webhook secret, and cron secret are set and a real reminder has been observed. The automated tests do not send a message.

## Clinical record workflow

An active Senior Vet creates the official visit note and vaccinations. A correction adds a new revision and keeps the older one. Staff can record a manual weight. Clients can read permitted records for their own pets. New clinical and vaccination revisions are written to the audit log without the note text.

## POS workflow

Staff or a Senior Vet builds a bill for a client and pet, or a counter sale. Totals are calculated in the database. Completing or voiding a bill is audited. Stock sold on a bill is reduced when the bill is completed and restored when it is voided.

## Inventory workflow

Products, batches, expiration, and stock movements live in the inventory pages. Manual stock changes (stock in, stock out, adjustment, damaged, missing, and expired) are audited. Sale and void movements stay on the bill and are not given a second inventory audit row.

## Loyalty workflow

The card is stamp-based. The default limit is 12. Eligible services, milestones, and rewards are configured in the clinic. A stamp is earned from the database rules, not by a client awarding it to themselves. Redeeming a reward on a completed bill writes an audit row. Changing the program or a reward writes an audit row. Descriptions are not copied into the log.

## Analytics

`/staff/analytics` reads existing records for a Manila date range. It does not create appointments, payments, stock changes, or stamps.

## Security controls

- Roles and inactive status are checked in the app and in the database.
- Row Level Security is enabled on application tables.
- The service-role key is read only on the server. It is used for reminders, the SMS webhook, and creating a staff or Senior Vet login. It is not sent to the browser.
- Passwords are not stored in `profiles` or `audit_logs`.
- Uploaded images are limited by type and size and kept in private buckets.
- Audit metadata stores ids, statuses, and short operational values. It does not store clinical notes.

## Deployment

1. Apply every file in `supabase/migrations/` in order, including the Phase 12 file.
2. Set the variables from `.env.example` in Vercel. `SUPABASE_SERVICE_ROLE_KEY`, the UniSMS values, and `CRON_SECRET` stay server-side.
3. Set the Supabase site URL and add `<site-url>/auth/callback` to the redirect URLs.
4. Create the first Senior Vet with `npm run create-privileged-user`. Further staff accounts can be created in the app.
5. Register the UniSMS webhook only after the SMS account exists. See the SMS section in `README.md`.

## Known limitations

- The weighing scale is not connected. Weight is entered by hand. The weight record can store a source of `IOT` later, but this build does not talk to an ESP32 or a load cell.
- Live SMS is not treated as proven until a real UniSMS reminder and webhook have been seen in the deployed clinic.
- This deployment target is a thesis prototype unless the clinic accepts a suitable Vercel plan.

## Future work

- Connect the pet scale, with a manual fallback when the device is offline.
- Confirm live SMS delivery on the clinic's UniSMS account.

## Manual checks

These are for a person to walk through in the clinic. The automated test checks the Phase 12 database rules. It does not book a real visit or send an SMS.

1. Create a client, sign in, register a pet, and open the pet profile.
2. Book a service on an open date and time, and confirm the slot count drops.
3. Fill a slot to capacity and confirm another client cannot take it, including from a direct request.
4. Schedule a next-day visit and run the reminder job only when UniSMS is configured. Confirm a status row is stored and a second run does not send a duplicate.
5. As staff, create a walk-in and confirm it appears in analytics.
6. Record a weight by hand and confirm the earlier weight is still in the history. The scale scenario is deferred.
7. As a Senior Vet, save a clinical record, a vaccination, and a follow-up. Sign in as the client and confirm they can read the permitted record.
8. Complete a POS bill with a service or product and, when a reward is available, apply that reward. Confirm stock changes when a product is sold.
9. Complete an eligible visit, confirm a stamp, reach a milestone, redeem the reward, and confirm the older stamp is still listed.
10. Confirm a client cannot open another client's pet, a staff account cannot edit a clinical record, a staff account cannot open `/senior-vet/users`, and an inactive account cannot use a protected page.
