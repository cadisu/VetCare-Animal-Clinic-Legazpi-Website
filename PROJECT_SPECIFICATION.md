# Veterinary Clinic Management System
# PROJECT SPECIFICATION

## 1. PROJECT OVERVIEW

This project is a **responsive web-based Veterinary Clinic Management System** intended for a veterinary clinic.

The system is designed to address operational pain points involving:

- Appointment scheduling
- Appointment capacity management
- Client convenience
- Pet information management
- Veterinary clinical records
- Vaccination records
- Pet weight recording
- IoT-enabled automatic pet weighing
- POS and checkout
- Inventory management
- Digital loyalty stamp cards
- SMS appointment reminders
- Clinic analytics
- User and role management
- Security and accountability

The system should allow clients to schedule appointments from home while helping clinic staff and Senior Vets manage daily clinic operations through one integrated platform.

The system must be responsive and usable on:

- Desktop
- Tablet
- Mobile

This is primarily a thesis/academic project, but the architecture should be practical enough to demonstrate a realistic veterinary clinic workflow.

---

# 2. PROJECT PURPOSE

The primary purpose is to improve the clinic's appointment process and reduce manual operational work.

The system should:

1. Allow clients to create accounts.
2. Allow clients to register and manage their own pets.
3. Allow clients to schedule veterinary services from home.
4. Prevent overbooking using configurable appointment capacity.
5. Automatically remind clients by SMS one day before an appointment.
6. Centralize pet and client information.
7. Maintain historical veterinary clinical records.
8. Allow only authorized Senior Vets to edit official clinical records.
9. Allow staff to handle walk-in customers.
10. Support POS transactions.
11. Manage clinic inventory.
12. Implement the clinic's stamp-card loyalty concept digitally.
13. Provide clinic analytics.
14. Integrate with an IoT weighing scale.
15. Maintain role-based access control.
16. Maintain important audit logs.
17. Preserve historical information rather than unnecessarily overwriting or deleting it.

The overall workflow should connect:

Appointment
→ Client
→ Pet
→ Visit
→ Weight
→ Clinical Record
→ Service
→ POS
→ Loyalty
→ Inventory
→ Analytics
→ SMS

---

# 3. TECHNOLOGY STACK

The selected stack is:

## Frontend / Full-stack framework
- Next.js

## Language
- TypeScript

## Styling
- Tailwind CSS

## Database
- Supabase PostgreSQL

## Authentication
- Supabase Authentication

## File storage
- Supabase Storage

## Hosting / deployment
- Vercel for the thesis prototype

## SMS
- Semaphore or another suitable SMS API for Philippine mobile numbers

## IoT hardware
- ESP32
- Load cell
- Appropriate load-cell amplifier/sensor module
- Physical weighing platform
- Wi-Fi/network communication

## Database design
Use a relational database.

Prefer PostgreSQL over MongoDB because the system contains highly related entities such as:

- Users
- Clients
- Pets
- Appointments
- Visits
- Clinical Records
- Vaccinations
- Weight Records
- Services
- Inventory
- POS Transactions
- Loyalty Records
- SMS Records
- Audit Logs

## Important technology rule

Do NOT use React Native.

This project is a web application, not a mobile application.

Do NOT use XAMPP as the application architecture.

A local environment may be used during development if needed, but the system architecture should be based on Next.js + Supabase.

---

# 4. USER ROLES

The system has exactly three primary roles:

1. CLIENT
2. STAFF
3. SENIOR_VET

## CLIENT

The customer/pet owner.

Main responsibilities:

- Register an account
- Manage own profile
- Register own pets
- Schedule appointments
- View appointments
- View own pets
- View permitted pet clinical information
- View vaccination information
- View weight history
- View digital loyalty stamp card
- View eligible rewards
- View own relevant history

## STAFF

Clinic receptionist / operational staff.

Main responsibilities:

- View daily appointments
- Manage appointment operations
- Create walk-in visits
- Search clients
- View pets
- Weigh pets
- Edit/confirm weight
- Process POS
- Manage inventory
- View analytics
- Perform other operational clinic functions

Staff must NOT:

- Edit official clinical records
- Edit vaccination records
- Edit official medical notes
- Change their own role
- Promote themselves to Senior Vet
- Access Senior Vet-only administration

## SENIOR_VET

Highest application authority.

Senior Vet responsibilities include:

- All appropriate Staff functions
- User management
- Staff account creation
- Appointment schedule configuration
- Appointment capacity configuration
- Service management
- Clinical record management
- Vaccination record management
- Loyalty configuration
- Inventory authority
- Analytics
- Audit log review
- Administrative settings

