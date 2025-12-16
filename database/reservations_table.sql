-- Reservations Table for Thal University Library System
-- This table stores book reservation requests from the mobile application

create table public.reservations (
  id serial not null,
  reserver_id character varying(100) not null,
  reserver_role character varying(20) not null check (reserver_role in ('student', 'teacher')),
  reserver_name character varying(200) not null,
  book_id uuid not null,
  book_name character varying(500) not null,
  status character varying(20) not null default 'pending' check (status in ('pending', 'confirmed', 'deleted')),
  reservation_date timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reservations_pkey primary key (id),
  constraint reservations_book_id_fkey foreign key (book_id) references books(id) on delete cascade
) tablespace pg_default;

-- Index for faster queries on status
create index idx_reservations_status on public.reservations(status);

-- Index for faster queries on book_id
create index idx_reservations_book_id on public.reservations(book_id);

-- Index for faster queries on reserver_id
create index idx_reservations_reserver_id on public.reservations(reserver_id);

-- Index for faster queries on reservation_date (for auto-deletion logic)
create index idx_reservations_reservation_date on public.reservations(reservation_date);
