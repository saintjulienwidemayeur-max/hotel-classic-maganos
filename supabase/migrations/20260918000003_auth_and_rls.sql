-- =============================================================================
-- Authentication profile trigger + Row Level Security
--
-- Access model
--   * Only signed-in users with an ACTIVE profile ("staff") can read/write data.
--   * Only admins can manage rooms and other profiles.
--   * Nobody can delete guests or stays through the API (audit trail).
--   * The anonymous (not signed-in) role gets nothing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Create a profile whenever a user is added in Supabase Auth.
-- The very first user becomes an admin; everyone after that is staff.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'staff'::public.staff_role
         else 'admin'::public.staff_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helper predicates used by the policies.
-- SECURITY DEFINER so they can read profiles without recursing into its own RLS.
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active and role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere (a table with RLS on and no policy denies everything)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms    enable row level security;
alter table public.guests   enable row level security;
alter table public.stays    enable row level security;

-- profiles ---------------------------------------------------------------------
create policy "profiles: read own row, admins read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: admins update"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- rooms ------------------------------------------------------------------------
create policy "rooms: staff read"
  on public.rooms for select to authenticated
  using (public.is_staff());

create policy "rooms: admins insert"
  on public.rooms for insert to authenticated
  with check (public.is_admin());

create policy "rooms: admins update"
  on public.rooms for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- guests (no delete policy on purpose) ------------------------------------------
create policy "guests: staff read"
  on public.guests for select to authenticated
  using (public.is_staff());

create policy "guests: staff insert"
  on public.guests for insert to authenticated
  with check (public.is_staff());

create policy "guests: staff update"
  on public.guests for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- stays (no delete policy on purpose; use status = 'cancelled') -------------------
create policy "stays: staff read"
  on public.stays for select to authenticated
  using (public.is_staff());

create policy "stays: staff insert"
  on public.stays for insert to authenticated
  with check (public.is_staff());

create policy "stays: staff update"
  on public.stays for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Table privileges: signed-out visitors (anon) get nothing at all.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.rooms, public.guests, public.stays,
              public.stay_details, public.room_status from anon;

revoke execute on function public.dashboard_stats(timestamptz, timestamptz) from public, anon;
grant  execute on function public.dashboard_stats(timestamptz, timestamptz) to authenticated;