Only Senior Vet users may edit official veterinary clinical records.

---

# 5. PUBLIC WEBSITE

The system has a public-facing clinic website.

Visitors do NOT need to log in to access public pages.

Public pages:

1. Home
2. Services
3. About Us
4. Meet Our Veterinary Team
5. Book an Appointment
6. Login
7. Create Account

## Page naming

Use:

**Meet Our Veterinary Team**

for the page introducing clinic staff/veterinarians.

---

# 6. HOMEPAGE

The homepage should look like a real veterinary clinic landing page.

It should include:

## Hero section

- Temporary clinic name
- Short tagline
- Short clinic introduction
- Book an Appointment button
- View Services button

## About the Clinic

Short placeholder introduction.

## Featured Services

Examples:

- Veterinary Consultation
- Vaccination
- Grooming
- Deworming
- Wellness Check

## Why Choose Us

Possible placeholder items:

- Compassionate Care
- Experienced Veterinary Team
- Convenient Appointments
- Complete Pet Records

## Veterinary Team preview

Show several placeholder staff profiles.

## Clinic hours

Use placeholder information initially.

## Contact information

- Address
- Telephone/mobile number
- Email

## Footer

Include:

- Clinic name
- Navigation links
- Contact information
- Copyright placeholder

All placeholder content must be easy to replace later.

---

# 7. WEBSITE STYLE

Design should be:

- Clean
- Professional
- Modern
- Spacious
- Minimal
- Responsive
- Easy to navigate

Use generous whitespace.

Avoid:

- Excessive animation
- Excessive gradients
- Overly decorative interfaces
- Crowded dashboards
- Unnecessary complexity

## Brand colors

Primary:

`#584A99`

Secondary:

`#D82500`

Use neutral supporting colors where necessary.

---

# 8. CLIENT REGISTRATION

Clients should be able to create their own accounts.

Possible information:

- Full name
- Email
- Contact number
- Address
- Password
- Password confirmation

Only CLIENT accounts can be created publicly.

A visitor must NOT be allowed to choose:

- STAFF
- SENIOR_VET

during public registration.

Staff and Senior Vet accounts must be controlled by authorized administrators.

---

# 9. CLIENT PROFILE

A client can view/edit permitted personal information such as:

- Full name
- Contact number
- Email
- Address
- Other basic profile details

Clients must NOT be allowed to modify official:

- Clinical records
- Vaccination records
- Veterinarian notes
- Medical information
- Pet medical history

---

# 10. CLIENT DASHBOARD

The Client dashboard should provide a simple overview.

Suggested cards:

## Upcoming Appointment
- Pet
- Service
- Date
- Time
- Status

## My Pets
- Number of registered pets

## Loyalty
- Current stamp count
- Next milestone
- Available reward

## Recent Activity
- Recent appointments/services

The dashboard should also contain quick navigation.

---

# 11. CLIENT PET MANAGEMENT

Clients can register their own pets.

## Pet information

Possible fields:

- Pet name
- Species
- Breed
- Sex
- Birth date
- Age where appropriate
- Color
- Picture
- Owner
- Registration date
- Other relevant identifiers

Relationship:

**ONE CLIENT → MANY PETS**

A Client must only be able to access their own pets.

---

# 12. PET PROFILE

Each pet should have a detailed profile.

## Basic information

- Photo
- Name
- Species
- Breed
- Sex
- Birth date/age
- Color
- Owner
- Registration date

## Current/latest weight

Display the most recent confirmed weight.

## Weight history

Show historical records such as:

- Date/time
- Weight
- Recorded by
- Source

Source can be:

- MANUAL
- IOT

## Vaccination history

Display:

- Vaccine
- Date administered
- Dose
- Veterinarian
- Pet weight at vaccination if available
- Next schedule
- Notes

## Clinical history

Display historical veterinary visits/consultations.

Clients may view permitted records but cannot edit official clinical information.

---

# 13. APPOINTMENT SYSTEM

The appointment system is a major component.

Clients should be able to book appointments from home.

However, the system must NOT allow unlimited booking.

Appointment availability is controlled by the clinic.

Authorized Staff and Senior Vets can manage:

- Available dates
- Available time slots
- Maximum capacity
- Blocked dates
- Blocked time slots

---

# 14. APPOINTMENT CAPACITY

Each appointment slot has a capacity.

Example:

10:00 AM
Capacity = 3

If:
- 0 booked → 0/3
- 1 booked → 1/3
- 2 booked → 2/3
- 3 booked → FULL

A fourth booking must be rejected.

The capacity must be enforced by the backend/database, not only by the frontend.

This is important to prevent overbooking.

---

