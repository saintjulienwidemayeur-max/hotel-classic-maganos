# Magaños Classic Plaza Hotel - Guest & Stay Manager

A lightweight, secure front-desk web app: register guests, check them in and out, search every stay in seconds, and see the day at a glance. Built with **Next.js (App Router) + React + Tailwind CSS**, backed by **Supabase (PostgreSQL + Auth)**.

## Who does what

Two ways in, each opened by its own 4-digit code:

| | **Reception** | **Administrator** |
| --- | --- | --- |
| Screens | **New check-in** and the **Stays** list (check out, cancel, edit) | Overview, Stays, Rooms & rates, Reports, Guest directory, Settings |
| Registers arrivals | yes | **no** (the check-in screen is not shown to the administrator) |
| Sets prices | no | yes - nightly **and** short-stay rate, per room |
| Language | **always French** | French **or** English (FR/EN switch) |

## Features

| Area | What it does |
| --- | --- |
| **Register a stay** | One form for guest details (name, phone, email, ID/passport, address) and stay details (room, rate, check-in, expected check-out, price, payment status). Live total. Returning guests are matched by ID number. |
| **Rates** | A stay is billed either **per night** (price x nights) or as a **short stay** (one flat price, whatever the length). Choosing the rate fills in the room's standard price, and a short stay proposes a check-out 3 hours later. |
| **Rooms** | Exactly two room types: **single** and **double**. Each room has a nightly rate and a short-stay rate, both set by the administrator. |
| **Stays database** | Every active, pending, checked-out and cancelled stay, with status and payment badges. Table on desktop, cards on phones. Paginated. |
| **Search & filter** | Type a name, room number, phone or ID number - results update as you type (accent-insensitive: "Jose" finds "José"). Status tabs narrow the list. |
| **Overview (admin)** | Guests in house, rooms available, check-outs today (with overdue count), total stays, plus worklists for guests due out and upcoming arrivals. |
| **Reports (admin)** | Pick a period: billed total, occupancy, average nightly rate, **short stays**, check-ins/outs, billing by payment status, occupancy per room type, day-by-day table, and unpaid / part-paid stays. **Download as PDF or CSV.** |
| **Guest directory (admin)** | Every guest with phone, ID, number of stays, total billed and last visit. **Searchable by name**, phone, ID or email. |
| **Settings (admin)** | Change the **administrator code** and the **reception code** from inside the app, and switch the administration language. |

## Tech stack

- Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript
- Tailwind CSS 3, system fonts only (no font downloads, fast first paint)
- Supabase: PostgreSQL, Auth, Row Level Security
- zod for input validation
- PDF reports come from `src/lib/pdf.ts` - nothing extra to install

## Project structure

```
supabase/migrations/          Schema, views, functions, RLS, sample rooms, short stay + settings
middleware.ts                 Session refresh + redirect to /login
src/
  app/
    login/                    Access-code screen and its Server Actions
    (app)/
      dashboard/              Overview (administrator)
      stays/                  List + search, new check-in, edit, stay Server Actions
      rooms/                  Room board and rates (administrator)
      reports/                Reports + export/ (CSV) + export/pdf/ (PDF)
      guests/                 Guest directory (administrator)
      settings/               Access codes and language (administrator)
  components/
    layout/                   Sidebar, mobile header, bottom tabs, language switch
    stays/, rooms/, reports/, settings/, ui/
  lib/
    i18n.ts, lang.ts          French / English messages and the current language
    access.ts                 Access codes: env fallback, hashing, role matching
    pdf.ts                    Small PDF writer used by the report export
    validation.ts             zod schemas (built per language)
    datetime.ts, format.ts, report-range.ts, csv.ts, search.ts, db-errors.ts
```

## How access works

The browser only ever sends 4 digits. The **server** checks them and signs in to the matching Supabase account with credentials kept in server-only environment variables. The Supabase session is a normal one, so Row Level Security still decides what each role may read or change.

Where a code lives:

1. `.env.local` (`RECEPTION_PIN`, `ADMIN_PIN`) is the code the app starts with.
2. As soon as the administrator changes a code on **Settings**, a salted hash of the new code is stored in the database (`app_settings`) and the value in `.env.local` is **ignored for that role**. Only the hash is stored: a code can never be read back, only replaced.

