-- ============================================================================
-- Migration 02 : Library settings (fine per day)
-- Thal University Library System
--
-- A single-row table the admin edits from Settings. The mobile app can read it
-- to show borrowers the current fine rate.
--
-- The fine is worked out dynamically: once a reservation passes its due date,
-- every further day costs `fine_per_day`. There is no loan period and no grace
-- period -- the admin picks the due date on each reservation, and the fine
-- starts the day after it.
--
-- Writes go through the admin API routes, which use the service role key and
-- therefore bypass RLS -- so only a read policy is needed here.
--
-- Idempotent: safe to run more than once. Re-running it also drops the
-- loan_period_days / grace_period_days columns if an earlier version created
-- them.
-- ============================================================================

create table if not exists public.library_settings (
  id           integer primary key default 1,
  fine_per_day numeric(10, 2) not null default 10.00,
  currency     text           not null default 'PKR',
  updated_at   timestamp with time zone not null default now(),
  constraint library_settings_singleton     check (id = 1),
  constraint library_settings_fine_positive check (fine_per_day >= 0)
);

-- Retire the configurable loan / grace periods.
alter table public.library_settings
  drop column if exists loan_period_days,
  drop column if exists grace_period_days;

alter table public.library_settings
  drop constraint if exists library_settings_loan_positive,
  drop constraint if exists library_settings_grace_positive;

comment on table  public.library_settings              is 'Single-row table holding library-wide configuration.';
comment on column public.library_settings.fine_per_day is 'Amount charged for each day a book is kept past its due date.';

-- Seed the single row.
insert into public.library_settings (id, fine_per_day)
values (1, 10.00)
on conflict (id) do nothing;

-- Keep updated_at fresh on every write.
create or replace function public.library_settings_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_library_settings_touch on public.library_settings;
create trigger trg_library_settings_touch
  before update on public.library_settings
  for each row execute function public.library_settings_touch();

-- ----------------------------------------------------------------------------
-- Row level security: anyone may read the fine rate, nobody may write it with
-- the anon key. The admin panel writes it via the service role key.
-- ----------------------------------------------------------------------------
alter table public.library_settings enable row level security;

drop policy if exists "library_settings_read" on public.library_settings;

create policy "library_settings_read"
  on public.library_settings for select
  to anon, authenticated
  using (true);