# 15. APPOINTMENT DATE BEHAVIOR

Unavailable dates should NOT be clickable.

Examples:

- Past dates
- Clinic closed
- No schedule configured
- Blocked dates
- Otherwise unavailable days

Available dates may be clicked.

The frontend should visually distinguish available and unavailable dates.

The backend must also verify that the selected date is valid.

---

# 16. APPOINTMENT TIME BEHAVIOR

Time slots should have states such as:

- AVAILABLE
- FULL
- BLOCKED
- UNAVAILABLE

Example:

10:00 AM — 2/3 booked — AVAILABLE

11:00 AM — 3/3 booked — FULL

12:00 PM — BLOCKED

1:00 PM — 0/3 booked — AVAILABLE

A FULL time slot must not be selectable.

The backend must independently validate availability.

---

# 17. APPOINTMENT BOOKING WORKFLOW

Client:

Select service
→ select date
→ select available time
→ select pet
→ confirm

System:

Checks date
→ checks capacity
→ checks validity
→ creates appointment
→ records status
→ confirms booking

The system must perform a final backend check at booking time.

It must account for simultaneous booking attempts so two clients cannot both take the final remaining slot.

---

# 18. APPOINTMENT SOURCE

Appointments should distinguish between:

- APPOINTMENT
- WALK_IN

This distinction is required for later analytics.

Staff and Senior Vet can create WALK_IN records.

---

# 19. APPOINTMENT STATUS

Use these statuses:

- PENDING
- CONFIRMED
- CHECKED_IN
- IN_CONSULTATION
- COMPLETED
- CANCELLED
- NO_SHOW

## Normal workflow

PENDING
→ CONFIRMED
→ CHECKED_IN
→ IN_CONSULTATION
→ COMPLETED

## Cancellation

PENDING/CONFIRMED
→ CANCELLED

## No-show

CONFIRMED
→ NO_SHOW

Status transitions should be controlled.

A cancelled appointment should not silently become completed.

---

# 20. STAFF APPOINTMENT MANAGEMENT

Staff can:

- View daily appointments
- Search/filter appointments
- Check in clients
- Update operational appointment status
- Create walk-ins
- View appointment details

Staff can manage capacity according to the final business rules approved for the project.

Senior Vets have the highest scheduling authority.

---

# 21. SENIOR VET APPOINTMENT MANAGEMENT

Senior Vet can:

- Configure clinic availability
- Configure dates
- Configure time slots
- Set capacity
- Block dates
- Block time slots
- Edit availability
- View appointment schedules

---

# 22. SMS APPOINTMENT REMINDERS

The system must automatically notify the client one day before the appointment.

Example:

Appointment:

October 10, 2026
2:00 PM

Reminder:

October 9, 2026

Example message:

"Good day! This is a reminder that [Pet Name] has a [Service] appointment at [Clinic Name] on [Date] at [Time]. Please contact us if you need to reschedule."

The actual message may be adjusted later.

---

# 23. SMS STATUS TRACKING

Every SMS reminder should have a recorded status.

Possible statuses:

- PENDING
- QUEUED
- SENT
- FAILED
- DELIVERED if supported
- CANCELLED if applicable

Store:

- Appointment
- Client
- Recipient phone number
- Message
- Created time
- Sent time
- Provider response/reference
- Status
- Error information where applicable

Do not simply send an SMS without recording its result.

---

# 24. SMS DUPLICATE PREVENTION

Do not send the same successful reminder repeatedly.

Before sending:

- Find eligible appointment
- Check appointment status
- Check reminder history
- Check whether a successful reminder already exists
- Send only when necessary

If appointment is:

- Cancelled
- Completed
- No-show

do not send the next-day reminder.

---

# 25. RESCHEDULED APPOINTMENTS

If an appointment is rescheduled:

- Use the updated date/time for future reminder logic.
- Prevent stale reminder messages from being sent.
- Preserve relevant historical information.

---

# 26. STAFF CLIENT MANAGEMENT

Staff should have a client page.

Staff can:

- Search clients
- View clients
- View pet ownership
- View relevant appointment history
- View relevant transaction information

Staff must not modify protected medical information.

---

# 27. CLIENT/PET VISIT WORKFLOW

When a client arrives:

Staff:

Search Client
→ select Pet
→ open/create current visit
→ weigh Pet
→ confirm weight
→ service/consultation
→ POS later

The Staff user can edit the weight if necessary.

Staff cannot edit official clinical information.

---

# 28. IOT WEIGHING SYSTEM

The system should integrate with a physical automatic pet weighing scale.

Yes, this is technically possible.

The device is not expected to identify the pet automatically.

The staff selects the pet first.

