-- =============================================================================
-- Magaños - migration 6
--
--   1. Room types reduced to TWO: single ("simple") and double.
--   2. Short stay: every room now has a nightly rate AND a short-stay rate.
--      A stay records which of the two it was billed at (stays.rate_kind).
--   3. app_settings: access codes (PIN) that the administrator can change from
--      the Settings screen, stored as a salted hash - never in clear text.
--
-- Run it AFTER 20260919000005_reports.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Drop everything that depends on the room_type enum or on the billing
--    formula. All of it is rebuilt at the bottom of this file.
-- -----------------------------------------------------------------------------
drop view if exists public.stay_details;
drop view if exists public.room_status;
drop view if exists public.guest_summary;
drop function if exists public.report_by_room_type(date, date, text);
drop function if exists public.report_summary(date, date, text);
drop function if exists public.report_outstanding();

-- -----------------------------------------------------------------------------
-- 1. Only two room types. Anything else becomes "double".
-- -----------------------------------------------------------------------------
alter type public.room_type rename to room_type_old;
create type public.room_type as enum ('single', 'double');

alter table public.rooms alter column room_type drop default;
alter table public.rooms
  alter column room_type type public.room_type
  using (case when room_type::text = 'single' then 'single' else 'double' end)::public.room_type;
alter table public.rooms alter column room_type set default 'double';

drop type public.room_type_old;

-- -----------------------------------------------------------------------------
-- 2. Short stay
-- -----------------------------------------------------------------------------
create type public.rate_kind as enum ('night', 'short');

-- Default short-stay rate of the room (the administrator sets it).
alter table public.rooms
  add column if not exists price_short_stay numeric(10, 2) not null default 0
    check (price_short_stay >= 0);

-- How this stay is billed. 'night' = price x nights, 'short' = one flat price.
alter table public.stays
  add column if not exists rate_kind public.rate_kind not null default 'night';

comment on column public.stays.price_per_night is
  'Snapshot of the agreed price. rate_kind = night -> per night; rate_kind = short -> flat short-stay price.';

-- Billable nights: whole 24h blocks between check-in and expected check-out (min 1).
create or replace function public.stay_nights(p_in timestamptz, p_out timestamptz)
returns int
language sql
immutable
as $$
  select greatest(1, ceil(extract(epoch from (p_out - p_in)) / 86400.0))::int;
$$;

-- Billable units: a short stay is always ONE unit, however long it lasts.
create or replace function public.stay_units(p_in timestamptz, p_out timestamptz, p_kind public.rate_kind)
returns int
language sql
immutable
as $$
  select case when p_kind = 'short' then 1 else public.stay_nights(p_in, p_out) end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Read models rebuilt with the new billing formula
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
  s.rate_kind,
  s.payment_status,
  s.notes,
  s.created_at,
  s.updated_at,

  public.stay_nights(s.check_in, s.expected_check_out) as nights,
  public.stay_units(s.check_in, s.expected_check_out, s.rate_kind) * s.price_per_night as total_amount,

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

create or replace view public.room_status
with (security_invoker = true) as
select
  r.id,
  r.room_number,
  r.room_type,
  r.price_per_night,
  r.price_short_stay,
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
left join public.stays  s on s.room_id = r.id and s.status = 'active'
left join public.guests g on g.id = s.guest_id;

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
    sum(public.stay_units(s.check_in, s.expected_check_out, s.rate_kind) * s.price_per_night)
      filter (where s.status in ('active', 'checked_out')),
    0
  ) as total_billed,
  max(s.check_in) filter (where s.status in ('active', 'checked_out')) as last_check_in,
  extensions.unaccent(lower(concat_ws(' ',
    g.first_name, g.last_name, g.phone, regexp_replace(g.phone, '\D', '', 'g'), g.id_number, g.email
  ))) as search_text
from public.guests g
left join public.stays s on s.guest_id = g.id
group by g.id;

revoke all on public.stay_details, public.room_status, public.guest_summary from anon;

