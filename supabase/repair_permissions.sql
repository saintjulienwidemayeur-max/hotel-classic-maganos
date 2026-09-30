-- =============================================================================
-- REPAIR: access rights ("permission denied", "Votre compte n'a pas la permission")
--
-- Safe to run as many times as you like, in Supabase -> SQL Editor.
-- Run it when an administrator gets permission errors (dashboard, rooms, reports),
-- typically because migration 3 or 6 stopped half way the first time.
-- Changes no data: only grants, policies and the admin role.
-- =============================================================================

-- 1) Table and view rights for signed-in staff (Row Level Security still decides who may do what)
grant usage on schema public to authenticated;
grant select, update                 on public.profiles to authenticated;
grant select, insert, update, delete on public.rooms    to authenticated;
grant select, insert, update         on public.guests   to authenticated;
grant select, insert, update         on public.stays    to authenticated;
grant select on public.stay_details, public.room_status, public.guest_summary to authenticated;
grant select, insert, update         on public.app_settings to authenticated;

-- 2) Functions (dashboard, reports, role checks)
grant execute on all functions in schema public to authenticated;

-- 3) Room policies: only administrators add, change and delete rooms
drop policy if exists "rooms: admins insert" on public.rooms;
drop policy if exists "rooms: admins update" on public.rooms;
drop policy if exists "rooms: admins delete" on public.rooms;

create policy "rooms: admins insert" on public.rooms for insert to authenticated with check (public.is_admin());
create policy "rooms: admins update" on public.rooms for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "rooms: admins delete" on public.rooms for delete to authenticated using (public.is_admin());

-- 4) CHECK: the two accounts behind the codes and their roles.
--    The account of ADMIN_EMAIL must show role = admin, the reception one role = staff,
--    both is_active = true.
select u.email, p.role, p.is_active
from auth.users u
left join public.profiles p on p.id = u.id
order by u.email;

-- 5) If the administrator account shows a wrong role (or no row), fix it here:
--    replace ADMIN_EMAIL_HERE with the exact ADMIN_EMAIL from Render, remove the "--" and run.
-- insert into public.profiles (id, full_name, role, is_active)
--   select id, 'Administrateur', 'admin', true from auth.users where email = 'ADMIN_EMAIL_HERE'
--   on conflict (id) do update set role = 'admin', is_active = true;
