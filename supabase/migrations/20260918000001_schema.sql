-- =============================================================================
-- Magaños Classic Plaza Hotel - core schema
-- Run order: 0001 (this file) -> 0002 views/functions -> 0003 auth & RLS
-- =============================================================================

-- Extensions live in the "extensions" schema (Supabase convention).
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions; -- lets us combine "=" and range "&&" in one exclusion constraint
create extension if not exists unaccent  with schema extensions; -- accent-insensitive search (José = Jose)

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
create type public.staff_role     as enum ('admin', 'staff');
create type public.room_type      as enum ('single', 'double', 'twin', 'deluxe', 'suite', 'family');
create type public.stay_status    as enum ('pending', 'active', 'checked_out', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partial', 'paid');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per staff login (linked to Supabase Auth)
-- Created automatically by a trigger in migration 0003.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       public.staff_role not null default 'staff',
  is_active  boolean not null default true,   -- set to false to revoke access without deleting history
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- rooms: the hotel's inventory
-- -----------------------------------------------------------------------------
create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  room_number     text not null,
  room_type       public.room_type not null default 'double',
  price_per_night numeric(10, 2) not null default 0 check (price_per_night >= 0), -- default rate; each stay stores its own copy
  is_active       boolean not null default true,                                   -- false = out of service
  created_at      timestamptz not null default now(),
  constraint rooms_room_number_key unique (room_number),
  constraint rooms_room_number_not_blank check (char_length(btrim(room_number)) > 0)
);

-- -----------------------------------------------------------------------------
-- guests: one row per person (re-used when the same ID number returns)
-- -----------------------------------------------------------------------------
create table public.guests (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name  text not null check (char_length(btrim(last_name)) > 0),
  phone      text not null check (char_length(btrim(phone)) > 0),
  email      text,
  id_number  text not null check (char_length(btrim(id_number)) > 0), -- national ID or passport, stored upper-case
  address    text not null check (char_length(btrim(address)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_id_number_key unique (id_number)
);

create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- stays: a guest occupying (or booked into) a room
-- pending     = upcoming, guest has not arrived yet
-- active      = guest is in the hotel
-- checked_out = stay finished
-- cancelled   = booking withdrawn
-- -----------------------------------------------------------------------------
create table public.stays (
  id                 uuid primary key default gen_random_uuid(),
  guest_id           uuid not null references public.guests (id) on delete restrict,
  room_id            uuid not null references public.rooms (id)  on delete restrict,
  status             public.stay_status not null default 'active',
  check_in           timestamptz not null,
  expected_check_out timestamptz not null,
  actual_check_out   timestamptz,
  price_per_night    numeric(10, 2) not null check (price_per_night >= 0), -- snapshot: later rate changes never rewrite history
  payment_status     public.payment_status not null default 'unpaid',
  notes              text,
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint stays_dates_valid        check (expected_check_out > check_in),
  constraint stays_checkout_recorded  check (status <> 'checked_out' or actual_check_out is not null)
);

create trigger stays_set_updated_at
  before update on public.stays
  for each row execute function public.set_updated_at();

-- Business rule 1: a room can only hold ONE active guest at a time.
create unique index stays_one_active_per_room
  on public.stays (room_id)
  where status = 'active';

-- Business rule 2: no double-booking. Pending/active stays for the same room may
-- not overlap in time ('[)' = check-out moment is free for the next guest).
alter table public.stays
  add constraint stays_no_overlapping_bookings
  exclude using gist (
    room_id with =,
    tstzrange(check_in, expected_check_out, '[)') with &&
  )
  where (status in ('pending', 'active'));

-- Indexes for the screens we actually load
create index stays_status_idx        on public.stays (status);
create index stays_check_in_idx      on public.stays (check_in desc);
create index stays_guest_idx         on public.stays (guest_id);
create index stays_active_due_idx    on public.stays (expected_check_out) where status = 'active';
