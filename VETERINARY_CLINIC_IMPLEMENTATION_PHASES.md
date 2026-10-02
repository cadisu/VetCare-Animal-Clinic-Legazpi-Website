# Veterinary Clinic Management System
# End-to-End AI LLM Implementation Phases

## How to use this document

This document is the **implementation roadmap and prompt set** for the Veterinary Clinic Management System.

The permanent business and system requirements are defined in:

`PROJECT_SPECIFICATION.md`

This file defines **how the LLM should implement the project phase by phase**.

IMPORTANT:

- Read `PROJECT_SPECIFICATION.md` before implementing any phase.
- Implement only the current phase.
- Do not skip ahead to later phases unless explicitly instructed.
- Do not invent business rules that conflict with `PROJECT_SPECIFICATION.md`.
- Do not change the selected technology stack unless explicitly instructed.
- Preserve existing working functionality when implementing later phases.
- After each phase, test the affected functionality before moving to the next phase.
- At the end of each phase, provide a concise implementation report and STOP.
- Do not automatically continue to the next phase.

---

# GLOBAL PROJECT RULES

## Project goal

Build a responsive web-based Veterinary Clinic Management System that provides:

- Public veterinary clinic website
- Client portal
- Staff/receptionist portal
- Senior Vet/Admin portal
- Appointment scheduling
- Appointment capacity management
- Walk-in management
- SMS appointment reminders
- SMS delivery/status tracking
- Pet profiles
- Veterinary clinical records
- Vaccination records
- Pet weight history
- IoT-enabled automatic pet weighing
- POS
- Inventory
- Digital loyalty stamp card
- Configurable loyalty rewards
- Analytics
- Role-based access control
- Audit logs
- Secure data handling

## Technology stack

Use:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage where appropriate
- Vercel for the thesis prototype
- Semaphore or another suitable Philippine SMS provider
- ESP32
- Load cell
- Load-cell amplifier/sensor module
- Wi-Fi/network communication for the IoT component

Do not use React Native.

Do not use XAMPP as the application architecture.

Use PostgreSQL rather than MongoDB because this system is highly relational.

## Visual design

Primary color:

`#584A99`

Secondary color:

`#D82500`

Design should be:

- Clean
- Professional
- Spacious
- Modern
- Responsive
- Mobile-friendly
- Desktop-friendly
- Tablet-friendly
- Minimal
- Easy to navigate

Avoid excessive animation, gradients, crowded layouts, and unnecessary complexity.

Use temporary placeholder content for:

- Logo
- Clinic name
- Photos
- Staff images
- Clinic address
- Phone number
- Email
- Clinic hours
- About content
- Service images

## User roles

Exactly three primary application roles:

1. `CLIENT`
2. `STAFF`
3. `SENIOR_VET`

General permission model:

CLIENT
→ own customer-facing data and functions

STAFF
→ clinic operational functions

SENIOR_VET
→ all authorized clinic functions plus administration and clinical record editing

## Security principles

Security must be enforced server-side and at the database level where appropriate.

Never rely only on hiding buttons.

The system must prevent:

- Clients accessing other clients' information
- Clients changing their role
- Clients creating Staff or Senior Vet accounts
- Staff changing their role
- Staff editing protected clinical records
- Staff accessing Senior Vet-only administration
- Unauthorized users accessing protected routes
- Users bypassing permissions by manually changing URLs or IDs

Use Supabase Auth and PostgreSQL Row Level Security where appropriate.

Do not expose secrets in frontend code.

Use environment variables.

Preserve historical records rather than unnecessarily deleting them.

Prefer account deactivation over destructive deletion when historical records are involved.

---

# DEVELOPMENT WORKFLOW FOR EVERY PHASE

Before starting the current phase:

1. Read `PROJECT_SPECIFICATION.md`.
2. Read this phase's instructions.
3. Inspect the current project.
4. Inspect existing implementation from previous phases.
5. Identify dependencies and constraints.
6. Explain what will be changed.
7. Implement only this phase.

During implementation:

- Reuse existing components and utilities when appropriate.
- Avoid unnecessary dependencies.
- Keep the architecture understandable for a thesis defense.
- Validate important operations on both frontend and backend.
- Preserve existing features.
- Do not replace working features unnecessarily.

After implementation:

1. Run appropriate checks/tests.
2. Test normal workflows.
3. Test invalid/unauthorized workflows.
4. Review for obvious security problems.
5. Report files created/changed.
6. Report database changes.
7. Report manual environment/setup requirements.
8. Report known limitations.
9. STOP.

---

# PHASE 1 — PUBLIC WEBSITE FOUNDATION, AUTHENTICATION, AND USER ROLES

## Goal

Establish the actual website foundation.

At the end of Phase 1, a visitor should be able to open the application and see a real veterinary clinic homepage.

Clients should be able to register and log in.

Authorized Staff and Senior Vet accounts should be able to log in.

