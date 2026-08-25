-- ============================================================================
-- Migration 03 : Fine payment trail
-- Thal University Library System
--
-- `fine_paid` on its own only says *whether* a fine was settled, not *when*.
-- The Fine Records page collects payments after the book is already back, so
-- the collection date is not the return date and cannot be derived from it.
--
-- `updated_at` is no substitute: any later edit to the row overwrites it.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.reservations
  add column if not exists fine_paid_at date;

comment on column public.reservations.fine_paid_at is 'Date the fine was collected. Null while it is outstanding.';

-- Backfill rows already marked paid so none shows a blank collection date.
-- The return date is the best estimate: fines used to be settled at the counter
-- as the book came back.
update public.reservations
set fine_paid_at = return_date
where fine_paid is true
  and fine_amount > 0
  and fine_paid_at is null
  and return_date is not null;

-- The Fine Records page lists every row that carries a fine.
create index if not exists idx_reservations_fine_amount on public.reservations (fine_amount)
  where fine_amount > 0;
