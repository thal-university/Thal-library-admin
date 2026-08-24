# Supabase setup

## 1. Environment

Add the service role key to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# Optional. Signs the admin session cookie.
# Falls back to SUPABASE_SERVICE_ROLE_KEY when unset.
SESSION_SECRET=...
```

Find it in **Supabase Dashboard → Project Settings → API → `service_role` secret**.

It has **no `NEXT_PUBLIC_` prefix on purpose** — that keeps it server-side only.
It is read exclusively by `lib/supabaseAdmin.js`, which is imported only from
`app/api/**` route handlers. It must never be imported into a `'use client'`
file, and it must never be committed (`.env.local` is already gitignored).

The service role key bypasses row level security. That is what fixes
*"new row violates row-level security policy for table reservations"* — the
admin panel authenticates against the custom `public.users` table and has no
Supabase auth session, so `auth.uid()` is `NULL` and the mobile app's RLS
policies reject its writes. Routing admin writes through the server with this
key sidesteps RLS without loosening any policy the mobile app depends on.

## 2. Migrations

Run these in the Supabase SQL editor, in order. Both are idempotent.

| File | What it does |
| --- | --- |
| `01_reservation_loan_columns.sql` | Adds `issue_date`, `return_date`, `fine_amount`, `fine_paid` to `reservations`, backfills existing confirmed loans, adds lookup indexes. |
| `02_library_settings.sql` | Creates the single-row `library_settings` table (`fine_per_day`, `currency`), seeds it, adds a touch trigger and a public read policy. Re-run it to drop the old `loan_period_days` / `grace_period_days` columns. |

Nothing is added to `public.books` — issue and due dates belong to a
reservation, not to a book record.

There is no configurable loan period or grace period. The admin picks the due
date on each reservation, and the fine is worked out dynamically: every day
past that due date costs `fine_per_day`, counted to the return date once the
book is back and to today while it is still out.

`reservations.status` already permits `pending`, `confirmed`, `returned` and
`deleted` in your schema, so no constraint change is needed.

## 3. Admin API routes

All admin writes to `reservations` and `library_settings` go through these
server routes:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Verify an admin against `public.users` and set the session cookie. |
| `/api/auth/logout` | `POST` | Clear the session cookie. |
| `/api/account` | `GET` / `PATCH` | Read the signed-in admin's record; change their username or password. |
| `/api/reservations` | `GET` | List reservations (`?scope=active\|archived\|all`), each with its book attached. |
| `/api/people` | `GET` | Borrower lookup (`?role=student\|teacher&q=`) across `profiles` and `faculty_directory`. |
| `/api/records` | `POST` | Every reservation a given person has ever made. |
| `/api/reservations` | `POST` | Create a reservation (search & reserve, allocate a book). Sets the book to `Allocated`. |
| `/api/reservations/[id]` | `PATCH` | `confirm`, `return`, `cancel`, or `mark-fine-paid`. |
| `/api/reservations/[id]` | `DELETE` | Remove a pending reservation and free the book. |
| `/api/reservations/cleanup` | `POST` | Sweep pending reservations nobody collected. |
| `/api/settings` | `GET` / `PUT` | Read and save the fine / loan settings. |

Every route above except `/api/auth/login` and `/api/auth/logout` requires the
session cookie and returns `401` without it.

### Which tables the anon key can actually read

Only `books`. `users`, `reservations`, `profiles` and `faculty_directory` all
have row level security enabled with no policy for the `anon` role, so the
browser reads **zero rows** from them — silently, with no error. Every read of
those four therefore runs through the server routes above. Book search is the
one thing still queried directly from the client.

If you ever add anon read policies for those tables, these routes keep working
unchanged; they would just stop being strictly necessary.

## 4. Why login and the record lookups moved to the server

`public.users` has row level security enabled with no policy for the `anon`
role, so the browser reads **zero rows** from it. The old login queried `users`
directly from the client, matched nothing, and `.single()` turned that into
`PGRST116 — "The result contains 0 rows"`, surfacing as `Database error: {}`
(a `PostgrestError`'s `message` is non-enumerable, so the Next overlay prints
an empty object).

Authenticating in `/api/auth/login` with the service role key fixes that, and
along the way stops sending the password as a URL query filter and stops
returning the stored password to the browser.

## Known gap: passwords are stored in plain text

`public.users.password` holds the password as-is, so anyone who can read that
table with the service role key can read every admin password. Hashing them
(bcrypt/argon2) means a one-off migration of the existing rows plus a change to
whatever else writes that table. Worth doing — ask when you want it.