Each role should be redirected to its own protected dashboard.

## 1. Inspect project

Read:

- `PROJECT_SPECIFICATION.md`
- This implementation document

Determine whether the project has already been initialized.

Do not recreate or overwrite working project files unnecessarily.

## 2. Public pages

Create:

- Home
- Services
- About Us
- Meet Our Veterinary Team
- Book an Appointment
- Login
- Create Account

All may use placeholder content in this phase.

## 3. Homepage

The homepage should look like an actual veterinary clinic landing page.

Include:

- Hero section
- Temporary clinic name
- Tagline
- Short clinic introduction
- Book an Appointment button
- View Services button
- Featured services
- About preview
- Why choose us
- Veterinary team preview
- Clinic hours
- Contact information
- Footer

## 4. Public navigation

Include:

- Home
- Services
- About Us
- Meet Our Veterinary Team
- Book an Appointment
- Login
- Create Account

Make navigation responsive.

## 5. Authentication

Implement:

- Client registration
- Login
- Logout
- Session persistence
- Password recovery/reset

Use Supabase Auth.

Only Clients can publicly self-register.

Do not allow a user to select STAFF or SENIOR_VET during public registration.

## 6. Application profile

Create the application-level user/profile structure connected to the Supabase Auth user.

Include appropriate fields such as:

- user id
- name
- email
- contact number
- role
- account status
- created timestamp
- updated timestamp

Roles:

- CLIENT
- STAFF
- SENIOR_VET

Status:

- ACTIVE
- INACTIVE

## 7. Role dashboards

Create visible placeholder dashboards.

Client:
- welcome message
- upcoming appointment placeholder
- pets placeholder
- loyalty placeholder
- recent activity placeholder

Staff:
- today's appointments placeholder
- walk-in placeholder
- clients placeholder
- POS placeholder
- inventory placeholder
- analytics placeholder

Senior Vet:
- today's appointments placeholder
- clinic overview
- revenue placeholder
- inventory alerts placeholder
- analytics placeholder
- user management placeholder
- clinical records placeholder

## 8. Protected routes

Use clear protected areas such as:

- `/client/*`
- `/staff/*`
- `/senior-vet/*`

Rules:

CLIENT:
- can access Client area
- cannot access Staff area
- cannot access Senior Vet area

STAFF:
- can access Staff area
- cannot access Senior Vet area

SENIOR_VET:
- can access Senior Vet area
- can access authorized staff-level functionality where appropriate

Unauthenticated:
- cannot access protected areas

Authorization must be enforced server-side.

## 9. Phase 1 testing

Test:

- Public homepage without login
- Public pages without login
- Client registration
- Client login
- Client logout
- Client blocked from Staff pages
- Client blocked from Senior Vet pages
- Staff login
- Staff blocked from Senior Vet pages
- Senior Vet login
- Inactive users blocked appropriately
- Unauthorized direct URL access blocked
- Mobile responsiveness

## Phase 1 must NOT implement yet

Do not implement:

- full client/pet management
- appointment scheduling
- appointment slot capacity
- appointment statuses
- SMS
- clinical records
- vaccination
- POS
- inventory
- loyalty
- analytics
- IoT
- complete user management
- complete audit logs

STOP after Phase 1.

---

# PHASE 2 — CLIENT AND PET MANAGEMENT

## Goal

Implement the customer and pet foundation.

Do not implement the full appointment, clinical, POS, inventory, loyalty, analytics, SMS, or IoT modules yet.

## 1. Client profile

Allow Clients to view and manage their permitted personal information.

Possible fields:

- full name
- contact number
- email
- address
- profile image if desired
- account status

Clients may edit appropriate basic personal information.

Clients may not edit:

- official clinical information
- vaccination records
- veterinarian notes
- protected medical information

## 2. My Pets

Create a Client "My Pets" page.

Display:

- pet image
- name
- species
- breed
- basic information

Allow an authorized Client to register their pets.

## 3. Pet registration

Pet information may include:

- name
- species
- breed
- sex
- birth date
- age where appropriate
- color
- image
- owner
- registration date
- other appropriate identifiers

Relationship:

One Client → Many Pets

## 4. Pet profile

Create a detailed pet profile.

Include sections/placeholders for:

- Basic information
- Current/latest weight
- Weight history placeholder
- Vaccination history placeholder
- Clinical records placeholder
- Appointment history placeholder

The later phases will populate these sections.

## 5. Staff access

Staff can:

- search Clients
- view Clients
- view Pets
- view relevant information

Staff cannot edit protected medical information.

The final system will allow Staff to edit weight only.

## 6. Senior Vet access

Senior Vet can view Client and Pet data and will later be allowed to edit protected information.

## 7. Database

Create/adjust relational structures for:

- clients
- pets
- pet profile information
- appropriate client/user relationships

Use foreign keys and appropriate constraints.

## 8. Security

Clients must only see their own:

- account
- pets

