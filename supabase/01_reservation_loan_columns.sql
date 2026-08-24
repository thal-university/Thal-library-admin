-- ============================================================================
-- Migration 01 : Loan tracking on reservations
-- Thal University Library System
--
-- Adds the issue date / return date / fine columns that the admin panel needs.
-- `due_date` already exists on public.reservations, so it is left alone.
-- Nothing is added to public.books -- a loan belongs to a reservation, not to
-- the book record.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New columns
-- ----------------------------------------------------------------------------
alter table public.reservations
  add column if not exists issue_date  date,
  add column if not exists return_date date,
  add column if not exists fine_amount numeric(10, 2) not null default 0,
  add column if not exists fine_paid   boolean        not null default false;

comment on column public.reservations.issue_date  is 'Date the book was handed over to the reserver.';
comment on column public.reservations.due_date    is 'Date the book must be returned by.';
comment on column public.reservations.return_date is 'Date the book was actually returned.';
comment on column public.reservations.fine_amount is 'Fine charged for a late return.';
comment on column public.reservations.fine_paid   is 'Whether that fine has been collected.';

-- ----------------------------------------------------------------------------
-- 2. Backfill existing confirmed loans so no row shows a blank issue date.
--    Uses the row's own confirmation timestamp, with a 14 day default period.
-- ----------------------------------------------------------------------------
update public.reservations
set issue_date = coalesce(issue_date, updated_at::date),
    due_date   = coalesce(due_date, (updated_at::date + interval '14 days')::date)
where status = 'confirmed'
  and (issue_date is null or due_date is null);

-- ----------------------------------------------------------------------------
-- 3. Indexes used by the reservations list and the complete-record page
-- ----------------------------------------------------------------------------
create index if not exists idx_reservations_due_date    on public.reservations (due_date);
create index if not exists idx_reservations_issue_date  on public.reservations (issue_date);
create index if not exists idx_reservations_reserver_id on public.reservations (reserver_id);
create index if not exists idx_reservations_status      on public.reservations (status);
create index if not exists idx_reservations_user_id     on public.reservations (user_id);

-- ----------------------------------------------------------------------------
-- 4. Book lookups from the admin "search & reserve" flow
-- ----------------------------------------------------------------------------
create index if not exists idx_books_sr_no  on public.books (sr_no);
create index if not exists idx_books_status on public.books (status);