Then:

Staff selects Client
→ Staff selects Pet
→ starts weighing
→ pet placed on scale
→ scale measures weight
→ ESP32 sends weight
→ web application displays weight
→ staff confirms
→ weight is saved

---

# 29. IOT HARDWARE ARCHITECTURE

Conceptual architecture:

Pet platform
→ Load Cell
→ Load-cell Amplifier/Sensor
→ ESP32
→ Wi-Fi/network
→ Web application
→ Selected Pet/Visit
→ Weight Record

The final communication method may be refined during hardware development.

The website should not depend entirely on the IoT device.

---

# 30. MANUAL WEIGHT FALLBACK

The system must support:

1. IOT WEIGHT
2. MANUAL WEIGHT ENTRY

If the device is:

- disconnected
- unavailable
- malfunctioning
- unstable
- returning invalid data

the Staff can manually enter the weight.

The clinic workflow must continue.

---

# 31. WEIGHT STABILITY

Prefer stable readings rather than saving the first fluctuating value.

Conceptual workflow:

Pet steps on scale
→ readings fluctuate
→ system waits
→ reading stabilizes
→ stable weight displayed
→ staff confirms
→ record saved

Do not save unstable data automatically.

---

# 32. WEIGHT RECORD

Every confirmed weight should store:

- Pet
- Weight
- Date/time
- Recorded by
- Source
- Visit/appointment where applicable

Source:

- MANUAL
- IOT

The latest confirmed weight can be shown as current/latest weight.

Historical records must be preserved.

---

# 33. CLINICAL RECORDS

The system should maintain historical veterinary records.

A clinical record may contain:

- Pet
- Date
- Veterinarian
- Visit/appointment
- Reason for visit
- Clinical notes
- Assessment
- Treatment
- Follow-up
- Other appropriate veterinary information

---

# 34. CLINICAL RECORD PERMISSIONS

Only SENIOR_VET can edit official clinical records.

## Staff

Can:

- View permitted clinical information
- View vaccination information
- Update pet weight

Cannot:

- Edit medical notes
- Edit diagnosis/assessment
- Edit treatment information
- Edit vaccination records
- Edit veterinarian-entered medical history

## Client

Can:

- View permitted records for own pets

Cannot:

- Edit clinical records
- Edit vaccination records
- Edit official weight history
- Modify medical notes

---

# 35. CLINICAL HISTORY RULE

Do not overwrite an entire pet medical history when a new visit occurs.

Instead, add a new historical entry.

For example:

September 1 → consultation record

September 15 → vaccination record

October 1 → grooming/consultation record

All should remain available.

---

# 36. VACCINATION RECORDS

Store:

- Vaccine
- Date
- Dose
- Veterinarian
- Weight at vaccination if relevant
- Next schedule
- Notes

Senior Vet controls official vaccination records.

Clients may view their own pet's information.

Staff may view but not edit protected records.

---

# 37. POS SYSTEM

Staff and Senior Vets should have access to POS.

The POS should connect:

- Client
- Pet
- Service
- Product
- Visit/appointment where appropriate
- Loyalty
- Inventory

---

# 38. POS WORKFLOW

Select Client
→ Select Pet where appropriate
→ Select Service/Product
→ Add quantity
→ Calculate subtotal
→ Apply valid reward/discount where applicable
→ Calculate total
→ Record payment
→ Complete transaction

---

# 39. POS TRANSACTION INFORMATION

Store:

- Transaction/reference number
- Client
- Pet where applicable
- Date/time
- Items
- Quantity
- Unit price
- Subtotal
- Discount
- Reward
- Total
- Payment information appropriate to the thesis scope
- User who processed transaction
- Visit/appointment where appropriate

Do not silently delete completed transactions.

---

# 40. SERVICES

The system should support configurable clinic services.

Examples:

- Veterinary Consultation
- Vaccination
- Grooming
- Deworming
- Wellness Check
- Other clinic services

Service information may include:

- Name
- Description
- Price
- Duration
- Active/inactive
- Appointment availability
- Loyalty eligibility

Senior Vet should control service configuration.

---

# 41. INVENTORY SYSTEM

Inventory should track:

- Product name
- Category
- Quantity
- Unit
- Price/cost as appropriate
- Minimum stock
- Supplier
- Expiration date
- Status
- Active/inactive

---

# 42. INVENTORY TRANSACTIONS

Support:

- Stock In
- Stock Out
- Adjustment
- Damaged
- Missing
- Expired

Preserve transaction history.

---

# 43. INVENTORY ALERTS

Show:

- Low stock
- Out of stock
- Expiring soon
- Expired

Suggested states:

- NORMAL
- EXPIRING SOON
- EXPIRED

---

# 44. POS AND INVENTORY INTEGRATION

If a product is sold through POS:

Inventory quantity should be reduced appropriately.

Example:

Pet shampoo stock:
20

Sale:
1

New stock:
19

Record the inventory transaction.

---

# 45. DIGITAL LOYALTY SYSTEM

IMPORTANT:

The clinic uses a stamp-card concept, NOT a points system.

Implement a **digital loyalty stamp card**.

Default:

12 stamp positions.

Example:

● ● ● ● ● ● ● ● ○ ○ ○ ○

8 / 12 stamps

---

# 46. LOYALTY CONFIGURATION

The Senior Vet must be able to edit the loyalty program.

Senior Vet can configure:

- Program name
- Maximum stamp count
- Milestone
- Eligible services
- Reward name
- Reward description
- Reward type
- Reward value/free service
- Active/inactive
- Validity where applicable

Default milestone:

12 stamps

But the configuration should be editable.

---

# 47. LOYALTY ELIGIBILITY

Senior Vet determines which services earn stamps.

Example:

Grooming → 1 stamp

Consultation → 1 stamp

Vaccination → 1 stamp

Other service → configurable

Do not assume every transaction automatically earns a stamp.

---

# 48. LOYALTY REWARD EXAMPLES

Examples only:

12 stamps
→ FREE GROOMING

10 stamps
→ ₱200 DISCOUNT

8 stamps
→ FREE DEWORMING

The system must not hard-code a single reward.

---

# 49. LOYALTY STAMP WORKFLOW

After an eligible completed service:

- Check eligibility
- Add one stamp
- Store stamp history
- Check milestone
- Unlock reward if milestone reached

Only completed/qualifying visits/services should earn stamps according to configuration.

---

# 50. LOYALTY CLIENT VIEW

Client should see:

- Current stamp count
- Maximum stamps
- Stamps remaining
- Current milestone
- Available reward
- Reward status
- Redemption history

---

# 51. LOYALTY REDEMPTION

At POS:

If reward is valid:

Display:

REWARD AVAILABLE

Staff can redeem it according to configured rules.

Store:

- Client
- Reward
- Transaction
- Redemption date
- User
- Status

Do not erase historical redemption information.

---

# 52. LOYALTY HISTORY

Preserve:

- Stamps earned
- Service that earned stamp
- Date
- Staff/user
- Reward unlocked
- Reward redeemed
- Redemption date

---

# 53. ANALYTICS

The system should provide useful clinic analytics.

## Customer analytics

- Today
- This week
- This month
- This year

## Appointment analytics

- Total appointments
- Completed
- Cancelled
- No-show
- Pending
- Confirmed
- Checked in
- In consultation

## Customer source

Compare:

- Appointment-based
- Walk-in

## Service analytics

- Most availed service
- Service counts
- Trends

## Sales analytics

- Daily
- Weekly
- Monthly
- Yearly

## Inventory analytics

- Low stock
- Out of stock
- Expiring
- Expired

## Loyalty analytics

- Stamps earned
- Rewards unlocked
- Rewards redeemed

---

# 54. ANALYTICS FILTERS

Use filters such as:

- Today
- This Week
- This Month
- This Year
- Custom date range where practical

Generate analytics from real stored data.

Do not hard-code example values into final reports.

---

# 55. STAFF DASHBOARD

Staff dashboard should focus on daily operations.

Display:

- Appointments today
- Pending appointments
- Confirmed appointments
- Checked-in
- In consultation
- Completed
- Walk-ins

Quick actions:

- Appointments
- Walk-In
- Clients
- Pets
- POS
- Inventory

---

# 56. SENIOR VET DASHBOARD

Senior Vet dashboard should include Staff capabilities plus administrative/clinical summaries.

Possible sections:

- Today's appointments
- Clinic overview
- Revenue
- Services
- Walk-ins
- Inventory alerts
- Loyalty performance
- Administrative alerts

---

# 57. USER MANAGEMENT

Only Senior Vet can manage user accounts.

## Customers

Senior Vet can:

- View
- Search
- Edit permitted account information
- Deactivate
- Reactivate

## Staff

Senior Vet can:

- Create
- View
- Edit
- Deactivate
- Reactivate

## Senior Vet

Manage only under appropriate elevated authorization rules.

Public users cannot create Staff or Senior Vet accounts.

---

# 58. ACCOUNT DEACTIVATION

Use:

ACTIVE

INACTIVE

Prefer deactivation rather than destroying user records.

If Staff leaves:

Staff account
→ INACTIVE

Historical:

- Appointments
- Transactions
- Audit records
- Clinical associations where appropriate