A Client must not be able to access another Client's pet by modifying URL parameters or IDs.

Use appropriate Row Level Security.

## 9. Testing

Test:

- Client creates pet
- Client views pet
- Client views only their own pets
- Staff can search/view clients and pets
- Unauthorized Client access is blocked
- Senior Vet can view records
- Pet information persists after logout/login

STOP after Phase 2.

---

# PHASE 3 — APPOINTMENT SCHEDULING AND LIMITED SLOT CAPACITY

## Goal

Implement the complete appointment scheduling foundation.

This phase is one of the most important.

The clinic must be able to control available days, times, and capacity.

Clients must never be allowed to overbook a slot.

## 1. Appointment entities

Create appropriate structures for:

- appointment
- appointment slot
- schedule/availability where appropriate
- client
- pet
- service

A booking should be associated with:

- client
- pet
- service
- appointment date
- appointment time
- appointment slot
- source/type
- status

## 2. Appointment slot management

Authorized Staff and Senior Vets can manage:

- available dates
- available times
- capacity
- blocked dates
- blocked time slots
- appointment availability

Example:

10:00 AM
Capacity: 3
Booked: 2
Remaining: 1

11:00 AM
Capacity: 3
Booked: 3
Status: FULL

12:00 PM
Status: BLOCKED

1:00 PM
Capacity: 3
Booked: 0
Remaining: 3

## 3. Client appointment workflow

Client:

Select service
→ select date
→ select available time
→ select pet where appropriate
→ confirm appointment

The system must verify availability before creating the appointment.

## 4. Date behavior

Unavailable dates must NOT be clickable.

Examples:

- past dates
- clinic closed
- no schedule configured
- manually blocked
- otherwise unavailable

Only available dates are selectable.

## 5. Time behavior

Unavailable time slots must NOT be clickable.

Show states such as:

- AVAILABLE
- FULL
- BLOCKED
- UNAVAILABLE

If capacity is 3 and 3 bookings already exist, the slot is FULL and cannot be selected.

## 6. Backend enforcement

Do not rely only on frontend disabling.

The server/database must verify:

- date availability
- time availability
- capacity
- valid Client
- valid Pet
- valid Service

## 7. Prevent overbooking

Account for simultaneous booking attempts.

If only one slot remains and two clients attempt to book it simultaneously, only one should succeed.

The capacity must be safely enforced at the backend/database level.

## 8. Appointment confirmation

After a successful booking:

- save appointment
- associate it with the selected Client
- associate selected Pet
- associate selected Service
- save slot/date/time
- return confirmation to Client

## 9. Appointment pages

Client:
- upcoming appointments
- appointment details
- appointment history

Staff:
- appointment schedule
- day view
- search/filter
- slot management

Senior Vet:
- all Staff appointment functions
- schedule configuration

## 10. Walk-in foundation

Allow Staff and Senior Vet to create a walk-in visit/appointment.

Store source as:

- APPOINTMENT
- WALK_IN

A Walk-In should be distinguishable in analytics later.

## 11. Testing

Test:

- Available date clickable
- Blocked date not clickable
- Available slot selectable
- Full slot not selectable
- Booking succeeds when capacity exists
- Booking fails when capacity is reached
- Concurrent booking does not overbook
- Walk-in can be created
- Client sees own appointment
- Client cannot see another Client's appointment

STOP after Phase 3.

---

# PHASE 4 — APPOINTMENT STATUS WORKFLOW

## Goal

Implement appointment status management.

Use these statuses:

- PENDING
- CONFIRMED
- CHECKED_IN
- IN_CONSULTATION
- COMPLETED
- CANCELLED
- NO_SHOW

## 1. Recommended workflow

Normal appointment:

PENDING
→ CONFIRMED
→ CHECKED_IN
→ IN_CONSULTATION
→ COMPLETED

Cancellation:

PENDING/CONFIRMED
→ CANCELLED

No show:

CONFIRMED
→ NO_SHOW

## 2. Permissions

Client:
- may request cancellation where business rules permit
- may view status
- must not arbitrarily change clinic operational status

Staff:
- manage operational statuses such as Confirmed, Checked In, In Consultation, Completed, Cancelled, No Show according to permitted workflow

Senior Vet:
- full appointment status authority

## 3. Status display

Use clear badges.

Examples:

PENDING
CONFIRMED
CHECKED IN
IN CONSULTATION
COMPLETED
CANCELLED
NO SHOW

Use consistent colors and labels without relying only on color.

## 4. Prevent invalid transitions

Do not allow impossible status changes without authorization.

For example, a cancelled appointment should not silently become completed.

Define appropriate transition rules.

## 5. Check-in

When the client arrives:

Staff:
→ locate appointment
→ verify client/pet
→ mark CHECKED_IN

## 6. Consultation

When service begins:

CHECKED_IN
→ IN_CONSULTATION

## 7. Completion

After service/visit:

IN_CONSULTATION
→ COMPLETED

The later clinical and POS modules will connect to these states.

## 8. Testing

Test all normal and invalid transitions.

Verify that status is saved in database and reflected in dashboards.

STOP after Phase 4.

---

# PHASE 5 — SMS APPOINTMENT REMINDERS AND SMS STATUS TRACKING

## Goal

Automatically notify clients one day before an appointment.

Use a suitable SMS provider for Philippine mobile numbers, preferably Semaphore unless project requirements change.

## 1. Reminder rule

For appointments scheduled for the next day:

- detect eligible appointments
- confirm appointment is not cancelled/completed/no-show
- confirm reminder has not already been sent successfully
- send SMS
- store result

## 2. Example message

"Good day! This is a reminder that [Pet Name] has a [Service] appointment at [Clinic Name] on [Date] at [Time]. Please contact us if you need to reschedule."

Keep the message concise and configurable where appropriate.

## 3. SMS records

Store:

- appointment
- client
- phone number
- message
- created timestamp
- sent timestamp
- provider response
- provider message/reference id where available
- status
- error information

Statuses can include:

- PENDING
- QUEUED
- SENT
- FAILED
- DELIVERED if provider supports it
- CANCELLED where appropriate

## 4. Duplicate prevention

Do not send multiple reminders for the same appointment unless explicitly required.

If the reminder was already successfully sent:

Do not send another reminder automatically.

## 5. Rescheduled appointments

If appointment date/time changes:

- determine whether a new reminder is required
- prevent stale reminders from being sent
- preserve historical status

## 6. Cancelled appointments

Do not send reminders for cancelled appointments.

## 7. Scheduled execution

Use an appropriate server-side scheduled job/cron mechanism compatible with the deployment architecture.

The process should identify appointments occurring the following day.

Do not rely on a receptionist manually triggering reminders every day.

## 8. SMS failure handling

If sending fails:

- save FAILED
- preserve error information
- allow Staff/Senior Vet to see the status

Do not silently discard failures.

## 9. Testing

Test:

- reminder is generated one day before
- cancelled appointment is excluded
- already-sent reminder is not duplicated
- failed message is logged
- SMS status is visible
- rescheduled appointment is handled correctly

STOP after Phase 5.

---

# PHASE 6 — CLINICAL RECORDS AND VACCINATION MANAGEMENT

## Goal

Implement protected veterinary clinical records.

Senior Vets are the only users who can edit official clinical records.

Staff can view protected records where permitted.

Clients can view their own permitted pet records but cannot edit them.

## 1. Clinical record

A clinical record may contain:

- pet
- date
- veterinarian
- visit/appointment
- reason for visit
- clinical notes
- assessment
- treatment
- follow-up
- other appropriate medical information

## 2. Historical records

Do not overwrite old records.

Each visit should create a new historical record or a controlled revision.

A pet may have many clinical records.

## 3. Vaccination records

Store:

- vaccine
- date administered
- dose
- veterinarian
- pet weight at vaccination when applicable
- next vaccination schedule
- notes

## 4. Senior Vet permissions

Only Senior Vet can:

- create official clinical records
- edit official clinical records
- create/edit vaccination records
- change medical notes
- record official veterinarian information
- set next vaccination schedules
- set follow-up instructions

## 5. Staff permissions

Staff can:

- view permitted clinical records
- view vaccination information
- update pet weight
- perform operational actions

Staff cannot edit protected medical information.

## 6. Client permissions

Clients can:

- view their own pets
- view permitted clinical history
- view vaccination history
- view weight history

Clients cannot modify these official records.

## 7. Clinical workflow

After a visit:

Staff checks in
→ pet weighed
→ veterinary service
→ Senior Vet records clinical information
→ vaccination/treatment/follow-up recorded
→ visit history preserved

## 8. Security

Use strong Row Level Security and server-side authorization.

A Client must not be able to access another pet's record.

A Staff member must not be able to modify a clinical record through direct API calls or manipulated URLs.

## 9. Testing

Test:

- Senior Vet creates clinical record
- Senior Vet edits clinical record
- Staff can view but cannot edit
- Client can view own pet records
- Client cannot access another pet's records
- history is preserved
- vaccination records are preserved

STOP after Phase 6.

---

# PHASE 7 — POS SYSTEM

## Goal

Implement clinic point-of-sale functionality.

POS must integrate with:

- Client
- Pet
- Appointment/Visit
- Services
- Inventory
- Loyalty later

## 1. POS workflow

Select Client
→ select Pet where applicable
→ select service/product
→ add quantity
→ calculate subtotal
→ apply configured discount/reward if available
→ calculate total
→ record payment
→ complete transaction

## 2. POS items

Each line item should identify:

- item/service
- quantity
- unit price
- subtotal
- appropriate visit/appointment relationship

## 3. Transaction

Store:

- transaction number/reference
- client
- pet where appropriate
- date/time
- items
- subtotal
- discount
- reward
- final total
- payment details appropriate to the scope
- user who processed it
- source/visit where appropriate

## 4. Services

POS should support configured clinic services.

Examples:

- consultation
- vaccination
- grooming
- deworming
- wellness check

## 5. Products

POS should support inventory products where applicable.

## 6. Transaction status

Use appropriate transaction statuses such as:

- OPEN
- COMPLETED
- VOIDED where approved

Do not silently delete completed transactions.

## 7. Staff permissions

Staff can process POS transactions.

Senior Vet can also process POS.

Clients do not directly operate staff POS.

## 8. Testing

Test:

- service added
- product added
- quantity calculation
- subtotal
- total
- transaction saved
- client and pet association
- completed transaction remains in history

STOP after Phase 7.

---

# PHASE 8 — INVENTORY MANAGEMENT

## Goal

Implement practical veterinary inventory management.

## 1. Inventory products

Store:

- product name
- category
- unit
- current quantity
- minimum stock
- supplier
- cost/price where appropriate
- expiration date
- status
- active/inactive

## 2. Inventory transactions

Support:

- STOCK_IN
- STOCK_OUT
- ADJUSTMENT
- DAMAGED
- MISSING
- EXPIRED

Preserve transaction history.

## 3. Stock updates

Examples:

100 units
→ 10 sold/used
→ 90 remaining

A POS product sale should reduce appropriate inventory.

## 4. Low stock

Identify:

- LOW STOCK
- OUT OF STOCK

based on configured levels.

## 5. Expiration

Identify:

- NORMAL
- EXPIRING SOON
- EXPIRED

Use configurable or clearly defined logic.

## 6. Staff permissions

Staff can perform operational inventory functions appropriate to their role.

Senior Vet has full inventory authority.

## 7. Auditability

Important inventory adjustments should record:

- user
- time
- product
- quantity
- transaction type
- reason where appropriate

## 8. Testing

Test:

- stock-in
- stock-out
- POS inventory reduction
- low-stock detection
- expiry detection
- damaged item adjustment
- historical inventory transactions

STOP after Phase 8.

---

# PHASE 9 — DIGITAL 12-STAMP LOYALTY CARD AND REWARDS

## Goal

Implement the clinic's physical stamp-card concept digitally.

IMPORTANT:

This is NOT a points system.

It is a digital stamp card.

Default:

12 stamp positions.

The milestone and reward must be configurable by Senior Vet.

## 1. Loyalty program

Store appropriate configuration such as:

- program name
- stamp limit
- milestone
- eligible services
- reward
- reward status
- activation/deactivation
- validity where required

Default stamp count:

12

## 2. Stamp earning

An eligible completed service/visit can add one stamp.

The Senior Vet controls which services are eligible.

Example:

Grooming → 1 stamp
Consultation → 1 stamp
Vaccination → 1 stamp

Do not assume all services earn stamps.

## 3. Client display

Example:

● ● ● ● ● ● ● ● ○ ○ ○ ○

8 / 12 STAMPS

The Client should also see:

- stamps remaining
- current milestone
- unlocked reward
- redeemed rewards
- history

## 4. Reward configuration

Senior Vet can create/edit:

- reward name
- reward description
- reward type
- free service
- discount
- reward value
- active/inactive
- milestone

Examples:

12 stamps → Free Grooming

10 stamps → ₱200 discount

8 stamps → Free Deworming

Do not hard-code one permanent reward.

## 5. POS integration

When a valid reward exists:

POS can display:

REWARD AVAILABLE

Staff can redeem the reward when appropriate.

Record:

- reward used
- client
- transaction
- date
- user
- reward
- redemption status

## 6. Reset/continuation rule

Implement the loyalty cycle according to the configured business rule.

Do not erase historical stamps or redemption records.

## 7. Eligibility

Only eligible completed services should earn stamps.

Do not award a stamp merely because an appointment was created.

## 8. Testing

Test:

- eligible service earns stamp
- ineligible service does not
- 12-stamp milestone triggers configured reward
- reward appears in Client account
- Staff can redeem valid reward through POS
- reward redemption is recorded
- history remains available
- Senior Vet can change milestone/reward

STOP after Phase 9.

---

# PHASE 10 — ANALYTICS AND REPORTING

## Goal

Provide useful operational analytics without overcomplicating the system.

## 1. Customer analytics

Show:

- customers today
- this week
- this month
- this year

## 2. Appointment analytics

Show:

- appointments
- completed
- cancelled
- no-show
- pending
- confirmed
- checked in
- in consultation

## 3. Walk-in vs appointment

Show:

- appointment-based customers
- walk-in customers

This distinction must use actual stored source/type data.

## 4. Service analytics

Show:

- most availed services
- service transaction counts
- trends where useful

## 5. Sales analytics

Show:

- daily sales
- weekly sales
- monthly sales
- yearly sales

