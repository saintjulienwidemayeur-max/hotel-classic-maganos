-- =============================================================================
-- Read models used by the app
-- Both views are SECURITY INVOKER, so Row Level Security on the underlying
-- tables still applies to whoever queries them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- stay_details: one flat row per stay (stay + guest + room)
-- "search_text" powers the search bar: name, phone (raw and digits-only), ID,
-- email and room number in one accent-stripped string.
-- -----------------------------------------------------------------------------
create or replace view public.stay_details
with (security_invoker = true) as
select
  s.id,
  s.status,
  s.check_in,
  s.expected_check_out,
  s.actual_check_out,
  s.price_per_night,
  s.payment_status,
  s.notes,
  s.created_at,
  s.updated_at,

  -- Billable nights = whole 24h blocks between check-in and expected check-out (min 1)
  greatest(1, ceil(extract(epoch from (s.expected_check_out - s.check_in)) / 86400.0))::int as nights,
  greatest(1, ceil(extract(epoch from (s.expected_check_out - s.check_in)) / 86400.0))::int
    * s.price_per_night as total_amount,

  g.id         as guest_id,
  g.first_name,
  g.last_name,
  g.phone,
  g.email,
  g.id_number,
  g.address,

  r.id          as room_id,
  r.room_number,
  r.room_type,

  extensions.unaccent(lower(concat_ws(' ',
    g.first_name,
    g.last_name,
    g.phone,
    regexp_replace(g.phone, '\D', '', 'g'),
    g.id_number,
    g.email,
    r.room_number
  ))) as search_text
from public.stays s
join public.guests g on g.id = s.guest_id
join public.rooms  r on r.id = s.room_id;

-- -----------------------------------------------------------------------------
-- room_status: every room with its live state
--   available | occupied | out_of_service
-- -----------------------------------------------------------------------------
create or replace view public.room_status
with (security_invoker = true) as
select
  r.id,
  r.room_number,
  r.room_type,
  r.price_per_night,
  r.is_active,
  case
    when not r.is_active then 'out_of_service'
    when s.id is not null then 'occupied'
    else 'available'
  end as state,
  s.id                                as stay_id,
  g.first_name || ' ' || g.last_name  as guest_name,
  s.expected_check_out
from public.rooms r
left join public.stays  s on s.room_id = r.id and s.status = 'active' -- at most one row: see stays_one_active_per_room
left join public.guests g on g.id = s.guest_id;

-- -----------------------------------------------------------------------------
-- dashboard_stats: all headline numbers in a single round trip.
-- The app passes the start/end of "today" in the hotel's time zone.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_stats(p_day_start timestamptz, p_day_end timestamptz)
returns table (
  checked_in_guests  bigint,
  available_rooms    bigint,
  total_rooms        bigint,
  checkouts_today    bigint,
  overdue_checkouts  bigint,
  total_stays        bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from stays where status = 'active'),
    (select count(*) from room_status where state = 'available'),
    (select count(*) from rooms where is_active),
    (select count(*) from stays
       where status = 'active'
         and expected_check_out >= p_day_start
         and expected_check_out <  p_day_end),
    (select count(*) from stays
       where status = 'active'
         and expected_check_out < p_day_start),
    (select count(*) from stays);
$$;