Extra protection: 5 wrong codes in 15 minutes lock that device out (25 across all devices locks everyone briefly), the administrator session locks itself after 10 idle minutes (`ADMIN_IDLE_MINUTES`), and every screen has a **Lock** button.

> **Be honest about 4-digit codes.** There are only 10,000 of them. The lockout slows guessing down but cannot protect an obvious code, which is why Settings refuses `0000`, `1234` and friends. Change `ADMIN_PIN` before the app is reachable from the internet - it also protects guests' ID and passport numbers.

## Setup

You need **Node.js 20+** and a free [Supabase](https://supabase.com) account.

### 1. Create the Supabase project
Create a new project and wait for it to finish provisioning.

### 2. Create the database
Open **SQL Editor** and run the files in `supabase/migrations/` **in this order**:

1. `20260918000001_schema.sql` - tables, constraints, indexes
2. `20260918000002_views_and_functions.sql` - search view, room status view, dashboard function
3. `20260918000003_auth_and_rls.sql` - staff profiles and security policies
4. `20260919000005_reports.sql` - report functions and the guest directory
5. `20260920000006_short_stay_and_settings.sql` - **two room types**, short-stay rates, rebuilt reports, and the `app_settings` table behind the Settings screen
6. `20260918000004_seed_sample_rooms.sql` - *optional* sample rooms; run it **after** step 5, or skip it and add rooms in the app

Prefer the CLI? `supabase link --project-ref <ref>` then `supabase db push`.

### 3. Lock down sign-ups (important)
Go to **Authentication -> Sign In / Providers -> Email** and switch **off** "Allow new users to sign up".

### 4. Create the two accounts behind the codes
In **Authentication -> Users -> Add user -> Create new user**, tick **Auto Confirm User**, and create:

1. **The administrator account FIRST**: an email you control (for example `yourname+admin@gmail.com`) with the password from `ADMIN_PASSWORD` in `.env.local`.
2. **The reception account SECOND**: another email you control, with the password from `RECEPTION_PASSWORD`.

Then type those two emails into `.env.local` as `ADMIN_EMAIL` and `RECEPTION_EMAIL`. Order matters: the **first** account created becomes the administrator; the app refuses a code whose account has the wrong role.

### 5. Configure the app
In `.env.local` (a fresh checkout: `cp .env.example .env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - **Project Settings -> API**; the anon or *publishable* key. **Never** put the secret / `service_role` key in this app.
- `NEXT_PUBLIC_HOTEL_TIMEZONE` - the hotel's IANA time zone (e.g. `America/Port-au-Prince`).
- `NEXT_PUBLIC_CURRENCY` - ISO currency code for prices (`USD`, `HTG`, `DOP`, ...).
- `RECEPTION_PIN`, `ADMIN_PIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RECEPTION_EMAIL`, `RECEPTION_PASSWORD` - see above.
- `PIN_PEPPER` - a long random string mixed into the hash of any code changed inside the app. **Set it once and never change it**; changing it makes codes stored in the app unusable and the `.env.local` codes take over again. Empty means `ADMIN_PASSWORD` is used instead.

None of these have the `NEXT_PUBLIC_` prefix, so they never reach the browser.

### 6. Run it
```bash
npm install
npm run dev
```
Open <http://localhost:3000> and enter a code. For a production check: `npm run build && npm start`.

## Managing access

- **Change a code, day to day**: sign in as administrator, open **Settings**, type the new code twice. It applies immediately, on every device.
- **Change the starting codes**: edit `RECEPTION_PIN` / `ADMIN_PIN` in `.env.local` and restart (used only for a role whose code has not been changed in the app).
- **Go back to the `.env.local` code** for a role:
  ```sql
  delete from public.app_settings where key = 'admin_pin_hash';      -- or 'reception_pin_hash'
  ```
- **Turn someone's access off immediately**:
  ```sql
  update public.profiles set is_active = false
  where id = (select id from auth.users where email = 'your-reception-account@example.com');
  ```

## How stays work

- **Pending** - a booking whose check-in time is still in the future. Reception uses **Check in** when the guest arrives (the time moves up to "now" if they come early), or **Cancel**.
- **Active** - the guest is in the hotel. **Check out** stamps the current time.
- **Checked out / Cancelled** - kept forever. Guests and stays cannot be deleted from the app; this protects the audit trail. Use **Edit -> Stay status** to fix a mistake.
- **Room rules enforced by the database**, not just the UI: a room can hold only one active guest, and bookings for the same room cannot overlap (check-out and the next check-in may share the same minute).
- **Prices are copied onto each stay**, so changing a room's rate later never rewrites past bills:
  - per night: whole 24-hour blocks between check-in and expected check-out (minimum 1) x price
  - short stay: the flat price, once, whatever the length

## Language

- Reception screens and the code screen are **always French**.
- The administrator switches between **French and English** with the FR/EN buttons (sidebar, mobile top bar, or Settings). The choice is kept in a cookie, and dates and money follow it.
- All messages live in `src/lib/i18n.ts`; a third language means adding one block there.

## Reports

- **PDF** (`/reports/export/pdf`): headline figures, billing by payment status, room types, day by day, and the stays in the period, with repeated table headers and page numbers.
- **CSV** (`/reports/export`): every stay that checked in during the period, including its rate kind. Spreadsheet formulas in guest-typed text are neutralised.
- Both are administrator-only (403 for reception, even if they guess the address) and sent with `Cache-Control: no-store`.

## Security notes

- The session token lives in an **HTTP-only** cookie; the browser never talks to Supabase directly.
- Every table has **Row Level Security**: signed-out visitors get nothing, staff need an *active* profile, only administrators change rooms, rates and settings, and nobody can delete guests or stays. The report functions refuse non-administrators inside the database (error `42501`).
- Access codes changed in the app are stored only as `sha-256(PIN_PEPPER : code)`. The sign-in screen asks the database *which role a hash belongs to*; it can never read a hash out, and a hash cannot be produced without the server-only pepper.
- Codes are compared in constant time and wrong attempts are rate-limited.
- All input is validated on the server (zod), and search text is escaped before it reaches the database.
- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) are set in `next.config.mjs`. Serve the app over **HTTPS** outside `localhost`.

## Deploying

Vercel works out of the box: import the repository, add **all** the environment variables from `.env.example` (including `PIN_PEPPER`), deploy, then add the deployed URL under **Authentication -> URL Configuration** in Supabase. `NEXT_PUBLIC_*` values are baked in at **build** time, so rebuild after changing any of them. The wrong-code counter lives in each server instance's memory, so lockout is best effort on serverless hosting (exact on a single Node process such as `npm start` on a hotel PC).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Missing Supabase settings" | `.env.local` is missing, or the dev server was not restarted after editing it. |
| "Impossible de joindre le service de connexion" | The server cannot reach Supabase: check `NEXT_PUBLIC_SUPABASE_URL`, the connection, and the project status (free projects pause after inactivity). |
| "L'accès n'est pas encore configuré" | One of the six access settings in `.env.local` is empty or malformed. `npm run dev` lists which. |
| "Le code est bon, mais son compte n'existe pas encore" | Step 4: the account does not exist, the email differs from `.env.local`, or its password differs. |
| "...son compte n'a pas le bon rôle" | Accounts created in the wrong order: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'ADMIN_EMAIL_HERE');` and the same with `'staff'` for the reception email. |
| A code changed in Settings stopped working | `PIN_PEPPER` changed (or `ADMIN_PASSWORD`, if the pepper is empty). Delete that row in `app_settings` (see "Managing access") and set the code again. |
| "Trop de codes incorrects" | Wait for the time shown (up to 15 minutes), or restart the app to clear the counters. |
| "permission denied for view/table" after signing in | Migration 3 did not finish. Re-run it. |
| Report numbers or room types look wrong | Migration 6 was not run, or was run before migration 5. Run them in the order above. |
| Times are off by hours | `NEXT_PUBLIC_HOTEL_TIMEZONE` is not set to the hotel's zone. |

## What was tested in this build

- Migrations 1-6 were reviewed together; migration 6 rebuilds every view and report function that depends on the room-type enum or on the billing formula.
- The PDF writer was run end to end: multi-page output with repeated table headers, page numbers and French accents, checked by opening the generated file in a PDF reader.
- **Not done here:** `npm install` was not available in this environment, so `tsc --noEmit` and `next build` have not been re-run since these changes, and nothing was checked against a live Supabase project. Run `npm install && npm run typecheck && npm run build`, then click through the screens once on a phone and a desktop before going live.