Use appropriate date filters.

## 6. Inventory analytics

Show:

- low stock
- out of stock
- expiring soon
- expired

## 7. Loyalty analytics

Show:

- stamps earned
- rewards unlocked
- rewards redeemed

## 8. Staff access

Staff:
- operational analytics appropriate to the system

Senior Vet:
- complete clinic analytics

## 9. Dashboard presentation

Use:

- cards
- charts
- tables
- filters

Provide:

- Today
- This Week
- This Month
- This Year
- Custom range where practical

Do not create misleading analytics.

Use actual database records.

## 10. Testing

Verify that creating appointments, transactions, services, walk-ins, and loyalty events changes analytics correctly.

STOP after Phase 10.

---

# PHASE 11 — IOT-ENABLED PET WEIGHING SYSTEM

## Goal

Integrate the physical pet weighing device.

The IoT feature must enhance the system without becoming a single point of failure.

## 1. Hardware concept

Expected conceptual architecture:

Pet platform
→ Load Cell
→ Load-cell amplifier/sensor
→ ESP32
→ Wi-Fi/network
→ web application
→ selected pet visit
→ weight record

## 2. Important identification rule

The scale does NOT need to identify the pet automatically.

The staff selects the pet first.

Workflow:

Staff selects Client
→ selects Pet
→ starts weighing
→ pet placed on scale
→ scale sends weight
→ system displays weight
→ staff confirms
→ weight saved

## 3. Weight source

Store:

- MANUAL
- IOT

for the weight source.

## 4. Weight history

Every confirmed weight should create a historical record containing:

- pet
- weight
- timestamp
- recorded by
- source
- visit/appointment when applicable

Do not overwrite previous weight history.

## 5. Manual fallback

If the device is:

- disconnected
- unavailable
- producing invalid readings
- unstable

allow:

ENTER WEIGHT MANUALLY

The rest of the clinic workflow must continue.

## 6. Weight stability

Prefer stable-weight detection.

Conceptual behavior:

pet steps on scale
→ readings fluctuate
→ wait
→ reading stabilizes
→ display stable weight
→ staff confirms
→ save

Do not automatically save the first unstable value.

## 7. Staff permissions

Staff can:

- obtain weight
- review weight
- correct weight if necessary
- save confirmed weight

Staff cannot modify protected medical records.

Senior Vet can also use the weighing feature.

## 8. Pet current weight

The latest confirmed weight can be displayed as current/latest weight while preserving full historical records.

## 9. Device connection status

Provide clear state such as:

CONNECTED
DISCONNECTED
READING
STABLE
ERROR

Do not let device errors break the page.

## 10. Testing

Test:

- device connects
- weight received
- stable reading displayed
- Staff confirms
- weight saved
- source recorded as IOT
- history preserved
- manual fallback works
- invalid reading does not silently overwrite valid data

If actual hardware is not yet available, implement and test the software interface with a safe simulated/mock reading path without pretending that a physical device is connected.

STOP after Phase 11.

---

# PHASE 12 — FULL USER MANAGEMENT, AUDIT LOGS, SECURITY HARDENING, AND FINAL QA

## Goal

Complete administration, auditing, and final security hardening across the whole system.

This is the final phase.

## PART A — USER MANAGEMENT

Senior Vet only.

Manage:

### Client accounts

- view
- search
- inspect status
- deactivate
- reactivate where appropriate
- edit permitted account fields

### Staff accounts

- create
- view
- edit
- deactivate
- reactivate

### Senior Vet accounts

Manage only with appropriate elevated authorization.

Do not provide public Staff/Senior Vet registration.

## PART B — ACCOUNT DEACTIVATION

Prefer deactivation rather than destructive deletion.

When an account becomes inactive:

- prevent protected application use
- preserve historical transactions
- preserve appointments
- preserve audit records
- preserve clinical associations where appropriate

## PART C — AUDIT LOGS

Implement a complete audit log for important changes.

Examples:

- user created
- user deactivated
- role changed by authorized administrator
- clinical record created
- clinical record edited
- vaccination record created/edited
- appointment slot changed
- appointment cancellation
- inventory adjustment
- loyalty configuration changed
- reward redeemed
- POS transaction completed/voided
- important security/admin actions

Store where appropriate:

- user
- action
- entity/table or record type
- record identifier
- timestamp
- relevant metadata

Do not store unnecessary sensitive data in logs.

## PART D — CLINICAL RECORD ACCOUNTABILITY

Verify:

- Senior Vet only can edit official clinical records
- Staff view-only
- Client view-only for own pets
- historical records preserved
- important edits auditable

## PART E — SECURITY AUDIT

Review the entire application.

Check:

### Authentication
- sessions are protected
- logout invalidates session access
- password reset is secure

### Authorization
- role checks are enforced server-side
- direct URL manipulation cannot bypass permissions
- direct API/data access cannot bypass permissions