should remain available.

---

# 59. SECURITY MODEL

The system must have role-based access control.

The permissions must be enforced:

- in application/server logic
- at the database level where appropriate

Do not rely only on frontend button visibility.

Examples:

A Staff user manually accessing:

`/senior-vet/users`

must be denied.

A Client attempting to access another Client's pet must be denied.

A Staff user attempting to edit a clinical record directly through an API must be denied.

---

# 60. SUPABASE SECURITY

Use:

- Supabase Auth
- PostgreSQL Row Level Security
- secure server-side checks
- environment variables

Do not trust user-submitted role values.

Do not allow users to promote themselves.

Do not expose secrets to the browser.

Validate IDs and ownership relationships on the server.

---

# 61. CLIENT DATA ACCESS

A Client may access only their own:

- Profile
- Pets
- Appointments
- Loyalty
- Permitted clinical information
- Relevant transaction information

A Client must not access another Client's records.

---

# 62. STAFF DATA ACCESS

Staff may access clinic operational data according to role permissions.

Staff may:

- view Clients
- view Pets
- process appointments
- create walk-ins
- record/edit weight
- process POS
- manage inventory
- view analytics

Staff may not edit protected medical records.

---

# 63. SENIOR VET DATA ACCESS

Senior Vet has the highest application authority and can access appropriate:

- Client management
- Staff management
- Appointments
- Services
- Clinical records
- Vaccinations
- Inventory
- POS
- Loyalty configuration
- Analytics
- Audit logs

---

# 64. AUDIT LOGS

Important actions should be auditable.

Examples:

- User created
- User deactivated
- Role changed by authorized administrator
- Clinical record created
- Clinical record edited
- Vaccination created/edited
- Appointment slot changed
- Inventory adjustment
- Loyalty configuration changed
- Reward redeemed
- Important administrative action

Log where appropriate:

- User
- Action
- Affected record/entity
- Timestamp
- Relevant metadata

Do not store unnecessary sensitive information in audit logs.

---

# 65. HISTORICAL DATA PRESERVATION

Do not simply overwrite historical data.

Examples:

Weights:

8.1 kg on one date

8.4 kg on another date

Keep both.

Clinical records:

Keep each visit.

Vaccinations:

Keep each vaccination.

Loyalty:

Keep stamp and redemption history.

Transactions:

Keep completed transaction history.

---

# 66. RESPONSIVE DESIGN

The application must support:

## Desktop
- full navigation
- dashboards
- tables
- charts

## Tablet
- responsive cards
- responsive tables
- usable forms

## Mobile
- responsive menu
- stacked cards
- touch-friendly buttons
- readable tables
- usable forms
- mobile appointment booking

Do not simply shrink desktop elements.

---

# 67. UI COMPONENTS

Use reusable patterns:

- Navbar
- Sidebar
- Dashboard cards
- Tables
- Search bars
- Filters
- Modals
- Confirmation dialogs
- Forms
- Date picker
- Calendar
- Status badges
- Toast notifications
- Loading states
- Empty states
- Error states
- Pagination where appropriate

---

# 68. ERROR HANDLING

Errors should be clear and understandable.

Examples:

"That appointment slot has just been filled. Please select another time."

"Unable to send SMS reminder. Please check the client's contact number."

"Only Senior Vets can modify this clinical record."

"Your account does not have permission to access this information."

"Unable to connect to the weighing device. You may enter the weight manually."

Do not expose unnecessary technical details to normal users.

---

# 69. LOADING STATES

Provide appropriate loading states for:

- Authentication/session checks
- Login
- Registration
- Appointment booking
- POS
- Inventory
- IoT connection/reading
- SMS status retrieval where appropriate

Do not display protected content before authorization is confirmed.

---

# 70. VALIDATION

Important forms should have frontend and backend validation.

Examples:

- Client registration
- Pet registration
- Appointment
- Appointment slot configuration
- Clinical record
- Vaccination
- Inventory
- POS
- Loyalty configuration
- User management

Do not rely only on frontend validation.

---

# 71. DATABASE CONCEPT

The final relational database should include appropriate entities such as:

- users/profiles
- clients
- staff where useful
- pets
- appointments
- appointment slots
- services
- visits
- clinical records
- vaccination records
- weight records
- inventory products
- inventory transactions
- POS transactions
- POS items
- loyalty programs
- loyalty stamps
- loyalty rewards
- loyalty redemptions
- SMS records
- audit logs

The exact normalization can be adjusted based on implementation quality.

Avoid unnecessary duplication.

---

# 72. IMPORTANT RELATIONSHIPS

Core relationships:

Client
→ Many Pets

Client
→ Many Appointments

Pet
→ Many Appointments

Pet
→ Many Clinical Records

Pet
→ Many Vaccination Records

Pet
→ Many Weight Records

Appointment
→ Client

Appointment
→ Pet

Appointment
→ Appointment Slot

Appointment
→ Service(s) as appropriate

Visit
→ Pet

Visit
→ Appointment where applicable

POS Transaction
→ Client

POS Transaction
→ Pet where applicable

POS Transaction
→ Items

Client
→ Loyalty records

Appointment
→ SMS Reminder

User
→ Audit Logs

---

# 73. SERVICE MANAGEMENT

Services should be configurable.

A service may contain:

- Name
- Description
- Price
- Duration
- Active/inactive
- Appointment availability
- Loyalty eligibility

Senior Vet manages services.

Clients see appropriate active services publicly.

---

# 74. INVENTORY AND EXPIRY

Inventory should support:

- Current stock
- Minimum stock
- Expiration date
- Expiring soon
- Expired

The clinic should be able to monitor inventory status easily.

---

# 75. WALK-IN MANAGEMENT

A Walk-In customer can be:

- Existing Client
- New Client
- Existing Pet
- New Pet

Staff should be able to search/select appropriately.

Walk-in source must be stored as:

`WALK_IN`

This is required for analytics.

---

# 76. APPOINTMENT SOURCE

Appointments should use a source such as:

`APPOINTMENT`

Walk-ins:

`WALK_IN`

This should be stored as actual data, not inferred later.

---

# 77. FULL END-TO-END CUSTOMER WORKFLOW

A normal client journey should be:

Client creates account
→ registers pet
→ books appointment
→ system confirms availability
→ appointment saved
→ one-day-before SMS sent
→ client arrives
→ Staff checks in
→ Staff selects pet
→ pet is weighed
→ weight confirmed
→ veterinary service occurs
→ Senior Vet records clinical information
→ POS checkout
→ eligible loyalty stamp added
→ reward checked
→ inventory updated where applicable
→ transaction completed
→ analytics updated
→ history preserved

---

# 78. EXAMPLE APPOINTMENT SCENARIO

Customer:

Maria Santos

Pet:

Bella

Species:

Dog

Service:

Grooming

Date:

October 10, 2026

Time:

2:00 PM

Capacity:

3

Existing bookings:

2/3

Maria books Bella.

System:

Creates appointment
→ status CONFIRMED

October 9:

Reminder created/sent.

SMS status:

SENT

October 10:

Maria arrives.

Staff:

CHECKED_IN

Staff:

Selects Bella.

Weight:

8.4 kg

Staff confirms.

Weight record created.

Grooming completed.

POS:

Grooming = ₱700

Loyalty:

If grooming is an eligible service:
→ one stamp added

If milestone reached:
→ reward unlocked

Transaction:

COMPLETED

Appointment:

COMPLETED

Analytics:

Updated

Historical data:

Preserved

---

# 79. LOYALTY EXAMPLE

Suppose the configured loyalty card is:

12 stamps

Reward:

Free Grooming

Client currently has:

8 / 12

Then after four qualifying completed services:

12 / 12

Reward:

Unlocked

At POS:

Staff sees:

Reward Available:
Free Grooming

When redeemed:

Redemption recorded.

Do not erase the history.

The exact milestone/reward can later be changed by Senior Vet.

---

# 80. IOT EXAMPLE

Staff:

Searches Maria Santos

→ selects Bella

→ starts weighing

Bella:

placed on scale

Load cell:

measures weight

ESP32:

receives/processes measurement

System:

receives 8.4 kg

UI:

shows 8.4 kg

Staff:

confirms

Database:

new weight record created

Source:

IOT

Historical weight data:

preserved

If scale fails:

Staff uses manual entry.

---

# 81. PUBLIC WEBSITE VS PORTALS

The project is one web application, not three separate websites.

There is:

## Public website

Accessible without login:

- Home
- Services
- About Us
- Meet Our Veterinary Team
- Book an Appointment
- Login
- Create Account

Then authenticated role portals:

## Client portal

Client Dashboard
→ Client features

## Staff portal

Staff Dashboard
→ Operational features

## Senior Vet portal

Senior Vet Dashboard
→ Administrative + clinical features

Use one Next.js application with role-based routing.

---

# 82. THESIS-FRIENDLY ARCHITECTURE

Conceptual architecture:

Client / Staff / Senior Vet
→ Next.js web application
→ Tailwind CSS
→ Supabase
→ PostgreSQL

Integrations:

Supabase/Application
→ SMS API
→ Client mobile phone