-- -----------------------------------------------------------------------------
-- 4. Reports rebuilt with the new billing formula
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
  occupancy_pct        numeric,
  short_stays          bigint,
  billed_short         numeric
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

  v_start := p_from::timestamp at time zone p_tz;
  v_end   := (p_to + 1)::timestamp at time zone p_tz;
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
      st.rate_kind,
      public.stay_nights(st.check_in, st.expected_check_out) as nights,
      public.stay_units(st.check_in, st.expected_check_out, st.rate_kind) * st.price_per_night as amount,
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
    coalesce((select sum(amount) from ins), 0),
    coalesce((select sum(amount) from ins where payment_status = 'paid'), 0),
    coalesce((select sum(amount) from ins where payment_status = 'partial'), 0),
    coalesce((select sum(amount) from ins where payment_status = 'unpaid'), 0),
    coalesce((select round(avg(nights), 1) from ins where rate_kind = 'night'), 0),
    coalesce((select round(sum(amount) / nullif(sum(nights), 0), 2) from ins where rate_kind = 'night'), 0),
    (select n from occ),
    (v_rooms * v_days)::bigint,
    case when v_rooms * v_days = 0 then 0::numeric
         else round(least(100::numeric, (select n from occ) * 100.0 / (v_rooms * v_days)), 1) end,
    (select count(*) from ins where rate_kind = 'short'),
    coalesce((select sum(amount) from ins where rate_kind = 'short'), 0);
end;
$$;

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
      public.stay_units(st.check_in, st.expected_check_out, st.rate_kind) * st.price_per_night as amount,
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
    coalesce((select sum(b.amount)
                from base b where b.rtype = t.rtype and b.check_in >= v_start and b.check_in < v_end), 0)
  from types t
  order by t.rtype;
end;
$$;

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
    coalesce(sum(public.stay_units(st.check_in, st.expected_check_out, st.rate_kind) * st.price_per_night), 0)
  from public.stays st
  where st.status in ('active', 'checked_out')
    and st.payment_status in ('unpaid', 'partial');
end;
$$;

revoke execute on function public.report_summary(date, date, text)      from public, anon;
revoke execute on function public.report_by_room_type(date, date, text) from public, anon;
revoke execute on function public.report_outstanding()                  from public, anon;

grant execute on function public.report_summary(date, date, text)      to authenticated;
grant execute on function public.report_by_room_type(date, date, text) to authenticated;
grant execute on function public.report_outstanding()                  to authenticated;

-- -----------------------------------------------------------------------------
-- 5. app_settings: the access codes the administrator can change in the app
--
-- Only a HASH of each code is stored (sha-256 of "pepper:code", computed by the
-- app server; the pepper is a server-only environment value). Reading the table
-- is limited to administrators.
--
-- The sign-in screen has no session yet, so it uses two SECURITY DEFINER
-- functions that give away nothing useful:
--   pin_override_roles() -> which roles have a code stored here at all
--   resolve_pin_hash()   -> which role a given hash belongs to (no hash is ever
--                           returned, and a hash cannot be produced without the
--                           server-only pepper)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.app_settings enable row level security;

create policy "app_settings: admins read"
  on public.app_settings for select to authenticated
  using (public.is_admin());

create policy "app_settings: admins insert"
  on public.app_settings for insert to authenticated
  with check (public.is_admin());

create policy "app_settings: admins update"
  on public.app_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.app_settings from anon;

create or replace function public.pin_override_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(
    case when key = 'admin_pin_hash' then 'admin' else 'reception' end
  ), '{}')
  from public.app_settings
  where key in ('admin_pin_hash', 'reception_pin_hash');
$$;

create or replace function public.resolve_pin_hash(p_hash text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_hash is null or length(p_hash) <> 64 then null
    when exists (select 1 from public.app_settings s where s.key = 'admin_pin_hash'     and s.value = p_hash) then 'admin'
    when exists (select 1 from public.app_settings s where s.key = 'reception_pin_hash' and s.value = p_hash) then 'reception'
    else null
  end;
$$;

grant execute on function public.pin_override_roles()      to anon, authenticated;
grant execute on function public.resolve_pin_hash(text)    to anon, authenticated;