### Database
- Row Level Security is correctly configured where appropriate
- foreign keys and constraints are correct
- clients cannot access other clients' rows
- unauthorized users cannot access protected data

### Secrets
- no secrets hard-coded
- environment variables used
- no accidental secret exposure in client-side bundles

### Forms and inputs
- validation exists
- invalid IDs are handled
- suspicious input does not break application logic

### File uploads
- if pet/staff images are uploaded, validate type/size and restrict access appropriately

### Appointments
- capacity cannot be bypassed
- race conditions are considered
- cancelled appointments cannot be improperly completed

### SMS
- duplicate reminders prevented
- provider failures logged
- credentials protected

### POS
- totals validated server-side
- completed transactions cannot be casually altered
- inventory linkage is correct

### Loyalty
- users cannot award themselves arbitrary rewards
- stamp earning follows configured rules
- redemption is audited

### IoT
- invalid readings do not corrupt records
- disconnected device does not break workflow

## PART F — ACCESS CONTROL MATRIX

Verify the final permission model.

CLIENT:

Can:
- public website
- own profile
- own pets
- own appointments
- own loyalty
- own permitted clinical records

Cannot:
- other clients
- staff management
- senior vet admin
- clinical editing
- inventory administration
- POS operation as staff
- audit logs

STAFF:

Can:
- operational dashboards
- appointments
- clients/pets view
- walk-ins
- weight recording/editing
- POS
- inventory
- analytics
- permitted operational actions

Cannot:
- protected clinical editing
- Senior Vet-only administration
- role promotion

SENIOR_VET:

Can:
- all authorized staff functions
- user management
- appointment configuration
- service management
- loyalty configuration
- clinical record editing
- vaccination record management
- inventory authority
- analytics
- audit logs
- administration

## PART G — FINAL FUNCTIONAL QA

Run end-to-end test scenarios.

### Scenario 1 — New Client

Create account
→ log in
→ register pet
→ view pet profile

### Scenario 2 — Appointment

Client
→ selects service
→ selects available date
→ selects available time
→ appointment created
→ capacity decreases

### Scenario 3 — Full Slot

Fill slot to capacity
→ slot becomes FULL
→ Client cannot select it
→ backend rejects any additional attempt

### Scenario 4 — Reminder

Appointment scheduled for next day
→ reminder job executes
→ SMS created
→ status stored

### Scenario 5 — Walk-In

Staff
→ finds Client
→ selects Pet
→ creates WALK_IN visit
→ visit appears in analytics

### Scenario 6 — Weight

Staff
→ selects Pet
→ weighs Pet
→ IoT weight appears
→ confirms
→ history saved

### Scenario 7 — Clinical Record

Senior Vet
→ opens visit
→ creates clinical record
→ vaccination recorded
→ follow-up date recorded
→ Client can view permitted information

### Scenario 8 — POS

Staff
→ selects Client/Pet
→ adds service/product
→ applies valid loyalty reward if available
→ completes transaction
→ inventory updates where applicable

### Scenario 9 — Loyalty

Eligible service completed
→ stamp earned
→ milestone reached
→ reward unlocked
→ reward redeemed
→ history preserved

### Scenario 10 — Security

Client attempts another client's data
→ denied

Staff attempts clinical edit
→ denied

Staff attempts Senior Vet page
→ denied

Inactive account attempts protected access
→ denied

## PART H — RESPONSIVE QA

Test:

- desktop
- tablet
- mobile

Verify:

- navigation
- forms
- tables
- dashboards
- appointments
- POS
- inventory
- client/pet views
- clinical records

Do not allow important information to become unusable on smaller screens.

## PART I — PERFORMANCE AND CLEANUP

Review:

- unnecessary queries
- repeated data fetching
- unused dependencies
- unused components
- dead code
- inconsistent naming
- unnecessary complexity
- obvious UI inconsistencies

Do not rewrite functioning architecture without reason.

## PART J — DEPLOYMENT READINESS

Prepare the application for thesis deployment.

Expected deployment architecture:

Next.js
→ Vercel

Supabase
→ Auth + PostgreSQL + Storage

SMS provider
→ appointment reminders

ESP32
→ IoT weight system

Verify that:

- environment variables are documented
- production URLs are configurable
- authentication redirects are configurable
- SMS credentials are not exposed
- Supabase configuration is documented
- required manual setup is documented

Remember:

Vercel's free/entry plan should be treated as a thesis/prototype deployment unless the clinic obtains an appropriate production plan and confirms commercial usage requirements.

## PART K — FINAL DOCUMENTATION

After final QA, produce documentation describing:

- system architecture
- user roles
- module overview
- database overview
- authentication
- authorization
- appointment workflow
- SMS workflow
- clinical record workflow
- POS workflow
- inventory workflow
- loyalty workflow
- analytics
- IoT architecture
- security controls
- deployment requirements
- known limitations
- future enhancements

Do not claim that hardware, SMS, or external services are production-ready unless actually tested.