ESP32
→ weight sensor
→ network
→ application
→ selected pet visit
→ weight record

The architecture should remain understandable for thesis defense.

---

# 83. DEVELOPMENT PRIORITY

Recommended phase order:

Phase 1:
Public website foundation + authentication + roles

Phase 2:
Client and pet management

Phase 3:
Appointment scheduling and capacity

Phase 4:
Appointment statuses

Phase 5:
SMS reminders and status

Phase 6:
Clinical records and vaccination

Phase 7:
POS

Phase 8:
Inventory

Phase 9:
Digital loyalty stamp card

Phase 10:
Analytics

Phase 11:
IoT weighing integration

Phase 12:
User management + audit logs + final security + QA

---

# 84. WHAT SHOULD NOT BE ADDED WITHOUT EXPLICIT APPROVAL

Do not unnecessarily add:

- AI diagnosis
- online veterinary consultation
- chat system
- pet GPS
- face recognition
- automatic pet identification
- complicated accounting
- online medication delivery
- full payment gateway
- telemedicine
- excessive gamification
- unrelated modules

The current scope is already sufficient for a substantial thesis project.

---

# 85. VERCEL / DEPLOYMENT CONSIDERATION

Vercel is the planned hosting platform for the thesis prototype.

Use:

Next.js
→ Vercel

Supabase:
→ Auth
→ PostgreSQL
→ Storage

SMS provider:
→ reminders

ESP32:
→ IoT weight

The system should treat the Vercel free/entry-level deployment as an academic/thesis prototype unless the clinic later uses an appropriate production plan.

Production deployment should later consider:

- plan limitations
- data backups
- privacy requirements
- operational reliability
- SMS cost
- storage
- clinic usage volume

---

# 86. FINAL FUNCTIONAL REQUIREMENTS

The final system should support:

## Client

- Account registration
- Login
- Logout
- Profile
- Pets
- Appointments
- Appointment history
- Clinical record viewing
- Vaccination viewing
- Weight history
- Loyalty stamp card
- Reward visibility

## Staff

- Dashboard
- Appointments
- Walk-ins
- Clients
- Pets
- Weight
- POS
- Inventory
- Analytics

## Senior Vet

- Dashboard
- All appropriate Staff functions
- User management
- Appointment schedule management
- Service management
- Clinical records
- Vaccination records
- Loyalty management
- Inventory authority
- Analytics
- Audit logs

## System

- Appointment capacity
- Appointment status
- SMS reminders
- SMS status
- Role-based security
- Audit trail
- Historical data preservation
- IoT weight integration
- Manual fallback

---

# 87. FINAL PERMISSION SUMMARY

| Function | Client | Staff | Senior Vet |
|---|---:|---:|---:|
| Public website | YES | YES | YES |
| Register own account | YES | NO | NO |
| View own profile | YES | YES | YES |
| Edit own basic profile | YES | YES where permitted | YES |
| Book appointment | YES | YES | YES |
| Create walk-in | NO | YES | YES |
| View clinic clients | NO | YES | YES |
| View own pets | YES | YES | YES |
| Register own pet | YES | As authorized | YES |
| View clinical records | Own pets | YES | YES |
| Edit clinical records | NO | NO | YES |
| View vaccinations | Own pets | YES | YES |
| Edit vaccinations | NO | NO | YES |
| Record/edit weight | NO | YES | YES |
| Use POS | NO | YES | YES |
| Manage inventory | NO | YES | YES |
| Configure loyalty | NO | NO | YES |
| Redeem loyalty reward at POS | NO | YES | YES |
| View analytics | Limited/own where applicable | YES | YES |
| Manage users | NO | NO | YES |
| Manage appointment slots | NO | YES where permitted | YES |
| View audit logs | NO | NO | YES |

---

# 88. FINAL NON-FUNCTIONAL REQUIREMENTS

The system should be:

- Responsive
- Secure
- Maintainable
- Modular
- Understandable
- Reliable
- Usable
- Consistent
- Thesis-friendly

Performance should be reasonable for normal clinic usage.

The interface should remain usable on common desktop and mobile screen sizes.

---

# 89. FINAL SOURCE-OF-TRUTH RULE

This file defines **WHAT the system is supposed to do**.

The implementation phases document defines **HOW and WHEN to build it**.

When implementing a phase:

1. Read this specification.
2. Read the implementation-phase document.
3. Follow the current phase only.
4. Preserve the business rules.
5. Ask for clarification only when absolutely necessary; otherwise make reasonable implementation choices without changing the requirements.
6. Do not implement later phases prematurely.

The final system should be one coherent Veterinary Clinic Management System, not unrelated mini-projects.

