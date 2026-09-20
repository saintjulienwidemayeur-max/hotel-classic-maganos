-- =============================================================================
-- Reports for the administrator
--
--   * report_summary      headline numbers for a date range
--   * report_daily        one row per day (check-ins, check-outs, rooms occupied)
--   * report_by_room_type occupancy and billing per room type
--   * report_outstanding  stays still marked unpaid / part paid (all time)
--   * guest_summary       guest directory with stay counts and totals
--
-- The report_* functions refuse to run for anyone who is not an active
-- administrator (error 42501), so the numbers stay protected even if someone
-- calls the API directly. They are SECURITY INVOKER: Row Level Security on the
-- underlying tables still applies.
--
-- Definitions used everywhere below
--   * Only stays with status 'active' or 'checked_out' count as business done
--     (pending = not arrived yet, cancelled = never happened).
--   * A stay is billed for whole 24h blocks between check-in and EXPECTED
--     check-out (minimum 1 night) x its own price per night. This matches the
--     "total" shown in the app.
--   * A stay "occupies" every calendar night (in the hotel's time zone) from
--     its check-in date up to the night before its check-out date, and always
--     at least the first night. For finished stays the real check-out is used.
--   * Available room-nights = rooms currently in service x days in the range.
-- =============================================================================

-- Shared guard: administrators only, and a sane date range (max 366 days).
create or replace function public.assert_report_access(p_from date, p_to date)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 365 then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Headline numbers
-- -----------------------------------------------------------------------------
create or replace function public.report_summary(p_from date, p_to date, p_tz text)
returns table (
  checkins             bigint,
  checkouts            bigint,
  cancelled            bigint,
  billed               numeric,
  billed_paid          numeric,
  billed_partial       numeric,
  billed_unpaid        numeric,
  avg_stay_nights      numeric,
  avg_nightly_rate     numeric,
  occupied_room_nights bigint,
  available_room_nights bigint,
  occupancy_pct        numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_start timestamptz;
  v_end   timestamptz;
  v_days  int;
  v_rooms int;
begin
  perform public.assert_report_access(p_from, p_to);

  v_start := p_from::timestamp at time zone p_tz;          -- 00:00 of first day, hotel time
  v_end   := (p_to + 1)::timestamp at time zone p_tz;      -- 00:00 after last day
  v_days  := (p_to - p_from) + 1;
  select count(*) into v_rooms from public.rooms r where r.is_active;

  return query
  with base as (
    select
      st.status,
      st.payment_status,
      st.check_in,
      st.actual_check_out,
      st.price_per_night,
      greatest(1, ceil(extract(epoch from (st.expected_check_out - st.check_in)) / 86400.0))::int as nights,
      (st.check_in at time zone p_tz)::date as ci_date,
      greatest(
        ((case when st.status = 'checked_out' then st.actual_check_out else st.expected_check_out end)
           at time zone p_tz)::date - 1,
        (st.check_in at time zone p_tz)::date
      ) as last_night
    from public.stays st
  ),
  ins as (
    select * from base
    where status in ('active', 'checked_out') and check_in >= v_start and check_in < v_end
  ),
  occ as (
    select coalesce(sum(greatest(0, least(last_night, p_to) - greatest(ci_date, p_from) + 1)), 0)::bigint as n
    from base
    where status in ('active', 'checked_out')
  )
  select
    (select count(*) from ins),
    (select count(*) from base where status = 'checked_out'
        and actual_check_out >= v_start and actual_check_out < v_end),
    (select count(*) from base where status = 'cancelled' and check_in >= v_start and check_in < v_end),
    coalesce((select sum(nights * price_per_night) from ins), 0),
    coalesce((select sum(nights * price_per_night) from ins where payment_status = 'paid'), 0),
    coalesce((select sum(nights * price_per_night) from ins where payment_status = 'partial'), 0),
    coalesce((select sum(nights * price_per_night) from ins where payment_status = 'unpaid'), 0),
    coalesce((select round(avg(nights), 1) from ins), 0),
    coalesce((select round(sum(nights * price_per_night) / nullif(sum(nights), 0), 2) from ins), 0),
    (select n from occ),
    (v_rooms * v_days)::bigint,
    case when v_rooms * v_days = 0 then 0::numeric
         else round(least(100::numeric, (select n from occ) * 100.0 / (v_rooms * v_days)), 1) end;
end;
$$;

-- -----------------------------------------------------------------------------
-- One row per day
-- -----------------------------------------------------------------------------
create or replace function public.report_daily(p_from date, p_to date, p_tz text)
returns table (
  day            date,
  checkins       bigint,
  checkouts      bigint,
  occupied_rooms bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.assert_report_access(p_from, p_to);

  return query
  with base as (
    select
      st.status,
      st.actual_check_out,
      (st.check_in at time zone p_tz)::date as ci_date,
      greatest(
        ((case when st.status = 'checked_out' then st.actual_check_out else st.expected_check_out end)
           at time zone p_tz)::date - 1,
        (st.check_in at time zone p_tz)::date
      ) as last_night
    from public.stays st
    where st.status in ('active', 'checked_out')
  ),
  days as (
    select g::date as d from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  )
  select
    days.d,
    (select count(*) from base b where b.ci_date = days.d),
    (select count(*) from base b where b.status = 'checked_out'
        and (b.actual_check_out at time zone p_tz)::date = days.d),
    (select count(*) from base b where b.ci_date <= days.d and b.last_night >= days.d)
  from days
  order by days.d;
end;
$$;

-- -----------------------------------------------------------------------------
-- Per room type: how many rooms, how full, how much billed
-- -----------------------------------------------------------------------------
create or replace function public.report_by_room_type(p_from date, p_to date, p_tz text)
returns table (
  room_type     public.room_type,
  rooms_count   bigint,
  checkins      bigint,
  room_nights   bigint,
  occupancy_pct numeric,
  billed        numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_start timestamptz;
  v_end   timestamptz;
  v_days  int;
begin
  perform public.assert_report_access(p_from, p_to);

  v_start := p_from::timestamp at time zone p_tz;
  v_end   := (p_to + 1)::timestamp at time zone p_tz;
  v_days  := (p_to - p_from) + 1;

  return query
  with base as (
    select
      r.room_type as rtype,
      st.check_in,
      st.price_per_night,
      greatest(1, ceil(extract(epoch from (st.expected_check_out - st.check_in)) / 86400.0))::int as nights,
      (st.check_in at time zone p_tz)::date as ci_date,
      greatest(
        ((case when st.status = 'checked_out' then st.actual_check_out else st.expected_check_out end)
           at time zone p_tz)::date - 1,
        (st.check_in at time zone p_tz)::date
      ) as last_night
    from public.stays st
    join public.rooms r on r.id = st.room_id
    where st.status in ('active', 'checked_out')
  ),
  types as (
    select r.room_type as rtype, count(*) filter (where r.is_active) as n_rooms
    from public.rooms r
    group by r.room_type
  )
  select
    t.rtype,
    t.n_rooms::bigint,
    (select count(*) from base b where b.rtype = t.rtype and b.check_in >= v_start and b.check_in < v_end),
    (select coalesce(sum(greatest(0, least(b.last_night, p_to) - greatest(b.ci_date, p_from) + 1)), 0)
       from base b where b.rtype = t.rtype)::bigint,
    case when t.n_rooms * v_days = 0 then 0::numeric
         else round(least(100::numeric,
                (select coalesce(sum(greatest(0, least(b.last_night, p_to) - greatest(b.ci_date, p_from) + 1)), 0)
                   from base b where b.rtype = t.rtype) * 100.0 / (t.n_rooms * v_days)), 1) end,
    coalesce((select sum(b.nights * b.price_per_night)
                from base b where b.rtype = t.rtype and b.check_in >= v_start and b.check_in < v_end), 0)
  from types t
  order by t.rtype;
end;
$$;

-- -----------------------------------------------------------------------------
-- Money still to collect (all time): stays marked unpaid or part paid.
-- "amount" is the full billed total of those stays; for part-paid stays the
-- app does not record how much was already received.
-- -----------------------------------------------------------------------------
create or replace function public.report_outstanding()
returns table (
  stays  bigint,
  amount numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.assert_report_access(current_date, current_date);

  return query
  select
    count(*)::bigint,
    coalesce(sum(greatest(1, ceil(extract(epoch from (st.expected_check_out - st.check_in)) / 86400.0))::int
                 * st.price_per_night), 0)
  from public.stays st
  where st.status in ('active', 'checked_out')
    and st.payment_status in ('unpaid', 'partial');
end;
$$;

-- -----------------------------------------------------------------------------
-- Guest directory: one row per guest with lifetime totals
-- -----------------------------------------------------------------------------
create or replace view public.guest_summary
with (security_invoker = true) as
select
  g.id,
  g.first_name,
  g.last_name,
  g.phone,
  g.email,
  g.id_number,
  g.address,
  g.created_at,
  (count(s.id) filter (where s.status in ('active', 'checked_out')))::int as stay_count,
  coalesce(
    sum(greatest(1, ceil(extract(epoch from (s.expected_check_out - s.check_in)) / 86400.0))::int
        * s.price_per_night) filter (where s.status in ('active', 'checked_out')),
    0
  ) as total_billed,
  max(s.check_in) filter (where s.status in ('active', 'checked_out')) as last_check_in,
  extensions.unaccent(lower(concat_ws(' ',
    g.first_name, g.last_name, g.phone, regexp_replace(g.phone, '\D', '', 'g'), g.id_number, g.email
  ))) as search_text
from public.guests g
left join public.stays s on s.guest_id = g.id
group by g.id;

-- -----------------------------------------------------------------------------
-- Privileges: signed-out visitors get nothing.
-- -----------------------------------------------------------------------------
revoke all on public.guest_summary from anon;

revoke execute on function public.assert_report_access(date, date)      from public, anon;
revoke execute on function public.report_summary(date, date, text)      from public, anon;
revoke execute on function public.report_daily(date, date, text)        from public, anon;
revoke execute on function public.report_by_room_type(date, date, text) from public, anon;
revoke execute on function public.report_outstanding()                  from public, anon;

grant execute on function public.assert_report_access(date, date)      to authenticated;
grant execute on function public.report_summary(date, date, text)      to authenticated;
grant execute on function public.report_daily(date, date, text)        to authenticated;
grant execute on function public.report_by_room_type(date, date, text) to authenticated;
grant execute on function public.report_outstanding()                  to authenticated;