STOP after the final phase.

---

# FINAL SYSTEM CHECKLIST

The project is considered functionally complete when all major areas below are present and tested.

## Public website

- [ ] Home
- [ ] Services
- [ ] About Us
- [ ] Meet Our Veterinary Team
- [ ] Book an Appointment
- [ ] Login
- [ ] Create Account
- [ ] Responsive navigation
- [ ] Placeholder content easily replaceable

## Client

- [ ] Registration
- [ ] Login
- [ ] Logout
- [ ] Profile
- [ ] My Pets
- [ ] Pet profiles
- [ ] Appointments
- [ ] Appointment history
- [ ] Clinical record viewing
- [ ] Vaccination viewing
- [ ] Weight history
- [ ] 12-stamp loyalty card
- [ ] Reward viewing
- [ ] Reward redemption visibility

## Staff

- [ ] Dashboard
- [ ] Today's appointments
- [ ] Walk-in creation
- [ ] Client search
- [ ] Pet selection
- [ ] Weight recording
- [ ] IoT weight support
- [ ] Manual weight fallback
- [ ] POS
- [ ] Inventory
- [ ] Analytics
- [ ] Appointment status management

## Senior Vet

- [ ] Dashboard
- [ ] User management
- [ ] Staff account management
- [ ] Appointment slot management
- [ ] Service management
- [ ] Clinical record management
- [ ] Vaccination record management
- [ ] Inventory authority
- [ ] POS
- [ ] Loyalty configuration
- [ ] Analytics
- [ ] Audit logs

## Appointment system

- [ ] Limited slots
- [ ] Configurable capacity
- [ ] Unavailable dates not clickable
- [ ] Full time slots not clickable
- [ ] Backend capacity validation
- [ ] Overbooking protection
- [ ] Walk-in support
- [ ] Appointment status workflow

## SMS

- [ ] One-day-before reminders
- [ ] Duplicate prevention
- [ ] SMS status
- [ ] Failed message tracking
- [ ] Rescheduling handling
- [ ] Cancellation handling

## Clinical

- [ ] Historical records
- [ ] Vaccination
- [ ] Follow-up
- [ ] Senior Vet-only editing
- [ ] Staff view-only
- [ ] Client own-pet view-only
- [ ] Auditability

## POS

- [ ] Services
- [ ] Products
- [ ] Client
- [ ] Pet
- [ ] Transaction totals
- [ ] Reward redemption
- [ ] Historical transactions

## Inventory

- [ ] Stock-in
- [ ] Stock-out
- [ ] Adjustments
- [ ] Damaged
- [ ] Missing
- [ ] Expired
- [ ] Low stock
- [ ] Expiry monitoring
- [ ] POS integration

## Loyalty

- [ ] Stamp based, not points based
- [ ] 12-stamp default
- [ ] Configurable milestone
- [ ] Configurable eligible services
- [ ] Configurable reward
- [ ] Reward redemption
- [ ] History preserved

## IoT

- [ ] ESP32
- [ ] Load cell
- [ ] Stable reading concept
- [ ] Automatic weight
- [ ] Manual fallback
- [ ] Weight history
- [ ] Device error handling

## Security

- [ ] Supabase Auth
- [ ] Role-based access control
- [ ] Server-side authorization
- [ ] Row Level Security
- [ ] Protected secrets
- [ ] Account deactivation
- [ ] Audit logs
- [ ] Historical data preservation

---

# FINAL LLM INSTRUCTION

You are assisting with a thesis-level Veterinary Clinic Management System.

Treat:

`PROJECT_SPECIFICATION.md`

as the permanent source of truth.

Treat this file as the phased implementation plan.

Always:

- inspect existing work first
- implement one phase at a time
- preserve existing functionality
- avoid unnecessary dependencies
- keep the system understandable
- validate important operations server-side
- enforce permissions securely
- test before declaring a phase complete
- stop after the current phase

Never:

- invent contradictory business rules
- silently change the tech stack
- skip security
- overwrite historical clinical data unnecessarily
- implement all phases at once
- expose secrets
- rely only on frontend permission checks
- assume the IoT device is always available

The desired final architecture is:

CLIENT / STAFF / SENIOR VET
            |
            v
     NEXT.JS WEB APPLICATION
            |
     TAILWIND CSS UI
            |
         SUPABASE
       /    |     \
     Auth  DB    Storage
            |
       PostgreSQL
            |
     +------+-------+--------+---------+
     |      |       |        |         |
Appointments Clinical  POS Inventory Loyalty
     |       Records
     |
    SMS
     |
Semaphore / SMS Provider

IoT side:

Pet Scale
    |
Load Cell
    |
Amplifier
    |
ESP32
    |
Wi-Fi
    |
Web Application
    |
Selected Pet / Visit
    |
Weight Record

The project should remain a clean, responsive, secure, thesis-friendly veterinary clinic management platform.
