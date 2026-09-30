-- =============================================================================
-- Magaños - migration 8: one access code per receptionist
--
--   * receptionists      name + hashed 4-digit code, managed by the administrator
--   * stays.recorded_by_name / checked_out_by_name / last_edit_by_name
--                        WHO did each transaction (a name snapshot, so the history
--                        stays readable even if the receptionist is later removed)
--   * resolve_receptionist()        login: which receptionist does this code belong to
--   * active_receptionist_count()   once one exists, the old shared reception code stops working
--
-- Safe to run more than once. Run it after migration 6.
-- =============================================================================

create table if not exists public.receptionists (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(btrim(full_name)) > 0),
  pin_hash   text not null check (char_length(pin_hash) = 64),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create unique index if not exists receptionists_name_key on public.receptionists (lower(btrim(full_name)));
create unique index if not exists receptionists_pin_key  on public.receptionists (pin_hash);

alter table public.receptionists enable row level security;

drop policy if exists "receptionists: admins read"   on public.receptionists;
drop policy if exists "receptionists: admins insert" on public.receptionists;
drop policy if exists "receptionists: admins update" on public.receptionists;
drop policy if exists "receptionists: admins delete" on public.receptionists;

create policy "receptionists: admins read"   on public.receptionists for select to authenticated using (public.is_admin());
create policy "receptionists: admins insert" on public.receptionists for insert to authenticated with check (public.is_admin());
create policy "receptionists: admins update" on public.receptionists for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "receptionists: admins delete" on public.receptionists for delete to authenticated using (public.is_admin());

revoke all on public.receptionists from anon;
grant select, insert, update, delete on public.receptionists to authenticated;

-- Who did what (names, not ids: they must survive a receptionist being deleted).
alter table public.stays add column if not exists recorded_by_name    text;
alter table public.stays add column if not exists checked_out_by_name text;
alter table public.stays add column if not exists last_edit_by_name   text;

-- stay_details gets the three new columns at the end (everything else is unchanged).
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
  ))) as search_text,

  s.recorded_by_name,
  s.checked_out_by_name,
  s.last_edit_by_name
from public.stays s
join public.guests g on g.id = s.guest_id
join public.rooms  r on r.id = s.room_id;

revoke all on public.stay_details from anon;

-- Login helpers. They take a hash and return nothing that could reveal a code.
create or replace function public.resolve_receptionist(p_hash text)
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.full_name
  from public.receptionists r
  where r.is_active and p_hash is not null and length(p_hash) = 64 and r.pin_hash = p_hash
  limit 1;
$$;

create or replace function public.active_receptionist_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.receptionists where is_active;
$$;

grant execute on function public.resolve_receptionist(text)    to anon, authenticated;
grant execute on function public.active_receptionist_count()   to anon, authenticated;

notify pgrst, 'reload schema';
